"""검토 실행 하나를 LangGraph 흐름으로 돌린다: 문서별 ①~⑤ → 위험 조건 ⑥.

실행 상태는 review_run에 남기고, AI 호출이 재시도 뒤에도 실패하면 FAILED와 실패 단계를 기록한다
(CR-12). 결과는 모두 run_id에 묶인다.
"""

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import TypedDict

import psycopg
from langgraph.graph import END, START, StateGraph
from psycopg.types.json import Jsonb

from rfp_agent.llm import tasks
from rfp_agent.llm.client import FAILURE_MESSAGE, LLM, LLMFailure
from rfp_agent.pipeline import code_version, dictionaries
from rfp_agent.pipeline.document import process_document
from rfp_agent.pipeline.risk import (
    FLAG_KIND,
    RiskCandidate,
    ValueRef,
    find_clause_risks,
    find_value_mismatches,
)

log = logging.getLogger(__name__)

DEFAULT_USER = "기본 엔지니어"    # 로그인(4단계) 전까지 0003에서 만든 사용자


class RunState(TypedDict, total=False):
    run_id: int
    paths: list[str]
    document_ids: list[int]
    risk_count: int


@dataclass
class RunContext:
    conn: psycopg.Connection
    version: str                # 사전·제품표 판 (dict_version)
    llm: LLM | None
    txt_dir: Path | None

    @property
    def processing_key(self) -> str:
        """문서 처리 결과를 다시 쓸 수 있는 조건: 사전 판 + 처리 코드 판 + AI 모델·프롬프트 판."""
        ai = f"{self.llm.model}/{tasks.PROMPT_VERSION}" if self.llm else "rule"
        return f"{self.version}-{code_version()}-{ai}"


def create_run(conn: psycopg.Connection, version: str, llm: LLM | None,
               started_by: int | None = None) -> int:
    if started_by is None:
        started_by = conn.execute("SELECT min(user_id) FROM app_user WHERE user_name = %s",
                                  (DEFAULT_USER,)).fetchone()[0]
    run_id = conn.execute(
        """INSERT INTO review_run (started_by, stage, dict_version, llm_model, graph_state)
           VALUES (%s, 'PROCESSING', %s, %s, %s) RETURNING run_id""",
        (started_by, version, llm.model if llm else None,
         Jsonb({"step": "created", "code_version": code_version(),
                "prompt_version": tasks.PROMPT_VERSION})),
    ).fetchone()[0]
    conn.commit()
    return run_id


def _set_step(conn: psycopg.Connection, run_id: int, step: str) -> None:
    conn.execute("UPDATE review_run SET graph_state = graph_state || %s WHERE run_id = %s",
                 (Jsonb({"step": step}), run_id))
    conn.commit()


def _documents_node(ctx: RunContext):
    def node(state: RunState) -> RunState:
        conn, run_id = ctx.conn, state["run_id"]
        _set_step(conn, run_id, "documents")
        dicts = dictionaries.load(conn)
        ids = []
        for path in state["paths"]:
            result = process_document(conn, Path(path), dicts, ctx.processing_key, ctx.llm,
                                      ctx.txt_dir)
            conn.execute("INSERT INTO run_document VALUES (%s, %s) ON CONFLICT DO NOTHING",
                         (run_id, result.document_id))
            conn.commit()
            ids.append(result.document_id)
        projects = {r[0] for r in conn.execute(
            "SELECT DISTINCT project_id FROM document WHERE document_id = ANY(%s)", (ids,))}
        if len(projects) == 1 and None not in projects:
            conn.execute("UPDATE review_run SET project_id = %s WHERE run_id = %s",
                         (projects.pop(), run_id))
            conn.commit()
        return {"document_ids": ids}
    return node


PAIR_MIN_SHARED = 50          # 데이터시트 항목이 이만큼 겹치면 같은 문서의 다른 판 후보


