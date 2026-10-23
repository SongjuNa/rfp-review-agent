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
