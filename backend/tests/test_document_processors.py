"""문서 종류별 처리기, 처리 뒤 점검과 한 번 다시 처리, 문서 병렬 처리.

change add-document-processors (C1).

명세 document-intake "문서 종류별 처리기"·"처리 뒤 점검과 한 번 다시 처리"·"문서 병렬 처리",
requirement-extraction "AI 질문의 문서 종류 설명", review-run "다시 처리한 문서 수"의 Scenario.
"""

from pathlib import Path
from types import SimpleNamespace

import pytest
from docx import Document

from rfp_agent.pipeline import dictionaries, queries, run_control
from rfp_agent.pipeline import run as run_mod
from rfp_agent.pipeline.document import process_document
from rfp_agent.pipeline.run import RunContext, create_run, execute_run
from rfp_agent.pipeline.run_log import run_log
from tests.conftest import FakeLLM
from tests.docx_factory import build_gis_spec, build_judgment_spec

VERSION = "test-dict-v1"
LABEL = "RFP의 한 절에서"
TYPE = "유형 하나를 고른다"


def letters(path: Path) -> Path:
    """표 없이 요구 문장만 있는 문서 (입찰 서식 이름이면 점검에 걸린다)."""
    doc = Document()
    doc.add_paragraph("INSTRUCTIONS")
    doc.add_paragraph("1. GENERAL")
    doc.add_paragraph("The bidder shall submit the completed forms with the bid.")
    doc.add_paragraph("The equipment shall withstand the specified dielectric tests.")
    doc.add_paragraph("The contractor shall provide spare parts for five years of operation.")
    doc.add_paragraph("2. DOCUMENTS")
    doc.add_paragraph("The bidder shall provide the type test reports for all equipment.")
    doc.add_paragraph("The vendor shall supply operation and maintenance manuals in English.")
    doc.add_paragraph("All drawings shall be submitted for approval before manufacture.")
    doc.add_paragraph("3. PACKING")
    doc.add_paragraph("All equipment shall be packed for sea transport and long storage.")
    doc.add_paragraph("Each package shall be marked with the contract number and weight.")
    doc.save(str(path))
    return path


def document_row(conn, document_id):
    return conn.execute("SELECT processor, process_check, reprocessed, needs_review FROM document "
                        "WHERE document_id = %s", (document_id,)).fetchone()


def process(conn, path, llm):
    return process_document(conn, path, dictionaries.load(conn), VERSION, llm, None)


def test_bid_form_uses_bid_form_processor(db, tmp_path):
    """Scenario: 입찰 서식은 입찰 서식 처리기 — 질문에 입찰 서식 설명, 점검 통과."""
    llm = FakeLLM()
    result = process(db, build_gis_spec(tmp_path / "Bidding Forms_gis.docx"), llm)
    assert document_row(db, result.document_id)[:3] == ("BID_FORM", None, False)
    labels = [p for p in llm.prompts if LABEL in p]
    assert labels and all(p.startswith("문서 종류: 입찰 서식") for p in labels)


def test_unknown_uses_general_processor(db, tmp_path):
    """Scenario: 종류 모름은 일반 처리기 — 질문에 문서 종류 설명이 없다."""
    llm = FakeLLM()
    result = process(db, letters(tmp_path / "misc_notes.docx"), llm)
    assert document_row(db, result.document_id)[0] == "GENERAL"
    asked = [p for p in llm.prompts if LABEL in p or TYPE in p]
    assert asked and not any(p.startswith("문서 종류:") for p in asked)


def test_failed_check_reprocesses_once(db, tmp_path):
    """Scenario: 점검에 걸린 입찰 서식 — 일반 처리기로 한 번 다시, 이유·확인 필요."""
    llm = FakeLLM()
    result = process(db, letters(tmp_path / "Bidding Forms_letters.docx"), llm)
    processor, check, again, review = document_row(db, result.document_id)
    assert (processor, again, review) == ("GENERAL", True, True)
    assert check == "입찰 서식인데 표 칸 요구값이 하나도 없습니다"
    assert result.reprocessed is True
    labels = [p for p in llm.prompts if LABEL in p]
    hinted = [p for p in labels if p.startswith("문서 종류: 입찰 서식")]
    assert hinted and len(labels) == 2 * len(hinted)      # 처음 한 번 + 일반으로 한 번
    assert db.execute("SELECT count(*) FROM document").fetchone()[0] == 1


def test_failed_check_without_ai(db, tmp_path):
    """Scenario: AI 없이 점검에 걸림 — 다시 처리하지 않고 이유·확인 필요만."""
    result = process(db, letters(tmp_path / "Bidding Forms_letters.docx"), None)
    assert document_row(db, result.document_id) == (
        "BID_FORM", "입찰 서식인데 표 칸 요구값이 하나도 없습니다", False, True)


