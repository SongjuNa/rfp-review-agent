"""실제 RFP 문서로 명세 Scenario를 확인한다.

원문은 고객 자료라 저장소에 없다 (data/private). 원문·txt·테스트 DB가 모두 있을 때만 돈다.
줄 번호는 팀 추출 txt 기준이다.
"""

import os

import psycopg
import pytest

from rfp_agent.config import get_settings
from rfp_agent.db.migrate import migrate
from rfp_agent.db.seed import dict_version, seed_rules
from rfp_agent.pipeline import queries
from rfp_agent.pipeline.run import RunContext, create_run, execute_run
from tests.conftest import FakeLLM

SETTINGS = get_settings()
FILES = {
    1: "1. Bidding Forms_Draft", 2: "6. Section6_Employers", 3: "문서검토_115kV GIS_",
    6: "Attachment 4.1", 8: "Attachment.05", 13: "26 13 00 fl", 18: "262000 Electric",
    19: "제1장_설계기준", 22: "제8장_154kV",
}

pytestmark = pytest.mark.skipif(
    not (SETTINGS.docx_dir.exists() and SETTINGS.txt_dir.exists()
         and os.environ.get("TEST_DATABASE_URL")),
    reason="RFP 원문(data/private)이나 TEST_DATABASE_URL이 없어 실제 문서 테스트를 건너뜀",
)


def path_of(file_no: int):
    return next(p for p in SETTINGS.docx_dir.glob("*.docx") if FILES[file_no] in p.name)


@pytest.fixture(scope="module")
def conn():
    with psycopg.connect(os.environ["TEST_DATABASE_URL"]) as conn:
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")
        conn.commit()
        migrate(conn, SETTINGS.migrations_dir)
        seed_rules(conn, SETTINGS.seed_dir)
        conn.commit()
        yield conn


def run(conn, file_nos, llm=None):
    version = dict_version(SETTINGS.seed_dir)
    run_id = create_run(conn, version, llm)
    stage = execute_run(RunContext(conn, version, llm, SETTINGS.txt_dir), run_id,
                        [path_of(n) for n in file_nos])
    assert stage == "ENGINEER_REVIEW"
    return run_id


@pytest.fixture(scope="module")
def main_run(conn):
    return run(conn, [1, 3, 6, 8, 13, 18])


def requirement_at(conn, run_id, file_no, line):
    row = conn.execute(
        """SELECT q.requirement_id FROM requirement q
           JOIN run_document rd ON rd.document_id = q.document_id AND rd.run_id = %s
           JOIN document d ON d.document_id = q.document_id AND d.file_no = %s
           JOIN requirement_location rl ON rl.requirement_id = q.requirement_id
           JOIN source_location l ON l.location_id = rl.location_id
           WHERE l.line_start <= %s AND COALESCE(l.line_end, l.line_start) >= %s
           ORDER BY l.line_start DESC LIMIT 1""", (run_id, file_no, line, line)).fetchone()
    assert row, f"파일 {file_no} {line}행 요구사항 없음"
    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        req = cur.execute("SELECT * FROM requirement WHERE requirement_id = %s",
                          (row[0],)).fetchone()
    return queries._attach(conn, [req])[0]


def document(conn, run_id, file_no):
    return next(d for d in queries.run_documents(conn, run_id) if d["file_no"] == file_no)


# ---------------------------------------------------------------- FR-01

def test_bid_form_classification(conn, main_run):
    d = document(conn, main_run, 1)
    assert (d["bundle"], d["doc_kind"], d["judge_target"], d["standard_system"]) == (
        "A", "BID_FORM", True, "IEC")
    assert d["line_basis"] == "TXT"


def test_us_spec_is_not_judged(conn, main_run):
    d = document(conn, main_run, 13)
    assert (d["bundle"], d["doc_kind"], d["judge_target"], d["standard_system"]) == (
        "C", "REQUIREMENT_SPEC", False, "IEEE_UL")


def test_image_only_document(conn, main_run):
    d = document(conn, main_run, 8)
    assert (d["readable"], d["requirements"]) == (False, 0)


# ---------------------------------------------------------------- FR-02

def test_toc_and_body(conn, main_run):
    doc_id = document(conn, main_run, 3)["document_id"]
    rows = conn.execute("SELECT line_start, is_toc FROM section WHERE document_id = %s AND "
                        "title LIKE 'CLARIFICATION, EXCEPTION%%' ORDER BY line_start",
                        (doc_id,)).fetchall()
    assert rows == [(18, True), (188, False)]


