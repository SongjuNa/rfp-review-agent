"""흐름 안의 멈춤 지점과 이어서 다시 시도 (update-graph-stops, C2).

검토 하나 = 흐름 하나(thread_id `run-<run_id>`). 단계마다 흐름 상태를 같은 PostgreSQL에
저장(LangGraph checkpoint)하고, 담당자 확인·승인 대기·반려됨에서 흐름이 실제로 멈춘다.
화면이 읽는 단계 칸(review_run.stage)은 그대로 쓰고, 사람 동작 함수가 단계를 바꾼 뒤
같은 트랜잭션 안에서 흐름을 멈춘 자리에서 이어 간다. 흐름 기록이 없는 예전 검토는 건드리지 않는다.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import psycopg
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.types import Command
from psycopg.rows import dict_row

# 사람 동작 → 그 동작을 받는 멈춤 자리
ACTION_STOP = {"submit": "engineer_review", "add_documents": "engineer_review",
               "approve": "approval", "reject": "approval", "withdraw": "approval",
               "reopen": "rejected"}
NO_FLOW = None        # 흐름 기록이 없음 (이 change 전에 만든 검토)
RUNNING = ""          # 흐름이 멈춤 자리가 아닌 곳에 있음 (처리 중·실패·취소)
ENDED = "END"         # 흐름이 끝남 (승인됨)


def config(run_id: int) -> dict:
    return {"configurable": {"thread_id": f"run-{run_id}"}}


def setup_checkpoints(conn: psycopg.Connection) -> None:
    """흐름 저장소 표를 만든다 (라이브러리 자체 마이그레이션, 여러 번 불러도 됨).

    CREATE INDEX CONCURRENTLY가 있어 트랜잭션 밖(autocommit)에서 돌린다.
    """
    conn.commit()
    before = conn.autocommit
    conn.autocommit = True
    try:
        PostgresSaver(conn).setup()
    finally:
        conn.autocommit = before


def _saver_conn(conn: psycopg.Connection) -> psycopg.Connection:
    """같은 DB로 자동 커밋 연결을 하나 더 연다 (흐름 저장은 처리 트랜잭션과 따로 바로 남긴다)."""
    info = conn.info
    return psycopg.connect(info.dsn, password=info.password, autocommit=True,
                           prepare_threshold=0, row_factory=dict_row)


def open_like(conn: psycopg.Connection) -> psycopg.Connection:
    """같은 DB로 보통(트랜잭션) 연결을 하나 더 연다 (문서 병렬 처리의 스레드마다)."""
    info = conn.info
    return psycopg.connect(info.dsn, password=info.password)


@contextmanager
def saver_for(ctx) -> Iterator[PostgresSaver]:
    if getattr(ctx, "checkpointer", None) is not None:
        yield ctx.checkpointer
        return
    with _saver_conn(ctx.conn) as side:
        yield PostgresSaver(side)


def stop_of(graph, run_id: int) -> str | None:
    """흐름이 멈춘 자리: 사람 단계 노드 이름, RUNNING, ENDED, 또는 NO_FLOW."""
    snap = graph.get_state(config(run_id))
    if not snap.values:
        return NO_FLOW
    for task in snap.tasks:
        if task.interrupts:
            return task.name
    return RUNNING if snap.next else ENDED


def next_node(graph, run_id: int) -> str | None:
    snap = graph.get_state(config(run_id))
    return snap.next[0] if snap.next else None


def start_input(graph, run_id: int, inputs: dict) -> tuple[Any, str | None]:
    """처리를 시작할 입력과 이어서 시작하는 단계(처음부터면 None).

    - 흐름 기록 없음: 처음부터
    - 담당자 확인에서 멈춤: 문서 추가 → 문서 처리부터 다시 (처음 파일 + 더한 파일)
    - 처리 중간에 멈춤(실패·취소): 멈춘 단계부터 이어서
    """
    stop = stop_of(graph, run_id)
    if stop is NO_FLOW:
        return inputs, None
    if stop == "engineer_review":
        return Command(resume={"action": "add_documents", "paths": inputs["paths"],
                               "choices": inputs["choices"]}), None
    if stop == RUNNING:
        return None, next_node(graph, run_id)
    raise RuntimeError(f"검토 실행 {run_id}의 흐름이 처리할 수 없는 자리({stop})에 있습니다.")


def advance(conn: psycopg.Connection, run_id: int, action: str) -> None:
    """사람 동작 함수가 단계를 바꾼 뒤 부른다: 흐름을 멈춘 자리에서 이어 간다.

    흐름 기록이 없으면 아무것도 하지 않는다. 흐름이 그 동작을 받는 자리에 있지 않으면
    409로 거절한다(호출한 쪽 트랜잭션이 되돌려 단계도 그대로 남는다).
    """
    from rfp_agent.pipeline.review import ReviewError
    from rfp_agent.pipeline.run import RunContext, build_graph

    with _saver_conn(conn) as side:
        graph = build_graph(RunContext(conn, "", None, None), PostgresSaver(side))
        stop = stop_of(graph, run_id)
        if stop is NO_FLOW:
            return
        if stop != ACTION_STOP[action]:
            raise ReviewError(409, f"검토 흐름이 멈춘 자리({stop or '처리 중'})와 단계가 맞지 "
                                   "않아 처리하지 않았습니다. 관리자에게 알려 주세요.")
        graph.invoke(Command(resume={"action": action}), config(run_id))