def _pairs_node(ctx: RunContext):
    """같은 데이터시트 항목을 많이 공유하는 문서 쌍을 후보로 낸다 (FR-01). 확정은 사람이."""
    def node(state: RunState) -> RunState:
        conn, run_id = ctx.conn, state["run_id"]
        _set_step(conn, run_id, "pairs")
        shared = conn.execute(
            """SELECT LEAST(a.document_id, b.document_id), GREATEST(a.document_id, b.document_id),
                      count(*)
               FROM requirement a JOIN requirement b ON b.dedup_of = a.requirement_id
               WHERE a.document_id = ANY(%(ids)s) AND b.document_id = ANY(%(ids)s)
                 AND a.source_kind = 'TABLE_CELL'
               GROUP BY 1, 2 HAVING count(*) >= %(min)s""",
            {"ids": state["document_ids"], "min": PAIR_MIN_SHARED}).fetchall()
        for doc_a, doc_b, count in shared:
            conn.execute(
                """INSERT INTO document_pair (document_id_a, document_id_b, relation, status,
                                             evidence)
                   VALUES (%s, %s, 'DUPLICATE_CONTENT', 'CANDIDATE', %s)
                   ON CONFLICT DO NOTHING""",
                (doc_a, doc_b, f"데이터시트 항목 {count}개 겹침"))
        conn.commit()
        return {}
    return node


def _section_titles(conn: psycopg.Connection, document_ids: list[int]) -> dict[int, list[str]]:
    """절 id → 자기 제목부터 최상위 절 제목까지."""
    rows = {sid: (parent, title) for sid, parent, title in conn.execute(
        "SELECT section_id, parent_id, title FROM section WHERE document_id = ANY(%s)",
        (document_ids,))}
    out: dict[int, list[str]] = {}
    for sid in rows:
        titles, cur = [], sid
        while cur is not None:
            parent, title = rows[cur]
            titles.append(title or "")
            cur = parent
        out[sid] = titles
    return out


def clause_candidates(conn: psycopg.Connection, document_ids: list[int],
                      dicts: dictionaries.PipelineDicts) -> list[RiskCandidate]:
    """조항 하나에 위험 표현이 여럿이면 종류별로 후보 하나에 모은다 ("deemed" + "no deviation")."""
    titles = _section_titles(conn, document_ids)
    by_key: dict[tuple, RiskCandidate] = {}
    for req_id, dedup_of, section_id, text in conn.execute(
            """SELECT requirement_id, dedup_of, section_id, text_raw FROM requirement
               WHERE document_id = ANY(%s) AND req_kind = 'REQUIREMENT'
               ORDER BY requirement_id""", (document_ids,)):
        for expr in find_clause_risks(text, titles.get(section_id, []), dicts.risk_expressions):
            target = dedup_of or req_id         # 같은 문장이 여러 문서에 있으면 대표 하나만
            kind = FLAG_KIND[expr.risk_kind]
            cand = by_key.get((kind, target))
            if cand is None:
                by_key[(kind, target)] = RiskCandidate(kind, [target], expression=expr,
                                                       facts=f"표현: {expr.expression}")
            elif expr.expression not in cand.facts:
                cand.facts += f", {expr.expression}"
    return list(by_key.values())


def value_refs(conn: psycopg.Connection, document_ids: list[int]) -> list[ValueRef]:
    rows = conn.execute(
        """SELECT v.value_id, v.requirement_id, d.document_id, p.project_key, v.item_key,
                  v.num_value, v.unit_raw, v.target_object, v.basis_standard, v.equipment_key,
                  d.file_no, min(l.line_start), v.raw_text, tr.table_id, v.value_seq,
                  tr.table_id IS NOT NULL AND EXISTS (
                      SELECT 1 FROM req_value w WHERE w.requirement_id = v.requirement_id
                      AND w.value_seq > 1) AS multi,
                  tr.item_no || '|' || lower(regexp_replace(tr.item_name_raw, '\\s+', ' ', 'g'))
                      AS row_label
           FROM req_value v
           JOIN requirement r USING (requirement_id)
           LEFT JOIN table_row tr ON tr.row_id = r.row_id
           JOIN document d ON d.document_id = r.document_id
           LEFT JOIN project p ON p.project_id = d.project_id
           JOIN requirement_location rl ON rl.requirement_id = r.requirement_id
           JOIN source_location l ON l.location_id = rl.location_id
                                 AND l.document_id = r.document_id
           WHERE r.document_id = ANY(%s) AND r.req_kind = 'REQUIREMENT'
             AND v.num_value IS NOT NULL AND v.item_key IS NOT NULL
             AND v.flag IS DISTINCT FROM 'RANGE'
           GROUP BY v.value_id, d.document_id, p.project_key, tr.table_id, tr.item_no,
                    tr.item_name_raw
           ORDER BY v.value_id""", (document_ids,))
    return [ValueRef(key=r[0], requirement_key=r[1], document_key=r[2], project_key=r[3],
                     item_key=r[4], num_value=float(r[5]), unit=r[6], target_object=r[7],
                     basis_standard=r[8], equipment_key=r[9],
                     location=f"파일 {r[10]} {r[11]}행", raw_text=r[12], table_key=r[13],
                     seq=r[14], multi=r[15], row_label=r[16])
            for r in rows]


