"""FR-10 담당자 확인·승인과 수정 이력.

멈춤 지점은 두 곳이다. 처리를 마친 실행은 담당자 확인(ENGINEER_REVIEW)에서 멈추고, 엔지니어가
확인을 마치면 승인 기준(AR-01·02·03·06·07·08)을 코드로 판단해 하나라도 걸리면 승인(APPROVAL)에서
멈춘다. 사람이 확인하지 않은 결과는 확정되지 않는다 (CR-08). 모든 동작은 review_log에 남는다.
"""

import json
from dataclasses import dataclass
from decimal import Decimal

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from rfp_agent.pipeline.numbers import fill
from rfp_agent.pipeline.outputs import build_outputs, check_submission
from rfp_agent.pipeline.proposals import build_proposals
from rfp_agent.pipeline.run import RunContext, readable_documents
from rfp_agent.pipeline.warranty import build_warranty

RESULTS = ("COMPLY", "DEVIATION_CANDIDATE", "QUERY_CANDIDATE", "NEEDS_REVIEW", "WARRANTY_TO_FILL")
# 대상 표 → 할 수 있는 동작
ACTIONS = {
    "judgment": {"CONFIRM", "EDIT", "REJECT"},
    "warranty_candidate": {"CONFIRM", "EDIT", "REJECT"},
    "output_item": {"CONFIRM", "EDIT", "REJECT"},
    "proposal_point": {"ADOPT", "DISCARD", "EDIT"},
    "risk_flag": {"CONFIRM", "REJECT"},
}
KEYS = {"judgment": "judgment_id", "warranty_candidate": "candidate_id",
        "output_item": "item_id", "proposal_point": "point_id", "risk_flag": "risk_id",
        "loss_calc": "loss_calc_id"}
NEEDS_REASON = {"EDIT", "REJECT", "DISCARD"}
DELIVERED_POINTS = ("ADOPTED", "EDITED")         # 채택한(고쳐 채택한) 제안 포인트만 전달 (AR-08)


class ReviewError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


@dataclass
class Criterion:
    ar_code: str
    detail: str


def _json(row: dict | None) -> Jsonb | None:
    if row is None:
        return None
    return Jsonb(json.loads(json.dumps(
        row, default=lambda v: float(v) if isinstance(v, Decimal) else str(v))))


def default_user(conn: psycopg.Connection, role: str) -> int:
    row = conn.execute("SELECT min(user_id) FROM app_user WHERE role = %s", (role,)).fetchone()
    if row[0] is None:
        raise ReviewError(400, f"{role} 역할 사용자가 없습니다.")
    return row[0]


def _user_role(conn: psycopg.Connection, user_id: int) -> str:
    row = conn.execute("SELECT role FROM app_user WHERE user_id = %s", (user_id,)).fetchone()
    if row is None:
        raise ReviewError(400, f"사용자 {user_id}이(가) 없습니다.")
    return row[0]


def _stage(conn: psycopg.Connection, run_id: int) -> str:
    row = conn.execute("SELECT stage FROM review_run WHERE run_id = %s", (run_id,)).fetchone()
    if row is None:
        raise ReviewError(404, f"검토 실행 {run_id}이(가) 없습니다.")
    return row[0]


def require_stage(conn: psycopg.Connection, run_id: int, *stages: str) -> None:
    stage = _stage(conn, run_id)
    if stage not in stages:
        names = {"ENGINEER_REVIEW": "담당자 확인", "APPROVAL": "승인 대기",
                 "REJECTED": "반려됨"}
        raise ReviewError(409, f"지금 단계({stage})에서는 할 수 없습니다. "
                               f"{' / '.join(names.get(s, s) for s in stages)} 단계에서만 됩니다.")


def row(conn: psycopg.Connection, target: str, target_id: int, run_id: int) -> dict:
    with conn.cursor(row_factory=dict_row) as cur:
        row = cur.execute(f"SELECT * FROM {target} WHERE {KEYS[target]} = %s AND run_id = %s",
                          (target_id, run_id)).fetchone()
    if row is None:
        raise ReviewError(404, f"{target} {target_id}이(가) 이 실행에 없습니다.")
    return row


