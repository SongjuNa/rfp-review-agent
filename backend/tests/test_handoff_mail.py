"""협조 요청 메일 발송 (update-role-handoff-mail).

명세 role-assignment "협조 요청 메일 발송"의 Scenario.
"""

from io import BytesIO

import pytest
from openpyxl import load_workbook

from rfp_agent.notify.mail import MAX_RETRIES
from rfp_agent.pipeline import queries, review
from rfp_agent.pipeline.assignments import build_assignments
from rfp_agent.pipeline.handoff_mail import NO_ADDRESS, send_requests
from tests.docx_factory import build_judgment_spec
from tests.test_role_assignment import TYPE_TEST, build_task_spec, ctx, run_once, sent


@pytest.fixture
def tasks_run(db, tmp_path):
    paths = [build_judgment_spec(tmp_path / "synthetic_judgment_tasks.docx"),
             build_task_spec(tmp_path / "synthetic_feeder_tasks.docx")]
    return db, run_once(db, paths)


def judged_quality_request(conn, run_id) -> int:
    """판정이 있는 요구사항 하나를 형식시험(품질) 유형으로 바꿔 판정이 걸린 품질 요청을 만든다."""
    req = conn.execute("SELECT requirement_id FROM judgment WHERE run_id = %s AND is_current "
                       "ORDER BY judgment_id LIMIT 1", (run_id,)).fetchone()[0]
    conn.execute("UPDATE requirement_type_tag SET type_code = 'TEST' "
                 "WHERE requirement_id = %s AND is_primary", (req,))
    build_assignments(conn, run_id)
    conn.commit()
    return req


def judgments_of(conn, run_id, req) -> list[int]:
    return [r[0] for r in conn.execute(
        "SELECT judgment_id FROM judgment WHERE run_id = %s AND is_current "
        "AND requirement_id = %s ORDER BY judgment_id", (run_id, req))]


def quality_task(conn, run_id, req) -> dict:
    return next(t for t in sent(conn, run_id, "QUALITY") if req in t["requirement_ids"])


def test_confirm_sends_quality_mail(tasks_run, fake_mailer):
    """Scenario: 확정 때 품질 담당에게 발송 — 메일 1통, "메일 보냄", 이력에 발송 기록."""
    conn, run_id = tasks_run
    req = judged_quality_request(conn, run_id)
    assert quality_task(conn, run_id, req)["status"] == "TODO"
    review.bulk_confirm(ctx(conn), run_id, judgments_of(conn, run_id, req))
    assert len(fake_mailer.sent) == 1
    [mail] = fake_mailer.sent
    task = quality_task(conn, run_id, req)
    assert mail["To"] == "quality@test" and task["status"] == "DOING"
    assert task["mail_to"] == "quality@test" and task["mail_sent_at"] is not None
    run = queries.run_summary(conn, run_id)
    assert mail["Subject"].startswith(f"[협조 요청] {run['review_no']}")
    body = mail.get_body(("plain",)).get_content()
    assert " ".join(task["text"].split())[:40] in body
    assert "synthetic_judgment_tasks.docx" in body               # 원문 위치 (파일 이름)
    [attachment] = list(mail.iter_attachments())
    sheet = load_workbook(BytesIO(attachment.get_content())).active
    assert sheet.cell(2, 4).value == "원문 위치" and sheet.cell(3, 4).value
    # 판정 없는 형식시험 요청(TYPE_TEST)은 확정 때 나가지 않는다
    assert next(t for t in sent(conn, run_id, "QUALITY") if t["text"] == TYPE_TEST)["status"] \
        == "TODO"
    [log] = [h for h in review.history(conn, run_id, "assignment") if h["action"] == "SEND"]
    assert log["after_value"]["mail_to"] == "quality@test" and log["after_value"]["count"] == 1


def test_candidate_judgment_is_not_sent(tasks_run, fake_mailer):
    """사람이 확인하지 않은 판정이 남은 요청은 보내지 않는다 (CR-08)."""
    conn, run_id = tasks_run
    req = judged_quality_request(conn, run_id)
    other = conn.execute("SELECT judgment_id FROM judgment WHERE run_id = %s AND is_current "
                         "AND requirement_id <> %s LIMIT 1", (run_id, req)).fetchone()[0]
    review.act(ctx(conn), run_id, "judgment", other, "CONFIRM")
    assert fake_mailer.sent == [] and quality_task(conn, run_id, req)["status"] == "TODO"


def test_sent_only_once(tasks_run, fake_mailer):
    """Scenario: 다시 확정해도 한 번만 — 보낸 요청은 다시 보내지 않고 새 요청만 보낸다."""
    conn, run_id = tasks_run
    req = judged_quality_request(conn, run_id)
    review.bulk_confirm(ctx(conn), run_id, judgments_of(conn, run_id, req))
    others = [r[0] for r in conn.execute(
        "SELECT judgment_id FROM judgment WHERE run_id = %s AND is_current "
        "AND requirement_id <> %s ORDER BY judgment_id LIMIT 2", (run_id, req))]
    review.act(ctx(conn), run_id, "judgment", others[0], "CONFIRM")
    assert len(fake_mailer.sent) == 1
    point = queries.run_proposals(conn, run_id)[0]
    review.act(ctx(conn), run_id, "proposal_point", point["point_id"], "ADOPT")
    assert [m["To"] for m in fake_mailer.sent] == ["quality@test", "sales@test"]
    review.act(ctx(conn), run_id, "judgment", others[1], "CONFIRM")
    assert len(fake_mailer.sent) == 2
    assert quality_task(conn, run_id, req)["status"] == "DOING"


