"""검토 실행 결과 조회 (API·CLI 공용). 값은 모두 원문 위치와 함께 낸다 (CR-02)."""

import psycopg
from psycopg.rows import dict_row


def _rows(conn: psycopg.Connection, sql: str, params) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        return cur.execute(sql, params).fetchall()


def run_summary(conn: psycopg.Connection, run_id: int) -> dict | None:
    rows = _rows(conn, """
        SELECT r.run_id, r.stage, r.dict_version, r.llm_model, r.failed_step, r.error_message,
               r.started_at, r.finished_at, r.graph_state->>'step' AS step,
               (SELECT count(*) FROM run_document WHERE run_id = r.run_id) AS documents,
               (SELECT count(*) FROM requirement q JOIN run_document rd USING (document_id)
                 WHERE rd.run_id = r.run_id AND q.req_kind = 'REQUIREMENT') AS requirements,
               (SELECT count(*) FROM risk_flag WHERE run_id = r.run_id) AS risks
        FROM review_run r WHERE r.run_id = %s""", (run_id,))
    return rows[0] if rows else None


def run_documents(conn: psycopg.Connection, run_id: int) -> list[dict]:
    return _rows(conn, """
        SELECT d.document_id, d.file_no, d.file_name, d.bundle, d.doc_kind, d.language,
               d.standard_system, d.judge_target, d.readable, d.classify_by, d.needs_review,
               d.line_basis,
               (SELECT count(*) FROM requirement q WHERE q.document_id = d.document_id
                  AND q.req_kind = 'REQUIREMENT') AS requirements
        FROM run_document rd JOIN document d USING (document_id)
        WHERE rd.run_id = %s ORDER BY d.file_no""", (run_id,))


LOCATIONS = """
    SELECT rl.requirement_id, d.file_no, s.section_no, s.title AS section_title,
           t.table_name, tr.item_no, l.line_start, l.line_end
    FROM requirement_location rl
    JOIN source_location l USING (location_id)
    JOIN document d ON d.document_id = l.document_id
    LEFT JOIN section s ON s.section_id = l.section_id
    LEFT JOIN table_row tr ON tr.row_id = l.row_id
    LEFT JOIN doc_table t ON t.table_id = tr.table_id
    WHERE rl.requirement_id = ANY(%s)
    ORDER BY d.file_no, l.line_start"""


def _attach(conn: psycopg.Connection, items: list[dict]) -> list[dict]:
    """요구사항마다 원문 위치·유형·값을 붙인다."""
    ids = [i["requirement_id"] for i in items]
    by_id = {i["requirement_id"]: i | {"locations": [], "types": [], "values": []} for i in items}
    for loc in _rows(conn, LOCATIONS, (ids,)):
        by_id[loc.pop("requirement_id")]["locations"].append(loc)
    for t in _rows(conn, """
            SELECT requirement_id, type_code, is_primary, decided_by, tr.rule_code
            FROM requirement_type_tag LEFT JOIN type_rule tr USING (type_rule_id)
            WHERE requirement_id = ANY(%s) ORDER BY NOT is_primary, type_code""", (ids,)):
        by_id[t.pop("requirement_id")]["types"].append(t)
    for v in _rows(conn, """
            SELECT requirement_id, value_seq, raw_text, cell_form, num_value, operator, unit_raw,
                   cond_time_s, cond_raw, item_key, target_object, basis_standard, delegated_std,
                   equipment_key, flag
            FROM req_value WHERE requirement_id = ANY(%s) ORDER BY value_id""", (ids,)):
        by_id[v.pop("requirement_id")]["values"].append(v)
    return list(by_id.values())


def run_requirements(conn: psycopg.Connection, run_id: int, *, document_id: int | None = None,
                     type_code: str | None = None, limit: int = 100,
                     offset: int = 0) -> list[dict]:
    items = _rows(conn, """
        SELECT q.requirement_id, d.file_no, q.source_kind, q.req_kind, q.text_raw,
               q.extracted_by, q.confidence, q.is_assumed, q.rule_id, q.supplier_mark,
               q.dedup_of
        FROM requirement q
        JOIN run_document rd ON rd.document_id = q.document_id AND rd.run_id = %(run)s
        JOIN document d ON d.document_id = q.document_id
        WHERE q.req_kind = 'REQUIREMENT'
          AND (%(doc)s::int IS NULL OR q.document_id = %(doc)s)
          AND (%(type)s::text IS NULL OR EXISTS (
                SELECT 1 FROM requirement_type_tag t
                WHERE t.requirement_id = q.requirement_id AND t.type_code = %(type)s))
        ORDER BY d.file_no, q.requirement_id
        LIMIT %(limit)s OFFSET %(offset)s""",
        {"run": run_id, "doc": document_id, "type": type_code, "limit": limit,
         "offset": offset})
    return _attach(conn, items)


def run_risks(conn: psycopg.Connection, run_id: int) -> list[dict]:
    risks = _rows(conn, """
        SELECT f.risk_id, f.risk_kind, f.status, f.item_key, f.facts, f.explanation_ai,
               e.expression
        FROM risk_flag f LEFT JOIN risk_expression e USING (expr_id)
        WHERE f.run_id = %s ORDER BY f.risk_id""", (run_id,))
    if not risks:
        return []
    members = _rows(conn, """
        SELECT m.risk_id, q.requirement_id, q.text_raw, v.raw_text AS value_raw
        FROM risk_flag_member m
        JOIN requirement q USING (requirement_id)
        LEFT JOIN req_value v ON v.value_id = m.value_id
        WHERE m.risk_id = ANY(%s) ORDER BY m.risk_id, q.requirement_id""",
        ([r["risk_id"] for r in risks],))
    locations: dict[int, list[dict]] = {}
    for loc in _rows(conn, LOCATIONS, (list({m["requirement_id"] for m in members}),)):
        locations.setdefault(loc.pop("requirement_id"), []).append(loc)
    by_id = {r["risk_id"]: r | {"members": []} for r in risks}
    for m in members:
        m["locations"] = locations.get(m["requirement_id"], [])
        by_id[m.pop("risk_id")]["members"].append(m)
    return list(by_id.values())
