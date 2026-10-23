import os
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