def _save_risks(ctx: RunContext, run_id: int, candidates: list[RiskCandidate]) -> int:
    conn = ctx.conn
    for cand in candidates:
        explanation = None
        if ctx.llm is not None:
            texts = [r[0] for r in conn.execute(
                "SELECT text_raw FROM requirement WHERE requirement_id = ANY(%s)",
                (cand.members,))]
            explanation = tasks.explain_risk(ctx.llm, cand.risk_kind, cand.facts, texts)
        risk_id = conn.execute(
            """INSERT INTO risk_flag (run_id, risk_kind, expr_id, explanation_ai, status, facts,
                                      item_key)
               VALUES (%s, %s, %s, %s, 'CANDIDATE', %s, %s) RETURNING risk_id""",
            (run_id, cand.risk_kind, cand.expression.expr_id if cand.expression else None,
             explanation, cand.facts, cand.item_key),
        ).fetchone()[0]
        values = cand.value_members or [None] * len(cand.members)
        for req_id, value_id in zip(cand.members, values, strict=True):
            conn.execute("INSERT INTO risk_flag_member VALUES (%s, %s, %s) "
                         "ON CONFLICT DO NOTHING", (risk_id, req_id, value_id))
    return len(candidates)


def _risks_node(ctx: RunContext):
    def node(state: RunState) -> RunState:
        conn, run_id = ctx.conn, state["run_id"]
        _set_step(conn, run_id, "risks")
        dicts = dictionaries.load(conn)
        ids = state["document_ids"]
        readable = [r[0] for r in conn.execute(
            "SELECT document_id FROM document WHERE document_id = ANY(%s) AND readable", (ids,))]
        candidates = clause_candidates(conn, readable, dicts)
        candidates += find_value_mismatches(value_refs(conn, readable), dicts.values.parents)
        with conn.transaction():
            conn.execute("DELETE FROM risk_flag_member WHERE risk_id IN "
                         "(SELECT risk_id FROM risk_flag WHERE run_id = %s)", (run_id,))
            conn.execute("DELETE FROM risk_flag WHERE run_id = %s", (run_id,))
            count = _save_risks(ctx, run_id, candidates)
        return {"risk_count": count}
    return node


def build_graph(ctx: RunContext):
    graph = StateGraph(RunState)
    graph.add_node("documents", _documents_node(ctx))
    graph.add_node("pairs", _pairs_node(ctx))
    graph.add_node("risks", _risks_node(ctx))
    graph.add_edge(START, "documents")
    graph.add_edge("documents", "pairs")
    graph.add_edge("pairs", "risks")
    graph.add_edge("risks", END)
    return graph.compile()


def execute_run(ctx: RunContext, run_id: int, paths: list[Path]) -> str:
    """실행을 끝까지 돌리고 마지막 단계를 돌려준다 (ENGINEER_REVIEW 또는 FAILED)."""
    conn = ctx.conn
    try:
        state = build_graph(ctx).invoke({"run_id": run_id, "paths": [str(p) for p in paths]})
    except Exception as exc:
        conn.rollback()
        step = conn.execute("SELECT graph_state->>'step' FROM review_run WHERE run_id = %s",
                            (run_id,)).fetchone()[0]
        message = FAILURE_MESSAGE if isinstance(exc, LLMFailure) else f"{FAILURE_MESSAGE}: {exc}"
        log.exception("검토 실행 %s 실패 (%s)", run_id, step)
        conn.execute(
            """UPDATE review_run SET stage = 'FAILED', failed_step = %s, error_message = %s,
                      finished_at = now() WHERE run_id = %s""", (step, message, run_id))
        conn.commit()
        return "FAILED"
    conn.execute(
        """UPDATE review_run SET stage = 'ENGINEER_REVIEW', finished_at = now(),
                  graph_state = graph_state || %s WHERE run_id = %s""",
        (Jsonb({"step": "done", "risk_count": state["risk_count"]}), run_id))
    conn.commit()
    return "ENGINEER_REVIEW"
