"""검토 정보(사업명·검토명·고객사·국가·마감일·담당), 실행 목록 개수, 목록 API 전체 개수.

명세 review-run(add-review-info)의 Scenario.
"""

from datetime import date

import pytest

from rfp_agent.pipeline import queries, review, review_info
from rfp_agent.pipeline.run import RunContext, create_run, execute_run

VERSION = "test-dict-v1"


def run_once(conn, paths, started_by=None):
    run_id = create_run(conn, VERSION, None, started_by)
    assert execute_run(RunContext(conn, VERSION, None, None), run_id, paths) == "ENGINEER_REVIEW"
    return run_id


@pytest.fixture
def client(db, db_url, monkeypatch):
    from fastapi.testclient import TestClient

    from rfp_agent.api.main import app
    from rfp_agent.config import get_settings

    monkeypatch.setenv("DATABASE_URL", db_url)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    get_settings.cache_clear()
    yield TestClient(app)
    get_settings.cache_clear()


def upload(client, spec, **form):
    with spec.open("rb") as f:
        return client.post("/api/runs", data=form, files=[("files", (spec.name, f.read()))])


def test_start_with_review_info(db, spec, client):
    """Scenario: 검토 정보와 함께 시작 — 다섯 값이 그대로, 담당은 시작한 엔지니어."""
    engineer = review.default_user(db, "ENGINEER")
    started = upload(client, spec, project_name="Thai Binh",
                     review_name="115·230 kV GIS 변전소 신설", customer_name="예시 전력회사",
                     country="베트남", due_date="2026-10-30",
                     actor_id=str(engineer))
    assert started.status_code == 202
    summary = client.get(f"/api/runs/{started.json()['run_id']}").json()
    assert (summary["project_name"], summary["review_name"], summary["customer_name"],
            summary["country"], summary["due_date"]) == (
        "Thai Binh", "115·230 kV GIS 변전소 신설", "예시 전력회사", "베트남", "2026-10-30")
    assert summary["engineer_id"] == engineer and summary["engineer_name"] == "기본 엔지니어"


def test_start_without_review_info(db, spec, client):
    """Scenario: 검토 정보 없이 시작 — 실행은 시작되고 칸은 모두 비어 있다 (채우지 않음)."""
    started = upload(client, spec)
    assert started.status_code == 202
    summary = client.get(f"/api/runs/{started.json()['run_id']}").json()
    assert summary["stage"] == "ENGINEER_REVIEW"
    assert all(summary[k] is None for k in review_info.FIELDS)


def test_non_engineer_cannot_be_assigned(db, spec, client):
    """Scenario: 엔지니어가 아닌 담당자 — 오류, 바뀌지 않음."""
    cost = review.default_user(db, "COST")
    runs_before = len(client.get("/api/runs").json())
    refused = upload(client, spec, engineer_id=str(cost))
    assert refused.status_code == 400 and "엔지니어" in refused.json()["detail"]
    assert len(client.get("/api/runs").json()) == runs_before          # 실행을 만들지 않는다
    run_id = run_once(db, [spec])
    put = client.put(f"/api/runs/{run_id}/info", json={"engineer_id": cost})
    assert put.status_code == 400
    assert client.get(f"/api/runs/{run_id}").json()["engineer_id"] is None
    assert client.put(f"/api/runs/{run_id}/info", json={"engineer_id": 999999}).status_code == 404
    assert client.put("/api/runs/999999/info", json={"country": "한국"}).status_code == 404