def test_passing_check(db, tmp_path):
    """Scenario: 점검을 통과한 문서 — 이유가 비고 다시 처리하지 않는다."""
    result = process(db, build_gis_spec(tmp_path / "Bidding Forms_gis.docx"), None)
    processor, check, again, _ = document_row(db, result.document_id)
    assert (processor, check, again) == ("BID_FORM", None, False)


def test_test_spec_type_question_has_hint(db, tmp_path):
    """Scenario: 시험 사양서 유형 질문 — 질문 첫머리에 시험 사양서 설명."""
    llm = FakeLLM()
    process(db, letters(tmp_path / "testing_procedure.docx"), llm)
    typed = [p for p in llm.prompts if TYPE in p]
    assert typed and typed[0].startswith("문서 종류: 시험 사양서")


def workers(monkeypatch, n):
    monkeypatch.setattr(run_mod, "get_settings", lambda: SimpleNamespace(rfp_doc_workers=n))


def run_with(db, version, paths):
    run_id = create_run(db, version, None)
    assert execute_run(RunContext(db, version, None, None), run_id, paths) == "ENGINEER_REVIEW"
    return run_id


def summary(db, run_id):
    ids = [d["document_id"] for d in queries.run_documents(db, run_id)]
    reqs, dedup = db.execute("SELECT count(*), count(dedup_of) FROM requirement "
                             "WHERE document_id = ANY(%s)", (ids,)).fetchone()
    reps = db.execute("""SELECT d.file_name FROM requirement r
                           JOIN requirement p ON p.requirement_id = r.dedup_of
                           JOIN document d ON d.document_id = p.document_id
                          WHERE r.document_id = ANY(%s) GROUP BY 1 ORDER BY 1""",
                      (ids,)).fetchall()
    pairs = db.execute("SELECT count(*) FROM document_pair WHERE document_id_a = ANY(%s)",
                       (ids,)).fetchone()[0]
    return reqs, dedup, reps, pairs, queries.run_summary(db, run_id)["judgments"]


def test_parallel_matches_sequential(db, spec, tmp_path, monkeypatch):
    """Scenario: 병렬과 차례 결과가 같음 — 요구·묶음·쌍 후보·판정 수."""
    second = build_judgment_spec(tmp_path / "second_datasheet.docx")
    workers(monkeypatch, 1)
    seq = summary(db, run_with(db, "v-seq", [spec, second]))
    workers(monkeypatch, 2)
    par = summary(db, run_with(db, "v-par", [spec, second]))
    assert seq == par
    assert seq[1] > 0 and seq[2] == [(spec.name,)]     # 두 번째 문서 줄이 첫 문서 줄로 묶임


def test_parallel_one_document_fails(db, spec, tmp_path, monkeypatch):
    """Scenario: 한 문서 실패 — 실패로 끝나고 첫 문서는 저장되어 다시 시도 때 다시 쓰인다."""
    workers(monkeypatch, 2)
    second = build_judgment_spec(tmp_path / "second_datasheet.docx")
    real = run_mod.process_document
    calls = []

    def fail_second(conn, path, *args, **kwargs):
        calls.append(path.name)
        if path.name == second.name and calls.count(second.name) == 1:
            raise RuntimeError("두 번째 문서에서 멈춤")
        return real(conn, path, *args, **kwargs)

    monkeypatch.setattr(run_mod, "process_document", fail_second)
    run_id = create_run(db, VERSION, None)
    assert execute_run(RunContext(db, VERSION, None, None), run_id, [spec, second]) == "FAILED"
    [(first_doc,)] = db.execute("SELECT document_id FROM document").fetchall()
    paths, choices = run_control.prepare_retry(db, run_id, None)
    assert execute_run(RunContext(db, VERSION, None, None), run_id, paths, choices) \
        == "ENGINEER_REVIEW"
    docs = [d["document_id"] for d in queries.run_documents(db, run_id)]
    assert first_doc in docs and len(docs) == 2


def test_run_log_counts_reprocessed(db, spec, tmp_path):
    """Scenario: 다시 처리한 문서가 있는 검토 — 실행 기록 다시 처리 문서 수 1."""
    llm = FakeLLM()
    run_id = create_run(db, VERSION, llm)
    paths = [spec, letters(tmp_path / "Bidding Forms_letters.docx")]
    assert execute_run(RunContext(db, VERSION, llm, None), run_id, paths) == "ENGINEER_REVIEW"
    [row] = [r for r in run_log(db) if r["run_id"] == run_id]
    assert row["documents_reprocessed"] == 1


@pytest.mark.parametrize("kind", ["REQUIREMENT_SPEC", "PURCHASE_SPEC", "SUPPLIER_SPEC"])
def test_every_kind_has_check(kind):
    """처리기 표: 종류마다 설명과 점검이 있다 (일반 처리기는 둘 다 없음)."""
    from rfp_agent.pipeline.processors import GENERAL, processor_for
    proc = processor_for(kind)
    assert proc.hint and proc.check and proc is not GENERAL
    assert processor_for("UNKNOWN") is GENERAL and GENERAL.check is None
