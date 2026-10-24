"""검토 실행 하나를 LangGraph 흐름으로 돌린다: 문서별 ①~⑤ → 위험 조건 ⑥ → 판정 ⑦ → 보증값 ⑧
→ 손실 환산 → 일탈·질의 목록 ⑨ → 제안 포인트.

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
from rfp_agent.pipeline.assignments import build_assignments
from rfp_agent.pipeline.document import process_document
from rfp_agent.pipeline.engineering import build_checks
from rfp_agent.pipeline.judge import judge_run
from rfp_agent.pipeline.loss import build_losses
from rfp_agent.pipeline.outputs import build_outputs
from rfp_agent.pipeline.proposals import build_proposals
from rfp_agent.pipeline.risk import (
    FLAG_KIND,
    RiskCandidate,
    ValueRef,
    find_clause_risks,
    find_value_mismatches,
)
from rfp_agent.pipeline.warranty import build_warranty

log = logging.getLogger(__name__)

DEFAULT_USER = "기본 엔지니어"    # 로그인(4단계) 전까지 0003에서 만든 사용자


class RunState(TypedDict, total=False):
    run_id: int
    paths: list[str]
    document_ids: list[int]
    readable_ids: list[int]
    risk_count: int
    judgment_count: int
    check_count: int
    warranty_count: int
    loss_count: int
    output_count: int
    proposal_count: int
    assignment_count: int


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
        readable = readable_documents(conn, state["document_ids"])
        candidates = clause_candidates(conn, readable, dicts)
        candidates += find_value_mismatches(value_refs(conn, readable), dicts.values.parents)
        with conn.transaction():
            conn.execute("DELETE FROM risk_flag_member WHERE risk_id IN "
                         "(SELECT risk_id FROM risk_flag WHERE run_id = %s)", (run_id,))
            conn.execute("DELETE FROM risk_flag WHERE run_id = %s", (run_id,))
            count = _save_risks(ctx, run_id, candidates)
        return {"risk_count": count, "readable_ids": readable}
    return node


def readable_documents(conn: psycopg.Connection, document_ids: list[int]) -> list[int]:
    return [r[0] for r in conn.execute(
        "SELECT document_id FROM document WHERE document_id = ANY(%s) AND readable ORDER BY 1",
        (document_ids,))]


def rebuild_outputs(ctx: RunContext, run_id: int, document_ids: list[int]) -> dict[str, int]:
    """판정 뒤 단계(보증값·손실·목록·제안)를 다시 만든다.

    제품을 바꾸거나 손실값을 고친 뒤에도 쓴다.
    """
    state: RunState = {"run_id": run_id, "readable_ids": document_ids}
    counts = {}
    for _, key, build in STEPS:
        counts[key] = build(ctx, state)
        ctx.conn.commit()
    return counts


def _judge_node(ctx: RunContext):
    def node(state: RunState) -> RunState:
        _set_step(ctx.conn, state["run_id"], "judge")
        count = judge_run(ctx.conn, state["run_id"], state["readable_ids"])
        ctx.conn.commit()
        return {"judgment_count": count}
    return node


def _step_node(ctx: RunContext, step: str, key: str, build):
    def node(state: RunState) -> RunState:
        _set_step(ctx.conn, state["run_id"], step)
        count = build(ctx, state)
        ctx.conn.commit()
        return {key: count}
    return node


STEPS = [
    ("check", "check_count",
     lambda ctx, s: build_checks(ctx.conn, s["run_id"], s["readable_ids"])),
    ("warranty", "warranty_count", lambda ctx, s: build_warranty(ctx.conn, s["run_id"])),
    ("loss", "loss_count", lambda ctx, s: build_losses(ctx.conn, s["run_id"])),
    ("outputs", "output_count",
     lambda ctx, s: build_outputs(ctx.conn, s["run_id"], s["readable_ids"], ctx.llm)),
    ("proposals", "proposal_count",
     lambda ctx, s: build_proposals(ctx.conn, s["run_id"], ctx.llm)),
    ("assign", "assignment_count", lambda ctx, s: build_assignments(ctx.conn, s["run_id"])),
]
COUNTS = ["risk_count", "judgment_count"] + [key for _, key, _ in STEPS]


def build_graph(ctx: RunContext):
    graph = StateGraph(RunState)
    graph.add_node("documents", _documents_node(ctx))
    graph.add_node("pairs", _pairs_node(ctx))
    graph.add_node("risks", _risks_node(ctx))
    graph.add_node("judge", _judge_node(ctx))
    order = ["documents", "pairs", "risks", "judge"]
    for step, key, build in STEPS:
        graph.add_node(step, _step_node(ctx, step, key, build))
        order.append(step)
    graph.add_edge(START, order[0])
    for a, b in zip(order, order[1:], strict=False):
        graph.add_edge(a, b)
    graph.add_edge(order[-1], END)
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
        (Jsonb({"step": "done", **{k: state.get(k, 0) for k in COUNTS}}), run_id))
    conn.commit()
    return "ENGINEER_REVIEW"


def switch_product(ctx: RunContext, run_id: int, group: str, product_code: str | None,
                   chosen_by: int | None = None) -> dict[str, int]:
    """엔지니어가 설비 묶음의 비교 제품을 바꾼다 (None이면 자동 선택으로 되돌린다).

    그 묶음만 다시 판정하고(이전 판정은 is_current = false로 남긴다) 뒤 단계를 다시 만든다.
    """
    conn = ctx.conn
    if product_code is not None and conn.execute(
            "SELECT 1 FROM product_master WHERE product_code = %s",
            (product_code,)).fetchone() is None:
        raise KeyError(product_code)
    with conn.transaction():
        if product_code is None:
            conn.execute("DELETE FROM run_product_choice WHERE run_id = %s "
                         "AND equipment_group = %s", (run_id, group))
        else:
            conn.execute(
                """INSERT INTO run_product_choice (run_id, equipment_group, product_code,
                                                   chosen_by)
                   VALUES (%s, %s, %s, %s)
                   ON CONFLICT (run_id, equipment_group) DO UPDATE
                   SET product_code = EXCLUDED.product_code, chosen_by = EXCLUDED.chosen_by,
                       chosen_at = now()""", (run_id, group, product_code, chosen_by))
    ids = readable_documents(conn, [r[0] for r in conn.execute(
        "SELECT document_id FROM run_document WHERE run_id = %s", (run_id,))])
    counts = {"judgment_count": judge_run(conn, run_id, ids, only_groups={group})}
    conn.commit()
    return counts | rebuild_outputs(ctx, run_id, ids)
