"""기준 데이터 읽기 API (SCR-16 제품표, SCR-17 판정 규칙). 모두 읽기 전용."""

from fastapi import APIRouter, HTTPException, Query, Response

from rfp_agent.api.schemas import (
    CompareRule,
    DocKindRule,
    ItemKey,
    Product,
    ProductDetail,
    ProductFamily,
    RiskExpression,
)
from rfp_agent.db.connection import connect
from rfp_agent.pipeline import reference

router = APIRouter(prefix="/api")


@router.get("/products")
def products(response: Response, family: str | None = None, q: str | None = None,
             offset: int = 0, limit: int = Query(100, le=500), cards: bool = True) -> list[Product]:
    """제품 목록: 제품군 거르기, 코드·이름 검색. 빈 칸 수·팀 가정·판정에 쓰인 수를 함께 낸다."""
    with connect() as conn:
        response.headers["X-Total-Count"] = str(reference.count_products(conn, family, q, cards))
        return reference.products(conn, family, q, offset, limit, cards)


@router.get("/products/families")
def product_families() -> list[ProductFamily]:
    """제품군 탭과 위 요약 칸."""
    with connect() as conn:
        return reference.families(conn)


@router.get("/products/{code}")
def product(code: str) -> ProductDetail:
    """제품 하나: 전체 칸, 판정에 쓰인 곳, 제안 포인트, 같은 제품군 현장 이력."""
    with connect() as conn:
        try:
            return reference.product(conn, code)
        except reference.NotFound as e:
            raise HTTPException(404, str(e)) from e


@router.get("/rules/compare")
def compare_rules() -> list[CompareRule]:
    with connect() as conn:
        return reference.compare_rules(conn)


@router.get("/rules/items")
def rule_items() -> list[ItemKey]:
    with connect() as conn:
        return reference.items(conn)


@router.get("/rules/risk-expressions")
def risk_expressions() -> list[RiskExpression]:
    with connect() as conn:
        return reference.risk_expressions(conn)


@router.get("/rules/doc-kinds")
def doc_kind_rules() -> list[DocKindRule]:
    """문서 종류 규칙 사전 (순서대로). 고치기는 data/seed를 고쳐 다시 적재한다."""
    with connect() as conn:
        return reference.doc_kind_rules(conn)
