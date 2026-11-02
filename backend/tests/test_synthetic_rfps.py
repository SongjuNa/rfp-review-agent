"""시연용 합성 RFP (change add-synthetic-risk-rfp).

명세 reference-data "시연용 합성 RFP"의 Scenario. 합성 RFP 원문은 저장소에 없다(data/private).
원문과 TEST_DATABASE_URL이 있을 때만 돈다(test_corpus와 같음).
파일 27은 generate_risk_rfp.py로 만든다.
"""

import os

import pytest

from rfp_agent.config import get_settings
from rfp_agent.db.seed import seed_products
from rfp_agent.pipeline import classify as cls
from rfp_agent.pipeline import dictionaries, queries
from rfp_agent.pipeline.docx_reader import read_blocks
from rfp_agent.pipeline.run import RunContext, create_run, execute_run

FILE_27 = get_settings().docx_dir / "RFP_Product_Master_Evaluative_EN_With_Risk_Clauses.docx"

pytestmark = pytest.mark.skipif(
    not (FILE_27.exists() and os.environ.get("TEST_DATABASE_URL")),
    reason="합성 RFP 파일 27(data/private)이 없어 건너뜀 — generate_risk_rfp.py로 만든다",
)
VERSION = "test-dict-v1"


def test_synthetic_rfp_classification(db):
    """Scenario: 합성 RFP 분류 — 파일 27, 묶음 B, 요구 사양서, 판정 대상."""
    dicts = dictionaries.load(db)
    c = cls.classify(FILE_27.name, read_blocks(FILE_27), dicts.catalog, dicts.kind_rules)
    assert (c.file_no, c.bundle, c.doc_kind, c.judge_target) == (27, "B", "REQUIREMENT_SPEC", True)


def test_risk_clause_variant(db):
    """Scenario: 위험 조항 변형 — 포괄 조항·범위 모호·값 불일치, 일탈 후보 10, 협조 요청."""
    # 합성 RFP는 실제 제품표로 만들었으므로 실제 제품표로 판정한다 (테스트 고정 제품표가 아니라)
    seed_products(db, [get_settings().seed_dir / "products" / "product_master.csv"], replace=True)
    run_id = create_run(db, VERSION, None)
    assert execute_run(RunContext(db, VERSION, None, None), run_id, [FILE_27]) == "ENGINEER_REVIEW"
    kinds = {k for (k,) in db.execute("SELECT DISTINCT risk_kind FROM risk_flag WHERE run_id = %s",
                                      (run_id,))}
    assert {"BLANKET", "OPEN_SCOPE", "VALUE_MISMATCH"} <= kinds
    assert queries.run_summary(db, run_id)["deviation_candidates"] == 10
    roles = {r for (r,) in db.execute("SELECT DISTINCT assignee_role FROM assignment "
                                      "WHERE run_id = %s", (run_id,))}
    assert {"COST", "QUALITY", "SALES"} <= roles
