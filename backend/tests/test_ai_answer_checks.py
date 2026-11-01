"""AI 답 검사 보강 (change update-ai-answer-checks).

명세 evidence-integrity "버린 AI 설명의 이유", review-run "버린 AI 설명 건수",
bid-outputs "초안의 자리표시자 모두 쓰기", proposal-points "제안 문장의 자리표시자 모두 쓰기".
줄 번호·숫자 허용 단위 시험은 tests/test_llm.py.
"""

import re

from rfp_agent.llm import tasks
from rfp_agent.pipeline import queries
from rfp_agent.pipeline.run import RunContext, create_run, execute_run
from rfp_agent.pipeline.run_log import run_log
from tests.conftest import FakeLLM
from tests.docx_factory import build_gis_spec

VERSION = "test-dict-v1"


def run_once(conn, paths, llm):
    run_id = create_run(conn, VERSION, llm)
    assert execute_run(RunContext(conn, VERSION, llm, None), run_id, paths) == "ENGINEER_REVIEW"
    return run_id


class InventedNumberLLM(FakeLLM):
    """위험 조건 설명에 근거에 없는 숫자(9999)를 넣는다."""

    def generate_json(self, prompt, schema):
        answer = super().generate_json(prompt, schema)
        if "claims" in answer:
            answer["claims"][0]["text"] = "허용값이 9999로 다르다."
        return answer


def test_dropped_reason_is_saved_and_counted(seeded_db, tmp_path):
    """Scenario: 버린 이유 저장 · Scenario: 버린 설명 건수."""
    gis = build_gis_spec(tmp_path / "synthetic_154kV_GIS_spec.docx")
    run_id = run_once(seeded_db, [gis], InventedNumberLLM())
    risks = queries.run_risks(seeded_db, run_id)
    assert risks
    for r in risks:
        assert r["explanation_ai"] is None
        assert r["explanation_drop_reason"] == tasks.NUMBER_NOT_ALLOWED
    [log] = [r for r in run_log(seeded_db) if r["run_id"] == run_id]
    assert log["explanations_dropped"] == len(risks)


def test_kept_explanation_has_no_reason(seeded_db, tmp_path):
    """Scenario: 통과한 설명은 이유 없음."""
    gis = build_gis_spec(tmp_path / "synthetic_154kV_GIS_spec.docx")
    run_id = run_once(seeded_db, [gis], FakeLLM())
    risks = queries.run_risks(seeded_db, run_id)
    assert risks and all(r["explanation_ai"] and r["explanation_drop_reason"] is None
                         for r in risks)
    [log] = [r for r in run_log(seeded_db) if r["run_id"] == run_id]
    assert log["explanations_dropped"] == 0


class FirstMarkOnlyLLM(FakeLLM):
    """문장 초안에 자리표시자를 첫 번째 하나만 쓴다."""

    def generate_json(self, prompt, schema):
        answer = super().generate_json(prompt, schema)
        if "texts" in answer:
            for a in answer["texts"]:
                a["text"] = "초안: " + re.findall(r"\{\w+\}", a["text"])[0]
        return answer


def test_draft_missing_placeholder_uses_code_sentence(db, spec):
    """Scenario: 자리표시자가 빠진 초안 — 그 줄만 코드 기본 문장, 처리는 끝까지 간다."""
    run_id = run_once(db, [spec], FirstMarkOnlyLLM())
    deviations = queries.run_outputs(db, run_id, "DEVIATION")
    assert deviations
    for row in deviations:
        assert row["drafted_by"] == "CODE" and row["number_check"] == "OK"
        assert "요구를 그대로 맞추지 못합니다" in row["text_draft"]
    # 자리표시자가 하나뿐인 줄(위험 표현 질의 등)은 첫 자리표시자만 써도 다 쓴 것이라 AI 문장
    singles = [r for r in queries.run_outputs(db, run_id) if r["drafted_by"] == "AI"]
    assert all(r["text_draft"].startswith("초안: ") for r in singles)


def test_draft_with_every_placeholder_is_ai(db, spec):
    """Scenario: 자리표시자를 다 쓴 초안 — 작성 주체 AI."""
    run_id = run_once(db, [spec], FakeLLM())
    rows = queries.run_outputs(db, run_id)
    assert rows and all(r["drafted_by"] == "AI" for r in rows)


class CompetitorLLM(FakeLLM):
    """제안 문장에 자리표시자를 다 쓰되 경쟁 비교를 넣는다."""

    def generate_json(self, prompt, schema):
        answer = super().generate_json(prompt, schema)
        if "texts" in answer and "기술 제안 포인트" in prompt:
            for a in answer["texts"]:
                a["text"] = a["text"] + " 타사보다 낫다."
        return answer


def test_proposal_with_competitor_uses_code_sentence(db, spec):
    """Scenario: 경쟁 비교가 든 제안 문장 — 그 포인트는 코드 기본 문장, 처리는 멈추지 않는다."""
    run_id = run_once(db, [spec], CompetitorLLM())
    points = [p for p in queries.run_proposals(db, run_id) if p["point_kind"] != "FIELD"]
    assert points
    assert all(p["drafted_by"] == "CODE" and "타사" not in p["text_draft"] for p in points)
