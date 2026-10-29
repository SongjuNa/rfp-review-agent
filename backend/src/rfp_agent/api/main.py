from fastapi import FastAPI
from pydantic import BaseModel

from rfp_agent.api import reference, runs
from rfp_agent.config import get_settings
from rfp_agent.db.connection import connect

app = FastAPI(title="RFP 기술 검토 지원 API", version="0.2.0")
app.include_router(runs.router)
app.include_router(reference.router)


class Health(BaseModel):
    status: str
    database: str
    schema_version: str | None
    llm_configured: bool


@app.get("/api/health", response_model=Health)
def health() -> Health:
    settings = get_settings()
    try:
        with connect() as conn:
            row = conn.execute(
                "SELECT max(version) FROM schema_migration"
            ).fetchone()
        database, version = "ok", row[0] if row else None
    except Exception:  # noqa: BLE001 - 상태 점검은 어떤 DB 오류든 "down"으로 알린다
        database, version = "down", None
    return Health(
        status="ok" if database == "ok" else "degraded",
        database=database,
        schema_version=version,
        llm_configured=bool(settings.gemini_api_key),
    )
