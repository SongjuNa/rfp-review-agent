"""지난 사람 판정 힌트 (change add-review-memory, FR-10 ④).

다른 검토에서 사람이 확정·수정한 같은 요구·같은 제품 판정을 찾아 힌트로 붙인다.
판정 값과 확인 상태는 바꾸지 않는다(CR-01·08). 같은 입력이면 같은 힌트(CR-11).
"""

from datetime import datetime

import psycopg
from psycopg.rows import dict_row

from rfp_agent.pipeline.evaluation import normalize

Key = tuple[str, str, str, str | None]

_KEY_SQL = """
    SELECT j.judgment_id, j.run_id, j.result, j.review_status, j.product_code,
           q.text_raw, tr.item_name_raw, v.raw_text AS value_raw
      FROM judgment j
      JOIN req_value v ON v.value_id = j.value_id
      JOIN requirement q ON q.requirement_id = j.requirement_id
      LEFT JOIN table_row tr ON tr.row_id = q.row_id"""


def key_of(row: dict) -> Key:
    """요구 원문·표 항목명·요구값 원문(공백·대소문자 무시) + 비교 제품."""
    return (normalize(row["text_raw"]), normalize(row["item_name_raw"] or ""),
            normalize(row["value_raw"] or ""), row["product_code"])


def _current(conn: psycopg.Connection, run_id: int, ids: list[int] | None) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        return cur.execute(
            _KEY_SQL + """ WHERE j.run_id = %s AND j.is_current
                             AND (%s::int[] IS NULL OR j.judgment_id = ANY(%s))""",
            (run_id, ids, ids)).fetchall()


def _past(conn: psycopg.Connection, run_id: int, keys: set[Key]) -> dict[Key, dict]:
    """다른 검토의 사람 판정 중 열쇠마다 가장 최근 것."""
    if not keys:
        return {}
    with conn.cursor(row_factory=dict_row) as cur:
        rows = cur.execute(
            _KEY_SQL.replace("SELECT j.judgment_id,", """SELECT j.judgment_id,
                   'RV-' || extract(year FROM r.started_at)::int || '-'
                       || lpad(r.run_id::text, 3, '0') AS review_no,
                   l.acted_at, l.reason, u.user_name,""", 1) + """
              JOIN review_run r ON r.run_id = j.run_id
              LEFT JOIN LATERAL (
                   SELECT acted_at, reason, actor_id FROM review_log
                    WHERE target_table = 'judgment' AND target_id = j.judgment_id
                      AND action IN ('CONFIRM', 'EDIT')
                    ORDER BY log_id DESC LIMIT 1) l ON TRUE
              LEFT JOIN app_user u ON u.user_id = l.actor_id
             WHERE j.run_id <> %s AND j.is_current
               AND j.review_status IN ('CONFIRMED', 'EDITED')""", (run_id,)).fetchall()
    best: dict[Key, dict] = {}
    oldest = datetime.min
    for row in rows:
        key = key_of(row)
        if key not in keys:
            continue
        rank = (row["acted_at"].replace(tzinfo=None) if row["acted_at"] else oldest,
                row["judgment_id"])
        if key not in best or rank > best[key][0]:
            best[key] = (rank, row)
    return {k: v[1] for k, v in best.items()}


def hints(conn: psycopg.Connection, run_id: int,
          ids: list[int] | None = None) -> dict[int, dict]:
    """판정 번호 → 지난 사람 판정. ids가 없으면 지금 검토의 모든 지금 판정."""
    current = _current(conn, run_id, ids)
    keys = {r["judgment_id"]: key_of(r) for r in current}
    past = _past(conn, run_id, set(keys.values()))
    out = {}
    for row in current:
        found = past.get(keys[row["judgment_id"]])
        if found is None:
            continue
        out[row["judgment_id"]] = {
            "run_id": found["run_id"], "review_no": found["review_no"],
            "result": found["result"], "review_status": found["review_status"],
            "decided_by": found["user_name"], "decided_at": found["acted_at"],
            "reason": found["reason"], "same": found["result"] == row["result"]}
    return out


def counts(conn: psycopg.Connection, run_id: int) -> tuple[int, int]:
    """(지난 확정이 있는 줄, 그중 지금과 다른 줄). 반려한 지금 판정은 세지 않는다."""
    rejected = {r[0] for r in conn.execute(
        "SELECT judgment_id FROM judgment WHERE run_id = %s AND is_current "
        "AND review_status = 'REJECTED'", (run_id,))}
    found = {k: v for k, v in hints(conn, run_id).items() if k not in rejected}
    return len(found), sum(not h["same"] for h in found.values())


def differing_ids(conn: psycopg.Connection, run_id: int) -> list[int]:
    return sorted(k for k, h in hints(conn, run_id).items() if not h["same"])
