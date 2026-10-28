"""판정 한꺼번에 확정. 명세 review-approval의 Scenario (add-bulk-confirm)."""

import pytest

from rfp_agent.pipeline import queries, review
from rfp_agent.pipeline.run import RunContext, create_run, execute_run, switch_product

VERSION = "test-dict-v1"


def run_once(conn, paths):
    run_id = create_run(conn, VERSION, None)
    assert execute_run(RunContext(conn, VERSION, None, None), run_id, paths) == "ENGINEER_REVIEW"
    return run_id


def ctx(conn):
    return RunContext(conn, VERSION, None, None)


def logs(conn, run_id):
    return conn.execute("SELECT count(*) FROM review_log WHERE run_id = %s AND target_table = "
                        "'judgment' AND action = 'CONFIRM'", (run_id,)).fetchone()[0]


def test_bulk_confirm_comply(db, spec):
    """Scenario: 준수 모두 확정 — 3줄 확정, 결과 그대로, 이력 3건."""
    run_id = run_once(db, [spec])
    comply = [j for j in queries.run_judgments(db, run_id, limit=500)
              if j["result"] == "COMPLY" and j["review_status"] == "CANDIDATE"][:3]
    assert len(comply) == 3
    ids = [j["judgment_id"] for j in comply]
    out = review.bulk_confirm(ctx(db), run_id, ids)
    assert out["confirmed"] == 3
    after = {j["judgment_id"]: j for j in queries.run_judgments(db, run_id, limit=500)}
    assert [(after[i]["result"], after[i]["review_status"]) for i in ids] == [
        ("COMPLY", "CONFIRMED")] * 3
    assert logs(db, run_id) == 3


def test_bulk_confirm_stale_row(db, spec):
    """Scenario: 현재 판정이 아닌 줄이 섞임 — 오류, 아무 줄도 확정되지 않고 이력 없음."""
    run_id = run_once(db, [spec])
    rows = queries.run_judgments(db, run_id, limit=500)
    gis = next(j for j in rows if j["product_code"] == "GIS-145")
    other = next(j for j in rows if j["equipment_group"] != gis["equipment_group"])
    switch_product(ctx(db), run_id, gis["equipment_group"], "GIS-145-P7")
    with pytest.raises(review.ReviewError) as err:
        review.bulk_confirm(ctx(db), run_id, [other["judgment_id"], gis["judgment_id"]])
    assert err.value.status == 409
    status = db.execute("SELECT review_status FROM judgment WHERE judgment_id = %s",
                        (other["judgment_id"],)).fetchone()[0]
    assert status == "CANDIDATE" and logs(db, run_id) == 0


def test_bulk_confirm_while_waiting_approval(db, spec):
    """Scenario: 승인 대기 중 한꺼번에 확정 — 담당자 확인 단계 오류, 바뀌지 않음."""
    run_id = run_once(db, [spec])
    j = queries.run_judgments(db, run_id, limit=1)[0]
    review.finish_review(db, run_id, review.default_user(db, "APPROVER"), "확인")
    with pytest.raises(review.ReviewError) as err:
        review.bulk_confirm(ctx(db), run_id, [j["judgment_id"]])
    assert "담당자 확인" in str(err.value)
    assert logs(db, run_id) == 0


def test_bulk_confirm_api(db, db_url, spec, monkeypatch):
    """한꺼번에 확정 API: 판정 확정만 받고, 빈 목록은 400."""
    from fastapi.testclient import TestClient

    from rfp_agent.api.main import app
    from rfp_agent.config import get_settings

    run_id = run_once(db, [spec])
    ids = [j["judgment_id"] for j in queries.run_judgments(db, run_id, limit=2)]
    monkeypatch.setenv("DATABASE_URL", db_url)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    get_settings.cache_clear()
    try:
        client = TestClient(app)
        url = f"/api/runs/{run_id}/actions/bulk"
        assert client.post(url, json={"target": "risk_flag", "ids": ids}).status_code == 400
        assert client.post(url, json={"ids": ids, "action": "REJECT"}).status_code == 400
        assert client.post(url, json={"ids": []}).status_code == 400
        res = client.post(url, json={"ids": ids})
        assert res.status_code == 200 and res.json()["confirmed"] == 2
    finally:
        get_settings.cache_clear()