def log(conn: psycopg.Connection, run_id: int, target: str, target_id: int, action: str,
        before: dict | None, after: dict | None, reason: str | None, actor_id: int) -> None:
    conn.execute(
        """INSERT INTO review_log (run_id, target_table, target_id, action, before_value,
                                   after_value, reason, actor_id)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (run_id, target, target_id, action, _json(before), _json(after), reason, actor_id))


def _checked_text(text: str, evidence: str) -> tuple[str, str, str | None]:
    """엔지니어가 고친 문장도 숫자를 근거(원래 문장의 숫자)와 대조한다 (CR-07)."""
    filled = fill(text, {"evidence": evidence})
    return filled.text, filled.check, filled.detail


def _apply(conn: psycopg.Connection, target: str, row: dict, action: str,
           value: dict) -> None:
    key, target_id = KEYS[target], row[KEYS[target]]

    def update(sets: dict) -> None:
        cols = ", ".join(f"{c} = %s" for c in sets)
        conn.execute(f"UPDATE {target} SET {cols} WHERE {key} = %s", (*sets.values(), target_id))

    if target == "judgment":
        if action == "CONFIRM":
            update({"review_status": "CONFIRMED"})
        elif action == "REJECT":
            update({"review_status": "REJECTED"})
        else:
            result = value.get("result")
            if result not in RESULTS:
                raise ReviewError(400, f"판정 값은 {', '.join(RESULTS)} 중 하나입니다.")
            keep_margin = result == "COMPLY" and row["result"] == "COMPLY"
            update({"result": result, "reason_code": "ENGINEER",
                    "reason_text": "엔지니어 수정", "review_status": "EDITED",
                    "margin_value": row["margin_value"] if keep_margin else None,
                    "margin_kind": row["margin_kind"] if keep_margin else None,
                    "margin_direction": row["margin_direction"] if keep_margin else "NOT_CALC"})
    elif target == "warranty_candidate":
        if action == "CONFIRM":
            if row["candidate_value"] is None:
                raise ReviewError(400, "빈 후보는 확정할 수 없습니다. 값을 넣어(수정) 주세요.")
            update({"status": "CONFIRMED"})
        elif action == "REJECT":
            update({"status": "REJECTED"})
        else:
            text = str(value.get("value") or "").strip()
            if not text:
                raise ReviewError(400, "보증값을 넣어 주세요.")
            update({"candidate_value": text[:200], "candidate_unit": value.get("unit"),
                    "source_kind": "ENGINEER", "status": "CONFIRMED", "reason_code": None,
                    "is_assumed": False})
    elif target == "output_item":
        if action == "CONFIRM":
            update({"status": "CONFIRMED"})
        elif action == "REJECT":
            update({"status": "REMOVED"})
        else:
            text, check, detail = _checked_text(_text(value), row["text_draft"])
            update({"text_draft": text, "number_check": check, "number_detail": detail,
                    "drafted_by": "ENGINEER", "status": "CONFIRMED"})
    elif target == "proposal_point":
        if action == "ADOPT":
            update({"status": "ADOPTED"})
        elif action == "DISCARD":
            update({"status": "DISCARDED"})
        else:
            text, check, detail = _checked_text(_text(value), row["text_draft"])
            if row["is_assumed"] and "팀 가정" not in text:
                text += " (팀 가정)"                    # 팀 가정 표시는 지우지 못한다 (CR-06)
            update({"text_draft": text, "number_check": check, "number_detail": detail,
                    "drafted_by": "ENGINEER", "status": "EDITED"})
    elif target == "risk_flag":
        update({"status": "CONFIRMED" if action == "CONFIRM" else "CLOSED_OK"})


def _text(value: dict) -> str:
    text = str(value.get("text") or "").strip()
    if not text:
        raise ReviewError(400, "고친 문장을 넣어 주세요.")
    return text


def act(ctx: RunContext, run_id: int, target: str, target_id: int, action: str,
        value: dict | None = None, reason: str | None = None,
        actor_id: int | None = None) -> dict:
    """후보 하나에 확정·수정·반려(제안 포인트는 채택·버림·수정)를 남긴다.

    판정이나 위험 조건을 바꾸면 보증값·목록·제안 포인트를 다시 만들고 누락 점검을 다시 한다.
    """
    conn = ctx.conn
    if action not in ACTIONS.get(target, set()):
        raise ReviewError(400, f"{target}에는 {action} 동작이 없습니다.")
    if action in NEEDS_REASON and not (reason or "").strip():
        raise ReviewError(400, "수정·반려·버림에는 사유가 필요합니다.")
    require_stage(conn, run_id, "ENGINEER_REVIEW")
    actor_id = actor_id or default_user(conn, "ENGINEER")
    _user_role(conn, actor_id)
    before = row(conn, target, target_id, run_id)
    if target == "judgment" and not before["is_current"]:
        raise ReviewError(409, "현재 판정이 아닙니다 (비교 제품을 바꾸기 전 판정).")
    _apply(conn, target, before, action, value or {})
    if target == "judgment" and action == "EDIT":
        conn.execute("UPDATE judgment SET reason_text = %s WHERE judgment_id = %s",
                     (f"엔지니어 수정: {reason.strip()}", target_id))
    after = row(conn, target, target_id, run_id)
    log(conn, run_id, target, target_id, action, before, after, reason, actor_id)
    conn.commit()
    if target in ("judgment", "risk_flag"):
        ids = readable_documents(conn, [r[0] for r in conn.execute(
            "SELECT document_id FROM run_document WHERE run_id = %s", (run_id,))])
        if target == "judgment":
            build_warranty(conn, run_id)
        build_outputs(conn, run_id, ids, ctx.llm)
        build_proposals(conn, run_id, ctx.llm)
        conn.commit()
    elif target == "output_item":
        check_submission(conn, run_id)
    return {"before": _json(before).obj, "after": _json(after).obj,
            "submission_check": _latest_check(conn, run_id)}


def _latest_check(conn: psycopg.Connection, run_id: int) -> dict | None:
    with conn.cursor(row_factory=dict_row) as cur:
        row = cur.execute(
            "SELECT deviation_candidates, deviation_listed, missing_judgment_ids, open_queries, "
            "ar_codes FROM submission_check WHERE run_id = %s ORDER BY check_id DESC LIMIT 1",
            (run_id,)).fetchone()
    return row


def criteria(conn: psycopg.Connection, run_id: int) -> list[Criterion]:
    """승인 기준 판단 (코드만, CR-01). 걸린 기준과 사람이 읽는 내용."""
    out: list[Criterion] = []
    deviations = conn.execute(
        "SELECT count(*) FROM judgment WHERE run_id = %s AND is_current "
        "AND review_status <> 'REJECTED' AND result = 'DEVIATION_CANDIDATE'",
        (run_id,)).fetchone()[0]
    if deviations:
        out.append(Criterion("AR-01", f"일탈 후보 {deviations}건"))
    blanket = conn.execute(
        "SELECT count(*) FROM risk_flag WHERE run_id = %s AND risk_kind = 'BLANKET' "
        "AND status <> 'CLOSED_OK'", (run_id,)).fetchone()[0]
    if blanket:
        out.append(Criterion("AR-02", f"포괄 조항 {blanket}건"))
    # "확인 필요" 비율: 보증값 후보를 채운 칸은 빼고 계산한다. 엔지니어가 확정·수정한 것은 뺀다
    review, total = conn.execute(
        """SELECT count(*) FILTER (WHERE j.review_status = 'CANDIDATE' AND (
                      j.result = 'NEEDS_REVIEW' OR w.status = 'EMPTY_REVIEW')),
                  count(*) FILTER (WHERE w.status IS DISTINCT FROM 'CANDIDATE'
                                     AND w.status IS DISTINCT FROM 'CONFIRMED')
           FROM judgment j
           LEFT JOIN warranty_candidate w ON w.judgment_id = j.judgment_id
           WHERE j.run_id = %s AND j.is_current AND j.review_status <> 'REJECTED'""",
        (run_id,)).fetchone()
    threshold = float(conn.execute(
        "SELECT threshold FROM approval_rule WHERE ar_code = 'AR-03'").fetchone()[0])
    if total and review / total > threshold:
        out.append(Criterion("AR-03", f"확인 필요 {review}/{total}건 "
                                      f"({review / total:.0%}, 기준 {threshold:.0%})"))
    mismatch = conn.execute(
        "SELECT count(*) FROM risk_flag WHERE run_id = %s AND risk_kind = 'VALUE_MISMATCH' "
        "AND status <> 'CLOSED_OK'", (run_id,)).fetchone()[0]
    queries = conn.execute(
        "SELECT count(*) FROM output_item WHERE run_id = %s AND list_kind = 'QUERY' "
        "AND status <> 'REMOVED'", (run_id,)).fetchone()[0]
    if mismatch or queries:
        out.append(Criterion("AR-06", f"값 불일치 {mismatch}건, 질의 {queries}건"))
    check = check_submission(conn, run_id)
    if check["missing_judgment_ids"]:
        out.append(Criterion("AR-07", f"목록에 없는 일탈 {len(check['missing_judgment_ids'])}건"))
    adopted = conn.execute(
        "SELECT count(*) FROM proposal_point WHERE run_id = %s AND status = ANY(%s)",
        (run_id, list(DELIVERED_POINTS))).fetchone()[0]
    if adopted:
        out.append(Criterion("AR-08", f"전달할 제안 포인트 {adopted}건 (채택한 것만)"))
    return out


def finish_review(conn: psycopg.Connection, run_id: int, actor_id: int | None = None) -> dict:
    """담당자 확인을 마친다. 승인 기준에 걸리면 승인 대기, 아니면 바로 승인됨 [결정]."""
    require_stage(conn, run_id, "ENGINEER_REVIEW")
    actor_id = actor_id or default_user(conn, "ENGINEER")
    _user_role(conn, actor_id)
    found = criteria(conn, run_id)
    stage = "APPROVAL" if found else "APPROVED"
    with conn.transaction():
        approval_id = conn.execute(
            """INSERT INTO approval (run_id, decision, comment, decided_at)
               VALUES (%s, %s, %s, CASE WHEN %s THEN now() END) RETURNING approval_id""",
            (run_id, None if found else "APPROVED",
             None if found else "승인 기준에 해당 없음", not found)).fetchone()[0]
        for c in found:
            conn.execute("INSERT INTO approval_reason VALUES (%s, %s, %s)",
                         (approval_id, c.ar_code, c.detail))
        conn.execute(
            "UPDATE review_run SET stage = %s, graph_state = graph_state || %s "
            "WHERE run_id = %s", (stage, Jsonb({"step": stage.lower()}), run_id))
        log(conn, run_id, "review_run", run_id, "CONFIRM", {"stage": "ENGINEER_REVIEW"},
            {"stage": stage, "ar_codes": [c.ar_code for c in found]}, "담당자 확인 마침",
            actor_id)
    return {"stage": stage, "approval_id": approval_id,
            "criteria": [{"ar_code": c.ar_code, "detail": c.detail} for c in found]}


def decide(conn: psycopg.Connection, run_id: int, decision: str, comment: str | None,
           actor_id: int | None = None) -> dict:
    """승인자가 승인 또는 반려한다. 결정 전에는 승인됨으로 바뀌지 않는다."""
    if decision not in ("APPROVED", "REJECTED"):
        raise ReviewError(400, "결정은 APPROVED 또는 REJECTED입니다.")
    if decision == "REJECTED" and not (comment or "").strip():
        raise ReviewError(400, "반려에는 의견이 필요합니다.")
    require_stage(conn, run_id, "APPROVAL")
    actor_id = actor_id or default_user(conn, "APPROVER")
    if _user_role(conn, actor_id) != "APPROVER":
        raise ReviewError(403, "승인자만 승인·반려할 수 있습니다.")
    with conn.transaction():
        approval_id = conn.execute(
            """UPDATE approval SET decision = %s, comment = %s, approver_id = %s,
                      decided_at = now()
               WHERE approval_id = (SELECT max(approval_id) FROM approval WHERE run_id = %s)
               RETURNING approval_id""", (decision, comment, actor_id, run_id)).fetchone()[0]
        conn.execute(
            "UPDATE review_run SET stage = %s, graph_state = graph_state || %s "
            "WHERE run_id = %s", (decision, Jsonb({"step": decision.lower()}), run_id))
        log(conn, run_id, "review_run", run_id,
            "CONFIRM" if decision == "APPROVED" else "REJECT", {"stage": "APPROVAL"},
            {"stage": decision}, comment, actor_id)
    return approval(conn, run_id) | {"approval_id": approval_id}


def reopen(conn: psycopg.Connection, run_id: int, actor_id: int | None = None) -> dict:
    """반려된 실행을 담당자 확인으로 되돌려 고친 뒤 다시 올린다."""
    require_stage(conn, run_id, "REJECTED")
    actor_id = actor_id or default_user(conn, "ENGINEER")
    with conn.transaction():
        conn.execute("UPDATE review_run SET stage = 'ENGINEER_REVIEW', graph_state = "
                     "graph_state || %s WHERE run_id = %s",
                     (Jsonb({"step": "engineer_review"}), run_id))
        log(conn, run_id, "review_run", run_id, "EDIT", {"stage": "REJECTED"},
            {"stage": "ENGINEER_REVIEW"}, "반려 뒤 다시 확인", actor_id)
    return {"stage": "ENGINEER_REVIEW"}


def approval(conn: psycopg.Connection, run_id: int) -> dict:
    """승인 화면: 걸린 기준, 누락 점검, 결정."""
    stage = _stage(conn, run_id)
    with conn.cursor(row_factory=dict_row) as cur:
        latest = cur.execute(
            """SELECT a.approval_id, a.decision, a.comment, a.requested_at, a.decided_at,
                      u.user_name AS approver
               FROM approval a LEFT JOIN app_user u ON u.user_id = a.approver_id
               WHERE a.run_id = %s ORDER BY a.approval_id DESC LIMIT 1""",
            (run_id,)).fetchone()
        reasons = cur.execute(
            """SELECT r.ar_code, r.detail, ar.description FROM approval_reason r
               JOIN approval_rule ar USING (ar_code) WHERE r.approval_id = %s
               ORDER BY r.ar_code""", (latest["approval_id"],)).fetchall() if latest else []
    preview = [{"ar_code": c.ar_code, "detail": c.detail}
               for c in criteria(conn, run_id)] if stage == "ENGINEER_REVIEW" else None
    conn.commit()
    return {"stage": stage, "approval": latest, "reasons": reasons, "preview": preview,
            "submission_check": _latest_check(conn, run_id)}


def history(conn: psycopg.Connection, run_id: int, target: str | None = None,
            target_id: int | None = None) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        return cur.execute(
            """SELECT l.log_id, l.target_table, l.target_id, l.action, l.before_value,
                      l.after_value, l.reason, u.user_name AS actor, l.acted_at
               FROM review_log l JOIN app_user u ON u.user_id = l.actor_id
               WHERE l.run_id = %s AND (%s::text IS NULL OR l.target_table = %s)
                 AND (%s::int IS NULL OR l.target_id = %s)
               ORDER BY l.log_id""", (run_id, target, target, target_id, target_id)).fetchall()


def deliverables(conn: psycopg.Connection, run_id: int) -> dict:
    """전달 대상: 빼지 않은 일탈·질의 목록, 확정한 보증값, 채택한 제안 포인트만 (AR-08)."""
    with conn.cursor(row_factory=dict_row) as cur:
        points = cur.execute(
            "SELECT point_id, point_kind, text_draft, basis, is_assumed, status "
            "FROM proposal_point WHERE run_id = %s AND status = ANY(%s) ORDER BY point_id",
            (run_id, list(DELIVERED_POINTS))).fetchall()
        items = cur.execute(
            "SELECT item_id, list_kind, list_name, text_draft, status, is_assumed "
            "FROM output_item WHERE run_id = %s AND status <> 'REMOVED' "
            "ORDER BY list_kind, item_id", (run_id,)).fetchall()
        warranty = cur.execute(
            "SELECT w.candidate_id, w.judgment_id, w.candidate_value, w.candidate_unit, "
            "w.source_kind FROM warranty_candidate w WHERE w.run_id = %s "
            "AND w.status = 'CONFIRMED' ORDER BY w.candidate_id", (run_id,)).fetchall()
    return {"proposals": points, "outputs": items, "warranty": warranty}
