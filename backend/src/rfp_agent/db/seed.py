"""규칙 사전·제품표를 DB에 적재한다.

- 고정 코드표(유형 7종, 승인 기준, 칸 이름, 회사 고정값)는 db/migrations 에 있다.
- 규칙 사전 4종은 data/seed/*.csv, 제품표는 data/seed/products/*.csv.
같은 파일을 여러 번 적재해도 결과가 같다 (CR-11).
"""

import csv
import re
from dataclasses import dataclass, field
from pathlib import Path

import psycopg

# 사전의 기호 표기 → compare_rule/item_key 방향 코드
DIRECTION_CODES = {
    "=": "EQ",
    "= (문자열)": "EQ",
    "≥": "GE",
    "≥ (+시간)": "GE",
    "≥ (+시간 조건)": "GE",
    "≥ (IP 코드 비교)": "GE",
    "≥ (제품 허용 고도)": "GE",
    "≥ (제품 허용 범위가 요구 포함)": "GE",
    "≤": "LE",
    "<": "LT",
    "≤ / < (원문 기호 따름)": "SOURCE",
    "< / ≤ / >": "SOURCE",
    "포함": "IN",
    "포함 (규격 번호 일치)": "IN",
    "작성": "FILL",
    "AI 읽기": "AI",
}

RISK_KINDS = {
    "포괄 조항": "BLANKET",
    "포괄 조항(간주)": "BLANKET",
    "비용 전가": "COST_SHIFT",
    "범위 모호": "OPEN_SCOPE",
}

LANGUAGES = {"영어": "en", "한국어": "ko"}

FIXED_VALUE_PREFIX = "(회사 고정값)"

USAGES = {"보증값 작성": "FILL", "비교": "COMPARE", "비교 / 보증값 작성": "BOTH"}

PRODUCT_COLUMNS = [
    "product_code", "product_name", "family", "description", "standards", "certifications",
    "has_firmware", "fw_latest", "warranty_months", "lifecycle_status", "std_lead_time_weeks",
    "moq", "list_price_usd", "weight_kg", "dimensions_mm", "ip_rating", "operating_temp",
    "tech_support_dept", "doc_ids", "rated_voltage_kv", "rated_current_a", "short_circuit_ka",
    "is_assumed", "source_doc", "market",
]
LOSS_COLUMNS = {"no_load_loss_kw": "noload_loss_kw", "load_loss_kw": "load_loss_kw",
                "aux_loss_kw": "aux_loss_kw"}
DESIGN_CARD_MARK = "[설계 사례 카드"


class SeedError(ValueError):
    """사전 파일에 코드로 옮길 수 없는 값이 있다."""


@dataclass
class SeedReport:
    counts: dict[str, int] = field(default_factory=dict)
    skipped: list[str] = field(default_factory=list)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return [{k.strip(): (v or "").strip() for k, v in row.items()} for row in csv.DictReader(f)]


def direction_code(text: str, where: str) -> str:
    try:
        return DIRECTION_CODES[text]
    except KeyError:
        raise SeedError(f"{where}: 비교 방향 '{text}'을 코드로 바꿀 수 없음") from None


def blank_to_none(value: str) -> str | None:
    return value if value and value != "—" else None


def table_name_of(target: str) -> str:
    """'파일1 TS-115-GIS (115 kV GIS)' → 'TS-115-GIS'"""
    m = re.search(r"\b(TS-[A-Z0-9-]+)", target)
    if not m:
        raise SeedError(f"대상 표 '{target}'에서 표 이름을 찾지 못함")
    return m.group(1)


def seed_item_keys(conn: psycopg.Connection, rows: list[dict[str, str]], report: SeedReport):
    for row in rows:
        key = row["표준 항목키"]
        conn.execute(
            """INSERT INTO item_key (item_key, name_ko, default_direction, note)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (item_key) DO UPDATE SET name_ko = EXCLUDED.name_ko,
                 default_direction = EXCLUDED.default_direction, note = EXCLUDED.note""",
            (key, row["한글 이름"], direction_code(row["기본 비교 방향"], key),
             blank_to_none(row["비고"])),
        )
        conn.execute("DELETE FROM item_alias WHERE item_key = %s", (key,))
        aliases = (a.strip() for a in row["같은 뜻의 원문 표현(;로 구분)"].split(";"))
        for alias in filter(None, aliases):
            conn.execute("INSERT INTO item_alias (item_key, alias_text) VALUES (%s, %s)",
                         (key, alias))
    report.counts["item_key"] = len(rows)


