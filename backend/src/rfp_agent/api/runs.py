"""검토 실행 API: 문서를 올려 실행을 시작하고, 상태와 결과(요구사항·값·위험 조건·판정·보증값·
손실 환산·일탈·질의 목록·제안 포인트)를 본다. 비교 제품 바꾸기, 손실값 고치기,
확인·승인(FR-10)도 여기서 한다."""

import hashlib
import re
from datetime import date
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, Field

from rfp_agent.config import get_settings
from rfp_agent.db.connection import connect
from rfp_agent.pipeline import queries, read_checks, review, review_info
from rfp_agent.pipeline.assignments import build_assignments
from rfp_agent.pipeline.export import outputs_docx
from rfp_agent.pipeline.loss import recalculate
from rfp_agent.pipeline.outputs import check_submission
from rfp_agent.pipeline.proposals import build_proposals
from rfp_agent.pipeline.run import switch_product
from rfp_agent.pipeline.service import make_context, run_to_end, start_run

router = APIRouter(prefix="/api", tags=["검토 실행"])
DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


class ReviewInfo(BaseModel):
    """검토 정보. 보낸 칸만 바꾸고 빈 문자열은 비우기로 본다 (add-review-info)."""
    project_name: str | None = Field(None, max_length=200)
    review_name: str | None = Field(None, max_length=200)
    customer_name: str | None = Field(None, max_length=200)
    country: str | None = Field(None, max_length=60)
    due_date: date | str | None = None
    engineer_id: int | None = None
    actor_id: int | None = None

    def info(self) -> dict:
        return self.model_dump(exclude_unset=True, exclude={"actor_id"})


class LibraryRun(ReviewInfo):
    files: list[str]


class ProductChoice(BaseModel):
    product_code: str | None = None       # None이면 자동 선택으로 되돌린다


class LossValues(BaseModel):
    loss_noload_kw: float | None = Field(None, ge=0)
    loss_load_kw: float | None = Field(None, ge=0)
    loss_aux_kw: float | None = Field(None, ge=0)


class Action(BaseModel):
    target: str     # judgment, warranty_candidate, output_item, proposal_point, risk_flag
    target_id: int
    action: str                     # CONFIRM, EDIT, REJECT, ADOPT, DISCARD
    value: dict | None = None       # EDIT: {"result"} / {"value", "unit"} / {"text"}
    reason: str | None = None
    actor_id: int | None = None


class BulkAction(BaseModel):
    target: str = "judgment"
    ids: list[int]
    action: str = "CONFIRM"
    actor_id: int | None = None


class Actor(BaseModel):
    actor_id: int | None = None


class TaskStatus(BaseModel):
    status: str = Field(pattern="^(TODO|DOING|DONE)$")
    actor_id: int


class Submit(BaseModel):
    actor_id: int | None = None
    approver_id: int | None = None
    comment: str | None = None


class Decision(BaseModel):
    decision: str = Field(pattern="^(APPROVED|REJECTED)$")
    comment: str | None = None
    actor_id: int | None = None


def _review(call):
    """확인·승인 동작의 오류를 HTTP 응답으로 바꾼다."""
    try:
        return call()
    except review.ReviewError as exc:
        raise HTTPException(exc.status, str(exc)) from exc


def _summary(run_id: int) -> dict:
    with connect() as conn:
        summary = queries.run_summary(conn, run_id)
    if summary is None:
        raise HTTPException(404, f"검토 실행 {run_id}이(가) 없습니다.")
    return summary


def _start(paths: list[Path], background: BackgroundTasks, info: dict,
           actor_id: int | None) -> dict:
    with connect() as conn:
        # 검토 정보가 틀리면 실행을 만들기 전에 막는다
        _review(lambda: review_info.clean(info))
        _review(lambda: review_info.check_engineer(conn, info.get("engineer_id") or None))
        run_id = start_run(conn, actor_id)
        _review(lambda: review_info.save_on_start(conn, run_id, info, actor_id))
    background.add_task(run_to_end, run_id, paths)
    return _summary(run_id)


