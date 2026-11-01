from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    database_url: str = "postgresql://rfp:rfp@localhost:5433/rfp"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.8-flash"
    # AI 묶음 동시 호출 개수와 요청 하나의 시간 제한(초) (update-llm-concurrency, NFR-10)
    rfp_llm_workers: int = 4
    rfp_llm_timeout_s: float = 120
    migrations_dir: Path = REPO_ROOT / "db" / "migrations"
    seed_dir: Path = REPO_ROOT / "data" / "seed"
    # RFP 원문처럼 저장소에 올리지 않는 자료 (data/private/README.md)
    private_data_dir: Path = REPO_ROOT / "data" / "private"
    # 협조 요청 메일 (update-role-handoff-mail). 시연·개발은 Mailpit, 실제 사내 서버는 값만 바꾼다.
    rfp_smtp_host: str | None = None
    rfp_smtp_port: int = 1025
    rfp_smtp_user: str | None = None
    rfp_smtp_password: str | None = None
    rfp_mail_from: str = "rfp-agent@example.com"
    rfp_mail_cost: str | None = None
    rfp_mail_quality: str | None = None
    rfp_mail_sales: str | None = None

    @property
    def docx_dir(self) -> Path:
        return self.private_data_dir / "rfp_docx"

    @property
    def upload_dir(self) -> Path:
        """화면에서 올린 RFP 원문 (git에 올리지 않는 data/private 아래)."""
        return self.private_data_dir / "uploads"

    @property
    def txt_dir(self) -> Path:
        """팀 추출 txt. 있으면 원문 위치 줄 번호를 이 txt에 맞춘다."""
        return self.private_data_dir / "rfp_txt"


@lru_cache
def get_settings() -> Settings:
    return Settings()