def test_change_due_date_logs_once(db, spec, client):
    """Scenario: 마감일을 바꿈 — 요약의 마감일이 바뀌고 이력 1건(이전 값, 새 값)."""
    run_id = run_once(db, [spec])
    review_info.update(db, run_id, {"due_date": "2026-10-30"}, None)
    before_logs = len(review.history(db, run_id, "review_run"))
    engineer = review.default_user(db, "ENGINEER")
    put = client.put(f"/api/runs/{run_id}/info",
                     json={"due_date": "2026-11-02", "actor_id": engineer})
    assert put.status_code == 200 and put.json()["due_date"] == "2026-11-02"
    logs = review.history(db, run_id, "review_run")
    assert len(logs) == before_logs + 1
    assert (logs[-1]["action"], logs[-1]["before_value"], logs[-1]["after_value"]) == (
        "EDIT", {"due_date": "2026-10-30"}, {"due_date": "2026-11-02"})
    # 같은 값을 다시 보내면 이력이 늘지 않는다
    client.put(f"/api/runs/{run_id}/info", json={"due_date": "2026-11-02"})
    assert len(review.history(db, run_id, "review_run")) == before_logs + 1
    # 빈 문자열은 비우기, 틀린 날짜는 400
    assert client.put(f"/api/runs/{run_id}/info", json={"due_date": ""}).json()["due_date"] is None
    assert client.put(f"/api/runs/{run_id}/info", json={"due_date": "10/30"}).status_code in (400,
                                                                                              422)


def test_judgments_unchanged_by_review_info(db, spec):
    """Scenario: 판정은 그대로 — 검토명·고객사를 고쳐도 판정 줄 수와 결과가 같다."""
    run_id = run_once(db, [spec])
    before = [(j["judgment_id"], j["result"]) for j in queries.run_judgments(db, run_id, limit=500)]
    review_info.update(db, run_id, {"review_name": "새 이름", "customer_name": "새 고객"}, None)
    after = [(j["judgment_id"], j["result"]) for j in queries.run_judgments(db, run_id, limit=500)]
    assert before == after and before


def test_run_list_counts_match_summary(db, spec):
    """Scenario: 목록의 개수 — 목록 줄의 개수 4개가 실행 요약과 같다."""
    run_id = run_once(db, [spec])
    [row] = [r for r in queries.run_list(db) if r["run_id"] == run_id]
    summary = queries.run_summary(db, run_id)
    for key in ("requirements", "risks", "deviation_candidates", "proposals"):
        assert row[key] == summary[key]
    assert summary["deviation_candidates"] == 4


def test_review_no(db, spec):
    """Scenario: 검토 번호 — 2026년에 시작한 실행 25번은 RV-2026-025."""
    run_id = create_run(db, VERSION, None)
    db.execute("UPDATE review_run SET started_at = '2026-10-24 09:10+09' WHERE run_id = %s",
               (run_id,))
    db.execute("SELECT setval('review_run_run_id_seq', 24)")
    other = create_run(db, VERSION, None)
    db.execute("UPDATE review_run SET started_at = '2026-10-24 09:10+09' WHERE run_id = %s",
               (other,))
    db.commit()
    assert other == 25
    assert queries.run_summary(db, other)["review_no"] == "RV-2026-025"
    assert queries.run_summary(db, run_id)["review_no"] == f"RV-2026-{run_id:03d}"


def test_paged_judgments_total(db, spec, client):
    """Scenario: 판정 목록 나눠 받기 — 10줄 이하와 거른 전체 개수."""
    run_id = run_once(db, [spec])
    page = client.get(f"/api/runs/{run_id}/judgments",
                      params={"result": "DEVIATION_CANDIDATE", "limit": 10})
    assert len(page.json()) <= 10 and int(page.headers["X-Total-Count"]) == 4
    reqs = client.get(f"/api/runs/{run_id}/requirements", params={"limit": 1})
    assert len(reqs.json()) == 1 and int(reqs.headers["X-Total-Count"]) > 1
    assert int(reqs.headers["X-Total-Count"]) == queries.count_requirements(db, run_id)
    warranty = client.get(f"/api/runs/{run_id}/warranty", params={"limit": 1})
    assert int(warranty.headers["X-Total-Count"]) == len(queries.run_warranty(db, run_id,
                                                                              limit=500))


def test_due_date_type(db, spec):
    run_id = run_once(db, [spec])
    review_info.update(db, run_id, {"due_date": "2026-11-19"}, None)
    assert queries.run_summary(db, run_id)["due_date"] == date(2026, 11, 19)
