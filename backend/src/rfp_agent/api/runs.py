"""검토 실행 API: 문서를 올려 실행을 시작하고, 상태와 결과(요구사항·값·위험 조건·판정·보증값·
손실 환산·일탈·질의 목록·제안 포인트)를 본다. 비교 제품 바꾸기와 손실값 고치기도 여기서 한다."""

import hashlib
import re
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from rfp_agent.config import get_settings
from rfp_agent.db.connection import connect
from rfp_agent.pipeline import queries
from rfp_agent.pipeline.loss import recalculate
from rfp_agent.pipeline.outputs import check_submission
from rfp_agent.pipeline.proposals import build_proposals
from rfp_agent.pipeline.run import switch_product
from rfp_agent.pipeline.service import make_context, run_to_end, start_run

router = APIRouter(prefix="/api", tags=["검토 실행"])


class LibraryRun(BaseModel):
    files: list[str]


class ProductChoice(BaseModel):
    product_code: str | None = None       # None이면 자동 선택으로 되돌린다


class LossValues(BaseModel):
    loss_noload_kw: float | None = Field(None, ge=0)
    loss_load_kw: float | None = Field(None, ge=0)
    loss_aux_kw: float | None = Field(None, ge=0)


class ItemStatus(BaseModel):
    status: str = Field(pattern="^(DRAFT|REMOVED)$")


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


@router.get("/runs/{run_id}/judgments")
def run_judgments(run_id: int, result: str | None = None, group: str | None = None,
                  limit: int = Query(100, le=500), offset: int = 0) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return queries.run_judgments(conn, run_id, result=result, group=group, limit=limit,
                                     offset=offset)


@router.get("/runs/{run_id}/equipment")
def run_equipment(run_id: int) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return queries.run_equipment(conn, run_id)


@router.put("/runs/{run_id}/equipment/{group:path}/product")
def choose_product(run_id: int, group: str, body: ProductChoice) -> dict:
    """설비 묶음의 비교 제품을 바꾸고 그 묶음을 다시 판정한다.

    이전 판정은 지우지 않고 현재가 아님으로 남긴다.
    """
    _summary(run_id)
    with connect() as conn:
        if conn.execute("SELECT 1 FROM judgment WHERE run_id = %s AND equipment_group = %s "
                        "LIMIT 1", (run_id, group)).fetchone() is None:
            raise HTTPException(404, f"설비 묶음 {group}이(가) 없습니다.")
        try:
            return switch_product(make_context(conn), run_id, group, body.product_code)
        except KeyError as exc:
            raise HTTPException(400, f"없는 제품: {body.product_code}") from exc


@router.get("/runs/{run_id}/warranty")
def run_warranty(run_id: int, status: str | None = None, limit: int = Query(100, le=500),
                 offset: int = 0) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return queries.run_warranty(conn, run_id, status=status, limit=limit, offset=offset)


@router.get("/runs/{run_id}/losses")
def run_losses(run_id: int) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return queries.run_losses(conn, run_id)


@router.put("/runs/{run_id}/losses/{loss_calc_id}")
def update_loss(run_id: int, loss_calc_id: int, body: LossValues) -> dict:
    """엔지니어가 손실값을 넣으면 다시 계산한다. 직접 넣은 값은 팀 가정으로 표시된다."""
    _summary(run_id)
    with connect() as conn:
        if conn.execute("SELECT 1 FROM loss_calc WHERE run_id = %s AND loss_calc_id = %s",
                        (run_id, loss_calc_id)).fetchone() is None:
            raise HTTPException(404, f"손실 환산 {loss_calc_id}이(가) 없습니다.")
        result = recalculate(conn, loss_calc_id, body.loss_noload_kw, body.loss_load_kw,
                             body.loss_aux_kw)
        build_proposals(conn, run_id, make_context(conn).llm)
        conn.commit()
        return result


@router.get("/runs/{run_id}/outputs")
def run_outputs(run_id: int, list_kind: str | None = None) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return queries.run_outputs(conn, run_id, list_kind)


@router.put("/runs/{run_id}/outputs/{item_id}/status")
def set_output_status(run_id: int, item_id: int, body: ItemStatus) -> dict:
    """목록 항목을 빼거나(REMOVED) 되돌린다(DRAFT). 확정·승인은 4단계에서 한다."""
    _summary(run_id)
    with connect() as conn:
        updated = conn.execute(
            "UPDATE output_item SET status = %s WHERE run_id = %s AND item_id = %s "
            "AND status IN ('DRAFT', 'REMOVED')", (body.status, run_id, item_id)).rowcount
        if not updated:
            raise HTTPException(404, f"바꿀 수 있는 목록 항목 {item_id}이(가) 없습니다.")
        conn.commit()
        return check_submission(conn, run_id)


@router.get("/runs/{run_id}/submission-check")
def get_submission_check(run_id: int) -> dict:
    _summary(run_id)
    with connect() as conn:
        result = queries.submission_check(conn, run_id)
    if result is None:
        raise HTTPException(404, "아직 누락 점검 결과가 없습니다.")
    return result


@router.post("/runs/{run_id}/submission-check")
def run_submission_check(run_id: int) -> dict:
    _summary(run_id)
    with connect() as conn:
        return check_submission(conn, run_id)


@router.get("/runs/{run_id}/proposals")
def run_proposals(run_id: int) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return queries.run_proposals(conn, run_id)