def _safe_name(name: str) -> str:
    name = Path(name).name
    if not name.lower().endswith(".docx") or re.search(r"[\x00/\\]", name):
        raise HTTPException(400, f"docx 파일만 받습니다: {name}")
    return name


@router.get("/users")
def users() -> list[dict]:
    """로그인(범위 밖) 전까지 화면에서 고르는 사용자 목록."""
    with connect() as conn:
        return queries.users(conn)


@router.get("/runs")
def runs(limit: int = Query(50, le=200)) -> list[dict]:
    with connect() as conn:
        return queries.run_list(conn, limit)


@router.get("/requirements/{requirement_id}")
def requirement(requirement_id: int, run_id: int | None = None) -> dict:
    """요구사항 원문. run_id를 주면 그 실행의 문서 위치만 낸다."""
    with connect() as conn:
        item = queries.requirement(conn, requirement_id, run_id)
    if item is None:
        raise HTTPException(404, f"요구사항 {requirement_id}이(가) 없습니다.")
    return item


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
    return _start(paths, background, body.info(), body.actor_id)


@router.post("/runs", status_code=202)
async def run_upload(files: list[UploadFile], background: BackgroundTasks,
                     project_name: str | None = Form(None), review_name: str | None = Form(None),
                     customer_name: str | None = Form(None), country: str | None = Form(None),
                     due_date: str | None = Form(None), engineer_id: int | None = Form(None),
                     actor_id: int | None = Form(None)) -> dict:
    """올린 docx로 검토를 시작한다. 검토 정보 칸은 모두 고를 수 있다.

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
    sent = {"project_name": project_name, "review_name": review_name,
            "customer_name": customer_name, "country": country, "due_date": due_date,
            "engineer_id": engineer_id}
    return _start(paths, background, {k: v for k, v in sent.items() if v is not None}, actor_id)


@router.get("/runs/{run_id}")
def run_status(run_id: int) -> dict:
    return _summary(run_id)


@router.put("/runs/{run_id}/info")
def update_info(run_id: int, body: ReviewInfo) -> dict:
    """검토 정보를 고친다. 단계와 관계없이 고칠 수 있고 바뀐 칸은 이력에 남는다."""
    _summary(run_id)
    with connect() as conn:
        _review(lambda: review_info.update(conn, run_id, body.info(), body.actor_id))
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
def run_requirements(run_id: int, response: Response, document_id: int | None = None,
                     type_code: str | None = None, limit: int = Query(100, le=500),
                     offset: int = 0) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        response.headers["X-Total-Count"] = str(queries.count_requirements(
            conn, run_id, document_id=document_id, type_code=type_code))
        return queries.run_requirements(conn, run_id, document_id=document_id,
                                        type_code=type_code, limit=limit, offset=offset)


@router.get("/runs/{run_id}/risks")
def run_risks(run_id: int) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return queries.run_risks(conn, run_id)


@router.get("/runs/{run_id}/judgments")
def run_judgments(run_id: int, response: Response, result: str | None = None,
                  group: str | None = None, type_code: str | None = None,
                  q: str | None = None, unconfirmed: bool = False,
                  order: str | None = Query(None, pattern="^priority$"),
                  limit: int = Query(100, le=500), offset: int = 0) -> list[dict]:
    """판정 목록. order=priority면 일탈 → 질의 → 확인 필요 → 작성 필요 → 준수 순서."""
    _summary(run_id)
    filters = {"result": result, "group": group, "type_code": type_code, "q": q,
               "unconfirmed": unconfirmed}
    with connect() as conn:
        response.headers["X-Total-Count"] = str(queries.count_judgments(conn, run_id, **filters))
        return queries.run_judgments(conn, run_id, **filters, priority=order == "priority",
                                     limit=limit, offset=offset)


@router.get("/runs/{run_id}/judgment-counts")
def judgment_counts(run_id: int) -> dict:
    """판정 칩 건수 (판정 값마다, 확정 안 한 수, 그중 준수)."""
    _summary(run_id)
    with connect() as conn:
        return queries.judgment_counts(conn, run_id)


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
        _review(lambda: review.require_stage(conn, run_id, "ENGINEER_REVIEW"))
        before = conn.execute("SELECT product_code FROM run_product_choice WHERE run_id = %s "
                              "AND equipment_group = %s", (run_id, group)).fetchone()
        try:
            counts = switch_product(make_context(conn), run_id, group, body.product_code)
        except KeyError as exc:
            raise HTTPException(400, f"없는 제품: {body.product_code}") from exc
        review.log(conn, run_id, "run_product_choice", run_id, "EDIT",
                   {"group": group, "product_code": before[0] if before else None},
                   {"group": group, "product_code": body.product_code}, "비교 제품 바꿔 보기",
                   review.default_user(conn, "ENGINEER"))
        conn.commit()
        return counts


@router.get("/runs/{run_id}/warranty")
def run_warranty(run_id: int, response: Response, status: str | None = None,
                 limit: int = Query(100, le=500), offset: int = 0) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        response.headers["X-Total-Count"] = str(queries.count_warranty(conn, run_id,
                                                                      status=status))
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
        _review(lambda: review.require_stage(conn, run_id, "ENGINEER_REVIEW"))
        before = review.row(conn, "loss_calc", loss_calc_id, run_id)
        result = recalculate(conn, loss_calc_id, body.loss_noload_kw, body.loss_load_kw,
                             body.loss_aux_kw)
        review.log(conn, run_id, "loss_calc", loss_calc_id, "EDIT", before,
                   review.row(conn, "loss_calc", loss_calc_id, run_id), "손실값 고치기",
                   review.default_user(conn, "ENGINEER"))
        build_proposals(conn, run_id, make_context(conn).llm)
        build_assignments(conn, run_id)
        conn.commit()
        return result


@router.get("/runs/{run_id}/outputs")
def run_outputs(run_id: int, list_kind: str | None = None) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return queries.run_outputs(conn, run_id, list_kind)


@router.get("/runs/{run_id}/outputs/export")
def export_outputs(run_id: int, list_kind: str = Query(pattern="^(DEVIATION|QUERY)$")) -> Response:
    """일탈 목록·질의서 초안 Word 파일 (SCR-08-11)."""
    _summary(run_id)
    with connect() as conn:
        name, body = outputs_docx(conn, run_id, list_kind)
    return Response(body, media_type=DOCX_TYPE,
                    headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"})


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


@router.get("/runs/{run_id}/checks")
def run_checks(run_id: int) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return queries.run_checks(conn, run_id)


@router.get("/runs/{run_id}/proposals")
def run_proposals(run_id: int) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return queries.run_proposals(conn, run_id)


@router.post("/runs/{run_id}/actions")
def act(run_id: int, body: Action) -> dict:
    """후보 하나를 확정·수정·반려(제안 포인트는 채택·버림·수정)하고 이력을 남긴다."""
    with connect() as conn:
        return _review(lambda: review.act(make_context(conn), run_id, body.target,
                                          body.target_id, body.action, body.value,
                                          body.reason, body.actor_id))


@router.post("/runs/{run_id}/actions/bulk")
def act_bulk(run_id: int, body: BulkAction) -> dict:
    """여러 판정을 한 번에 제안대로 확정한다 (수정·반려는 한 줄씩)."""
    if body.target != "judgment" or body.action != "CONFIRM":
        raise HTTPException(400, "한꺼번에는 판정 확정만 할 수 있습니다.")
    with connect() as conn:
        return _review(lambda: review.bulk_confirm(make_context(conn), run_id, body.ids,
                                                   body.actor_id))


@router.get("/runs/{run_id}/history")
def history(run_id: int, target: str | None = None, target_id: int | None = None) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return review.history(conn, run_id, target, target_id)


@router.post("/runs/{run_id}/finish-review")
def finish_review(run_id: int, body: Submit) -> dict:
    """결재 상신. 결재자와 상신 의견을 받아 승인 대기로 둔다 (걸린 기준이 없어도)."""
    with connect() as conn:
        return _review(lambda: review.finish_review(conn, run_id, body.approver_id,
                                                    body.comment, body.actor_id))


@router.post("/runs/{run_id}/withdraw")
def withdraw(run_id: int, body: Actor) -> dict:
    """결정 전인 상신을 취소하고 담당자 확인으로 되돌린다."""
    with connect() as conn:
        return _review(lambda: review.withdraw(conn, run_id, body.actor_id))


@router.get("/runs/{run_id}/approval")
def get_approval(run_id: int) -> dict:
    with connect() as conn:
        screen = _review(lambda: review.approval(conn, run_id))
        screen["read_unchecked"] = read_checks.unchecked(conn, run_id)   # 문서 읽기 점검 미확인
        return screen


@router.get("/runs/{run_id}/read-checks")
def run_read_checks(run_id: int) -> list[dict]:
    """문서 읽기 점검: 시스템이 제대로 읽지 못한 곳과 사람이 확인한 기록 (SCR-08-2)."""
    with connect() as conn:
        return _review(lambda: read_checks.read_checks(conn, run_id))


@router.post("/runs/{run_id}/read-checks/{key}")
def check_read(run_id: int, key: str, body: Actor) -> dict:
    with connect() as conn:
        return _review(lambda: read_checks.set_checked(conn, run_id, key, True, body.actor_id))


@router.delete("/runs/{run_id}/read-checks/{key}")
def uncheck_read(run_id: int, key: str, actor_id: int | None = None) -> dict:
    with connect() as conn:
        return _review(lambda: read_checks.set_checked(conn, run_id, key, False, actor_id))


@router.post("/runs/{run_id}/approval")
def decide(run_id: int, body: Decision) -> dict:
    with connect() as conn:
        return _review(lambda: review.decide(conn, run_id, body.decision, body.comment,
                                             body.actor_id))


@router.post("/runs/{run_id}/reopen")
def reopen(run_id: int, body: Actor) -> dict:
    with connect() as conn:
        return _review(lambda: review.reopen(conn, run_id, body.actor_id))


@router.get("/runs/{run_id}/deliverables")
def deliverables(run_id: int) -> dict:
    """전달 대상: 빼지 않은 목록, 확정한 보증값, 채택한 제안 포인트만 (AR-08)."""
    _summary(run_id)
    with connect() as conn:
        return review.deliverables(conn, run_id)


@router.get("/tasks")
def my_tasks(user_id: int) -> dict:
    """고른 사용자의 "내 할 일": 엔지니어·승인자는 멈춘 검토, 담당자는 받은 할 일 (FR-11)."""
    with connect() as conn:
        return _review(lambda: review.my_tasks(conn, user_id))


@router.get("/runs/{run_id}/assignments")
def run_assignments(run_id: int, role: str) -> list[dict]:
    _summary(run_id)
    with connect() as conn:
        return review.assignments_for(conn, role, run_id)


@router.get("/assignments")
def role_assignments(role: str = Query(pattern="^(COST|QUALITY|SALES)$")) -> list[dict]:
    """협조 요청 현황 (SCR-13): 한 수신 부서에 보낸 요청을 모든 검토에서 모은다."""
    with connect() as conn:
        return review.assignments_for(conn, role)


@router.put("/assignments/{assignment_id}")
def update_assignment(assignment_id: int, body: TaskStatus) -> dict:
    """담당자가 할 일 상태를 바꾼다 (할 일 → 하는 중 → 끝)."""
    with connect() as conn:
        return _review(lambda: review.set_assignment_status(conn, assignment_id, body.status,
                                                            body.actor_id))
