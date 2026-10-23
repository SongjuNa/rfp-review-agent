"""검토 실행 API: 문서를 올려 실행을 시작하고, 상태와 결과(요구사항·값·위험 조건)를 본다."""

import hashlib
import re
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, UploadFile
from pydantic import BaseModel

from rfp_agent.config import get_settings
from rfp_agent.db.connection import connect
from rfp_agent.pipeline import queries
from rfp_agent.pipeline.service import run_to_end, start_run

router = APIRouter(prefix="/api", tags=["검토 실행"])


class LibraryRun(BaseModel):
    files: list[str]


def _summary(run_id: int) -> dict:
    with connect() as conn:
        summary = queries.run_summary(conn, run_id)
    if summary is None:
        raise HTTPException(404, f"검토 실행 {run_id}이(가) 없습니다.")
    return summary


def _start(paths: list[Path], background: BackgroundTasks) -> dict:
    with connect() as conn:
        run_id = start_run(conn)
    background.add_task(run_to_end, run_id, paths)
    return _summary(run_id)


def _safe_name(name: str) -> str:
    name = Path(name).name
    if not name.lower().endswith(".docx") or re.search(r"[\x00/\\]", name):
        raise HTTPException(400, f"docx 파일만 받습니다: {name}")
    return name


@router.get("/library")
def library() -> list[str]:
    """서버에 미리 둔 RFP 원문(data/private/rfp_docx) 목록."""
    docx_dir = get_settings().docx_dir
    return sorted(p.name for p in docx_dir.glob("*.docx")) if docx_dir.exists() else []


@router.post("/runs/library", status_code=202)
def run_library(body: LibraryRun, background: BackgroundTasks) -> dict:
    docx_dir = get_settings().docx_dir
    paths = [docx_dir / _safe_name(name) for name in body.files]
    missing = [p.name for p in paths if not p.exists()]
    if not paths or missing:
        raise HTTPException(400, f"없는 파일: {', '.join(missing) or '(파일 없음)'}")
    return _start(paths, background)


@router.post("/runs", status_code=202)
async def run_upload(files: list[UploadFile], background: BackgroundTasks) -> dict:
    """올린 docx로 검토를 시작한다.

    파일은 내용 해시 폴더에 저장해 같은 파일이면 다시 처리하지 않는다.
    """
    upload_dir = get_settings().upload_dir
    paths = []
    for f in files:
        name = _safe_name(f.filename or "")
        data = await f.read()
        target = upload_dir / hashlib.sha256(data).hexdigest()[:16] / name
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_bytes(data)
        paths.append(target)
    if not paths:
        raise HTTPException(400, "파일이 없습니다.")
    return _start(paths, background)


@router.get("/runs/{run_id}")
def run_status(run_id: int) -> dict:
    return _summary(run_id)


@router.get("/runs/{run_id}/documents")
def run_documents(run_id: int) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return queries.run_documents(conn, run_id)


@router.get("/runs/{run_id}/pairs")
def run_pairs(run_id: int) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return queries.run_pairs(conn, run_id)


@router.get("/runs/{run_id}/requirements")
def run_requirements(run_id: int, document_id: int | None = None, type_code: str | None = None,
                     limit: int = Query(100, le=500), offset: int = 0) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return queries.run_requirements(conn, run_id, document_id=document_id,
                                        type_code=type_code, limit=limit, offset=offset)


@router.get("/runs/{run_id}/risks")
def run_risks(run_id: int) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return queries.run_risks(conn, run_id)