def seed_compare_rules(conn: psycopg.Connection, rows: list[dict[str, str]], report: SeedReport):
    conn.execute("DELETE FROM compare_rule")
    for row in rows:
        where = f"{row['대상 표']} {row['항목 번호']}"
        direction_text = row["비교 방향"]
        conn.execute(
            """INSERT INTO compare_rule
                 (table_name, item_no, item_key, direction, time_condition, process_note)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (table_name_of(row["대상 표"]), row["항목 번호"], blank_to_none(row["표준 항목키"]),
             direction_code(direction_text, where), "+시간" in direction_text,
             "; ".join(filter(None, [row["처리"], row["비고(사례)"]])) or None),
        )
    report.counts["compare_rule"] = len(rows)


def seed_risk_expressions(conn: psycopg.Connection, rows: list[dict[str, str]],
                          report: SeedReport):
    conn.execute("DELETE FROM risk_expression")
    for row in rows:
        expr = row["표현"]
        if row["종류"] not in RISK_KINDS:
            raise SeedError(f"위험 표현 '{expr}': 종류 '{row['종류']}'을 코드로 바꿀 수 없음")
        conn.execute(
            """INSERT INTO risk_expression (expression, language, risk_kind, context_rule)
               VALUES (%s, %s, %s, %s)""",
            # 사전 초안에서 조건이 빈 줄은 팀이 아직 정하지 않은 것이다.
            (expr, LANGUAGES[row["언어"]], RISK_KINDS[row["종류"]],
             row["위험 후보로 보는 조건"] or "(조건 미정)"),
        )
    report.counts["risk_expression"] = len(rows)


def seed_item_pm_mapping(conn: psycopg.Connection, rows: list[dict[str, str]],
                         report: SeedReport):
    conn.execute("DELETE FROM item_pm_mapping")
    count = 0
    for row in rows:
        key, target, usage = row["표준 항목키"], row["product_master 열 (또는 고정값)"], row["용도"]
        if usage not in USAGES:
            # "그 외 항목 → 확인 필요" 같은 안내 줄은 연결이 아니다.
            report.skipped.append(f"item_pm_mapping: {key} ({usage})")
            continue
        if target.startswith(FIXED_VALUE_PREFIX):
            pm_column, fixed_key = None, key
            conn.execute(
                """INSERT INTO company_fixed_value (fixed_key, fixed_value) VALUES (%s, %s)
                   ON CONFLICT (fixed_key) DO UPDATE SET fixed_value = EXCLUDED.fixed_value""",
                (key, target.removeprefix(FIXED_VALUE_PREFIX).strip()),
            )
        else:
            # "short_circuit_ka (+ description의 시간)" → short_circuit_ka
            pm_column, fixed_key = target.split()[0], None
        conn.execute(
            "INSERT INTO item_pm_mapping (item_key, pm_column, fixed_key, usage) "
            "VALUES (%s, %s, %s, %s)",
            (key, pm_column, fixed_key, USAGES[usage]),
        )
        count += 1
    report.counts["item_pm_mapping"] = count


def seed_rules(conn: psycopg.Connection, seed_dir: Path) -> SeedReport:
    report = SeedReport()
    with conn.transaction():
        seed_item_keys(conn, read_csv(seed_dir / "item_keys.csv"), report)
        seed_compare_rules(conn, read_csv(seed_dir / "compare_rules.csv"), report)
        seed_risk_expressions(conn, read_csv(seed_dir / "risk_expressions.csv"), report)
        seed_item_pm_mapping(conn, read_csv(seed_dir / "item_pm_mapping.csv"), report)
    return report


def product_row(row: dict[str, str]) -> dict[str, object]:
    values: dict[str, object] = {c: (row.get(c) or None) for c in PRODUCT_COLUMNS}
    values["lifecycle_status"] = values["lifecycle_status"] or "UNKNOWN"
    values["is_assumed"] = values["is_assumed"] or "N"
    values["is_design_card"] = (row.get("description") or "").startswith(DESIGN_CARD_MARK)
    return values


def seed_products(conn: psycopg.Connection, product_files: list[Path],
                  loss_file: Path | None = None) -> SeedReport:
    """뒤에 오는 파일이 같은 product_code를 덮어쓴다 (예: TRF_v2가 입력용의 TRF-HV를)."""
    report = SeedReport()
    products: dict[str, dict[str, object]] = {}
    families: dict[str, str] = {}
    for path in product_files:
        for row in read_csv(path):
            products[row["product_code"]] = product_row(row)
            families.setdefault(row["family"], row["family_name"])
    if loss_file:
        for row in read_csv(loss_file):
            product = products.get(row["product_code"])
            if product is None:
                report.skipped.append(f"loss: {row['product_code']} (제품표에 없음)")
                continue
            losses = {dst: row.get(src) or None for src, dst in LOSS_COLUMNS.items()}
            product.update(losses)
            if any(losses.values()):
                product["loss_is_assumed"] = row.get("is_assumed") == "Y"

    columns = [*PRODUCT_COLUMNS, "is_design_card", *LOSS_COLUMNS.values(), "loss_is_assumed"]
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in columns if c != "product_code")
    with conn.transaction():
        for family, name in families.items():
            conn.execute(
                "INSERT INTO product_family (family, family_name) VALUES (%s, %s) "
                "ON CONFLICT (family) DO NOTHING",
                (family, name),
            )
        for product in products.values():
            conn.execute(
                f"INSERT INTO product_master ({', '.join(columns)}) "
                f"VALUES ({', '.join(['%s'] * len(columns))}) "
                f"ON CONFLICT (product_code) DO UPDATE SET {updates}",
                [product.get(c) for c in columns],
            )
    report.counts["product_family"] = len(families)
    report.counts["product_master"] = len(products)
    return report
