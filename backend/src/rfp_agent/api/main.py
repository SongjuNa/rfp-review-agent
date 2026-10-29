import json
import logging
import sys

from fastapi import FastAPI, Request
from fastapi.exceptions import ResponseValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from rfp_agent.api import reference, runs
from rfp_agent.config import get_settings
from rfp_agent.db.connection import connect

app = FastAPI(title="RFP 기술 검토 지원 API", version="0.2.0")
app.include_router(runs.router)
app.include_router(reference.router)

log = logging.getLogger(__name__)


@app.exception_handler(ResponseValidationError)
def bad_response(request: Request, exc: ResponseValidationError) -> JSONResponse:
    """모양이 틀린 응답은 내보내지 않는다 (api-contract). 값은 로그에 남기지 않는다(원문 문장)."""
    fields = sorted({".".join(str(p) for p in e["loc"]) + f" ({e['type']})"
                     for e in exc.errors()})
    log.error("응답 모양이 맞지 않음: %s %s — %s", request.method, request.url.path,
              "; ".join(fields[:20]))
    return JSONResponse({"detail": "서버 응답이 정해진 모양과 맞지 않아 보내지 않았습니다."},
                        status_code=500)


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


def dump_openapi() -> None:
    """`rfp-openapi`: 응답 스키마(/openapi.json)를 표준 출력으로 낸다. DB 없이 돈다."""
    json.dump(app.openapi(), sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