def test_no_address(tasks_run, fake_mailer):
    """Scenario: 주소가 설정되지 않은 부서 — 메일은 나가지 않고 "안 보냄"과 "주소 없음"."""
    conn, run_id = tasks_run
    fake_mailer.addresses.pop("SALES")
    point = queries.run_proposals(conn, run_id)[0]
    review.act(ctx(conn), run_id, "proposal_point", point["point_id"], "ADOPT")
    [task] = [t for t in sent(conn, run_id, "SALES") if t["point_id"]]
    assert fake_mailer.sent == [] and fake_mailer.tries == 0
    assert task["status"] == "TODO" and task["mail_error"] == NO_ADDRESS
    assert task["dept_address"] is None


def test_send_failure_then_resend(tasks_run, fake_mailer, db_url, monkeypatch):
    """Scenario: 발송 실패 — 정해진 횟수만 다시 시도, "안 보냄"과 오류로 남고 다시 보낼 수 있다."""
    from fastapi.testclient import TestClient

    from rfp_agent.api.main import app
    from rfp_agent.config import get_settings

    conn, run_id = tasks_run
    fake_mailer.fail_times = 99
    req = judged_quality_request(conn, run_id)
    review.bulk_confirm(ctx(conn), run_id, judgments_of(conn, run_id, req))
    task = quality_task(conn, run_id, req)
    assert fake_mailer.tries == MAX_RETRIES + 1 and fake_mailer.sent == []
    assert task["status"] == "TODO" and "보내지 못했습니다" in task["mail_error"]
    # 실패한 요청은 다음 확정 때 저절로 다시 보내지 않는다 (기다림 없음)
    other = conn.execute("SELECT judgment_id FROM judgment WHERE run_id = %s AND is_current "
                         "AND requirement_id <> %s LIMIT 1", (run_id, req)).fetchone()[0]
    review.act(ctx(conn), run_id, "judgment", other, "CONFIRM")
    assert fake_mailer.tries == MAX_RETRIES + 1
    fake_mailer.fail_times = 0
    task = quality_task(conn, run_id, req)            # 목록을 다시 만들면 할 일 번호가 바뀐다
    conn.commit()
    monkeypatch.setenv("DATABASE_URL", db_url)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    get_settings.cache_clear()
    try:
        result = TestClient(app).post(f"/api/runs/{run_id}/assignments/send",
                                      json={"assignment_ids": [task["assignment_id"]]}).json()
    finally:
        get_settings.cache_clear()
    assert result["sent"] == 1 and result["mails"] == 1
    again = quality_task(conn, run_id, req)
    assert again["status"] == "DOING" and again["mail_error"] is None


def test_manual_send_without_judgment(tasks_run, fake_mailer):
    """Scenario: 판정이 없는 요청 보내기 — 엔지니어가 [보내기]로 보내면 메일 1통, "메일 보냄"."""
    conn, run_id = tasks_run
    [task] = sent(conn, run_id, "QUALITY")
    assert task["text"] == TYPE_TEST
    engineer = review.default_user(conn, "ENGINEER")
    result = send_requests(conn, run_id, [task["assignment_id"]], engineer)
    assert result == {"sent": 1, "failed": 0, "no_address": 0, "mails": 1}
    assert [m["To"] for m in fake_mailer.sent] == ["quality@test"]
    assert sent(conn, run_id, "QUALITY")[0]["status"] == "DOING"
    # 같은 요청을 또 보내도 나가지 않는다
    assert send_requests(conn, run_id, [task["assignment_id"]], engineer)["sent"] == 0
    assert len(fake_mailer.sent) == 1


def test_request_without_location_is_left_out(tasks_run, fake_mailer):
    """Scenario: 원문 위치가 없는 요청 — 협조 요청과 메일에 들어가지 않는다 (CR-02)."""
    conn, run_id = tasks_run
    [task] = sent(conn, run_id, "COST")
    conn.execute("DELETE FROM requirement_location WHERE requirement_id = %s",
                 (task["requirement_id"],))
    conn.commit()
    assert sent(conn, run_id, "COST") == []
    engineer = review.default_user(conn, "ENGINEER")
    assert send_requests(conn, run_id, [task["assignment_id"]], engineer)["sent"] == 0
    assert fake_mailer.sent == []
    build_assignments(conn, run_id)
    assert conn.execute("SELECT count(*) FROM assignment WHERE run_id = %s "
                        "AND assignee_role = 'COST'", (run_id,)).fetchone()[0] == 0


def test_team_assumption_mark(tasks_run, fake_mailer):
    """Scenario: 팀 가정 표시 — 팀 가정 값이 든 제안 포인트 요청은 메일 그 줄에 "팀 가정"."""
    conn, run_id = tasks_run
    point = queries.run_proposals(conn, run_id)[0]
    conn.execute("UPDATE proposal_point SET is_assumed = TRUE WHERE point_id = %s",
                 (point["point_id"],))
    conn.commit()
    review.act(ctx(conn), run_id, "proposal_point", point["point_id"], "ADOPT")
    [mail] = fake_mailer.sent
    body = mail.get_body(("plain",)).get_content()
    assert "[여유 제안 포인트] (팀 가정)" in body
    [attachment] = list(mail.iter_attachments())
    sheet = load_workbook(BytesIO(attachment.get_content())).active
    assert sheet.cell(3, 5).value == "팀 가정"