def test_split_gis_table(conn, main_run):
    doc_id = document(conn, main_run, 1)["document_id"]
    [(table_id, nos)] = conn.execute(
        "SELECT table_id, source_table_nos FROM doc_table WHERE document_id = %s "
        "AND table_name = 'TS-115-GIS'", (doc_id,)).fetchall()
    assert len(nos) >= 4                    # 쪽 넘김으로 나뉜 Word 표 여러 개 (원문 docx는 8개)
    items = [r[0] for r in conn.execute(
        "SELECT item_no FROM table_row WHERE table_id = %s ORDER BY row_order", (table_id,))]
    # 로마 숫자 구분 행(I, II, …)마다 번호가 다시 시작한다. 첫 구분(I)은 1~27이 끊김 없이 이어진다.
    part_one = items[items.index("I") + 1:items.index("II")]
    assert [int(i) for i in part_one if i.isdigit()] == list(range(1, 28))
    children = conn.execute(
        "SELECT c.item_no FROM table_row c JOIN table_row p ON p.row_id = c.parent_row_id "
        "WHERE c.table_id = %s AND p.item_no = '20' ORDER BY c.row_order", (table_id,)).fetchall()
    assert [c[0] for c in children] == ["20-1", "20-2", "20-3"]
    assert not any(i and i.strip().lower().startswith("no") for i in items)


# ---------------------------------------------------------------- FR-03·04·05

def test_datasheet_row_7459(conn, main_run):
    req = requirement_at(conn, main_run, 1, 7459)
    assert req["source_kind"] == "TABLE_CELL"
    [loc] = [x for x in req["locations"] if x["file_no"] == 1]
    assert (loc["table_name"], loc["item_no"]) == ("TS-115-GIS", "16")
    [v] = req["values"]
    assert (float(v["num_value"]), v["unit_raw"], float(v["cond_time_s"]), v["item_key"]) == (
        40, "kA", 1, "short_time_current")


def test_writing_rule_7419(conn, main_run):
    assert requirement_at(conn, main_run, 1, 7419)["req_kind"] == "WRITING_RULE"


def test_loss_clause_types_8238(conn, main_run):
    types = requirement_at(conn, main_run, 1, 8238)["types"]
    assert [(t["type_code"], t["is_primary"]) for t in types][:2] == [
        ("COST", True), ("TECH_PERF", False)]


def test_supplier_marks_are_separate(conn, main_run):
    req = requirement_at(conn, main_run, 18, 208)
    assert req["supplier_mark"] == "C"
    assert req["source_kind"] == "SUPPLIER_ANSWER"


def test_fahrenheit_and_celsius_kept(conn, main_run):
    values = requirement_at(conn, main_run, 13, 113)["values"]
    units = [(float(v["num_value"]), v["unit_raw"]) for v in values]
    assert (104, "deg F") in units and (40, "deg C") in units


# ---------------------------------------------------------------- FR-06

def risks(conn, run_id, kind):
    return [r for r in queries.run_risks(conn, run_id) if r["risk_kind"] == kind]


def member_lines(risk):
    return sorted((loc["file_no"], loc["line_start"]) for m in risk["members"]
                  for loc in m["locations"])


def test_deemed_to_be_accepted(conn, main_run):
    hits = [r for r in risks(conn, main_run, "BLANKET") if (3, 190) in member_lines(r)]
    assert len(hits) == 1 and hits[0]["expression"] == "deemed"


def test_gas_leakage_mismatch(conn, main_run):
    [hit] = [r for r in risks(conn, main_run, "VALUE_MISMATCH")
             if r["item_key"] == "gas_leakage_rate"]
    assert member_lines(hit) == [(6, 174), (6, 278)]
    assert "적용 대상과 근거 규격이 다름" in hit["facts"]


def test_ambient_temperature_is_not_a_candidate(conn, main_run):
    assert not [r for r in risks(conn, main_run, "VALUE_MISMATCH")
                if r["item_key"] == "ambient_temp_max" and member_lines(r)[0][0] == 1]


def test_ups_capacity_across_documents(conn):
    run_id = run(conn, [19, 22])
    hits = [r for r in risks(conn, run_id, "VALUE_MISMATCH") if r["item_key"] == "rated_capacity"]
    assert [member_lines(r) for r in hits] == [[(19, 301), (22, 3008)]]


def test_pair_candidate_and_section_sized_ai_inputs(conn):
    llm = FakeLLM()
    run_id = run(conn, [1, 2], llm=llm)
    [pair] = queries.run_pairs(conn, run_id)
    assert (pair["file_no_a"], pair["file_no_b"], pair["status"]) == (1, 2, "CANDIDATE")
    assert "데이터시트 항목" in pair["evidence"]
    label_prompts = [p for p in llm.prompts if "절 제목:" in p]
    assert label_prompts and all(p.count("절 제목:") == 1 for p in label_prompts)
    assert max(len(p) for p in llm.prompts) < 40_000
