import os
import re
from pathlib import Path

import psycopg
import pytest

from rfp_agent.config import get_settings

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def db_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL이 없어 DB 테스트를 건너뜀")
    return url


@pytest.fixture
def empty_db(db_url: str):
    """빈 public 스키마를 가진 연결. 테스트용 DB만 가리켜야 한다."""
    with psycopg.connect(db_url) as conn:
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")
        conn.commit()
        yield conn


@pytest.fixture
def settings():
    return get_settings()


@pytest.fixture
def seeded_db(empty_db, settings):
    """마이그레이션과 규칙 사전까지 넣은 빈 DB."""
    from rfp_agent.db.migrate import migrate
    from rfp_agent.db.seed import seed_rules

    migrate(empty_db, settings.migrations_dir)
    seed_rules(empty_db, settings.seed_dir)
    empty_db.commit()
    return empty_db


# 합성 문서를 판정 대상(묶음 A)으로 보게 하는 문서 목록 행
CATALOG = [(91, "synthetic_judgment", "A"), (92, "synthetic_feeder", "A"),
           (93, "synthetic_154kV_bundle_a", "A")]


@pytest.fixture
def db(seeded_db, settings):
    """규칙 사전 + 제품표 + 합성 문서 목록까지 넣은 DB (판정 이후 단계 테스트용)."""
    from rfp_agent.db.cli import LOSS_FILE, PRODUCT_FILES
    from rfp_agent.db.seed import seed_products

    products = settings.seed_dir / "products"
    seed_products(seeded_db, [products / f for f in PRODUCT_FILES], products / LOSS_FILE)
    for file_no, key, bundle in CATALOG:
        seeded_db.execute("INSERT INTO document_catalog (file_no, file_key, bundle, language) "
                          "VALUES (%s, %s, %s, 'en')", (file_no, key, bundle))
    seeded_db.commit()
    return seeded_db


@pytest.fixture
def spec(tmp_path):
    """판정 대상 합성 데이터시트 (230 kV GIS 4,000 A 세 곳, 115 kV GIS)."""
    from tests.docx_factory import build_judgment_spec

    return build_judgment_spec(tmp_path / "synthetic_judgment.docx")


class FakeLLM:
    """언어 모델 대역. 받은 프롬프트를 모두 기록하고, 스키마에 맞는 기본 답을 낸다."""

    model = "fake-model"

    def __init__(self, fail: bool = False, text: str | None = None):
        self.fail = fail
        self.text = text            # 문장 초안 답 (없으면 자리표시자를 모두 쓴 문장)
        self.prompts: list[str] = []

    def generate_json(self, prompt: str, schema: dict) -> dict:
        self.prompts.append(prompt)
        if self.fail:
            raise TimeoutError("응답 시간 초과")
        field = next(iter(schema["properties"]))
        if field == "doc_kind":
            return {"doc_kind": "UNKNOWN"}
        if field == "explanation":
            return {"explanation": "두 값의 적용 대상이 달라 확인이 필요하다."}
        count = len(re.findall(r"^\d+\. ", prompt, re.MULTILINE))
        if field == "texts":
            lines = re.findall(r"^\d+\. .*\(자리표시자: (.*)\)$", prompt, re.MULTILINE)
            return {"texts": [self.text or "초안: " + " ".join(
                re.findall(r"\{\w+\}", marks)) for marks in lines]}
        default = {"labels": "REQUIREMENT", "types": "NONE"}[field]
        return {field: [default] * count}


@pytest.fixture
def fake_llm():
    return FakeLLM()
