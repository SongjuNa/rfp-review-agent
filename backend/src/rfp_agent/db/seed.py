"""규칙 사전·제품표를 DB에 적재한다.

- 고정 코드표(유형 7종, 승인 기준, 칸 이름, 회사 고정값)는 db/migrations 에 있다.
- 규칙 사전은 data/seed/*.csv, 제품표는 data/seed/products/*.csv.
같은 파일을 여러 번 적재해도 결과가 같다 (CR-11).
"""

import csv
import hashlib
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

STRENGTH_CODES = {"클수록 좋음": "HIGHER", "작을수록 좋음": "LOWER", "강점 아님": "NONE"}

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
# 카탈로그 문장에서 정격 주파수·용량을 칸으로 옮긴다 (판정에 자주 쓰임). 단위는 그대로 둔다.
FREQUENCY = [re.compile(r"주파수\s*(\d+(?:/\d+)?)\s*Hz"), re.compile(r"(?<![\d~.])(\d+/\d+)\s*Hz"),
             re.compile(r"(?<![\d~.])(\d+)\s*Hz")]
CAPACITY = re.compile(r"(?<![\d.])(\d[\d,]*(?:\.\d+)?)(?:/[\d.,]+)*\s*(MVA|kVA)(?![A-Za-z])")


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


def strength_code(text: str, where: str) -> str | None:
    if not text:
        return None
    try:
        return STRENGTH_CODES[text]
    except KeyError:
        raise SeedError(f"{where}: 강점 방향 '{text}'을 코드로 바꿀 수 없음") from None


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
            """INSERT INTO item_key (item_key, name_ko, default_direction, strength_direction, note)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT (item_key) DO UPDATE SET name_ko = EXCLUDED.name_ko,
                 default_direction = EXCLUDED.default_direction,
                 strength_direction = EXCLUDED.strength_direction, note = EXCLUDED.note""",
            (key, row["한글 이름"], direction_code(row["기본 비교 방향"], key),
             strength_code(row["강점 방향"], key) or "NONE", blank_to_none(row["비고"])),
        )
        conn.execute("DELETE FROM item_alias WHERE item_key = %s", (key,))
        aliases = (a.strip() for a in row["같은 뜻의 원문 표현(;로 구분)"].split(";"))
        for alias in filter(None, aliases):
            conn.execute("INSERT INTO item_alias (item_key, alias_text) VALUES (%s, %s)",
                         (key, alias))
    report.counts["item_key"] = len(rows)


def seed_compare_rules(conn: psycopg.Connection, rows: list[dict[str, str]], report: SeedReport):
    keep = []
    for row in rows:
        where = f"{row['대상 표']} {row['항목 번호']}"
        direction_text = row["비교 방향"]
        values = (table_name_of(row["대상 표"]), row["항목 번호"],
                  blank_to_none(row["표준 항목키"]),
                  direction_code(direction_text, where), "+시간" in direction_text,
                  strength_code(row["강점 방향"], where),
                  "; ".join(filter(None, [row["처리"], row["비고(사례)"]])) or None)
        row_id = conn.execute(
            """INSERT INTO compare_rule (table_name, item_no, item_key, direction, time_condition,
                                         strength_direction, process_note)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (table_name, item_no, COALESCE(item_key, '')) DO UPDATE SET
                 direction = EXCLUDED.direction, time_condition = EXCLUDED.time_condition,
                 strength_direction = EXCLUDED.strength_direction,
                 process_note = EXCLUDED.process_note
               RETURNING compare_rule_id""",
            values,
        ).fetchone()[0]
        keep.append(row_id)
    conn.execute("DELETE FROM compare_rule WHERE NOT (compare_rule_id = ANY(%s))", (keep,))
    report.counts["compare_rule"] = len(rows)


def seed_risk_expressions(conn: psycopg.Connection, rows: list[dict[str, str]],
                          report: SeedReport):
    for row in rows:
        expr = row["표현"]
        if row["종류"] not in RISK_KINDS:
            raise SeedError(f"위험 표현 '{expr}': 종류 '{row['종류']}'을 코드로 바꿀 수 없음")
        conn.execute(
            """INSERT INTO risk_expression (expression, language, risk_kind, context_rule)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (expression) DO UPDATE SET language = EXCLUDED.language,
                 risk_kind = EXCLUDED.risk_kind, context_rule = EXCLUDED.context_rule""",
            # 사전 초안에서 조건이 빈 줄은 팀이 아직 정하지 않은 것이다.
            (expr, LANGUAGES[row["언어"]], RISK_KINDS[row["종류"]],
             row["위험 후보로 보는 조건"] or "(조건 미정)"),
        )
    conn.execute("DELETE FROM risk_expression WHERE NOT (expression = ANY(%s))",
                 ([r["표현"] for r in rows],))
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


def seed_document_catalog(conn: psycopg.Connection, rows: list[dict[str, str]],
                          report: SeedReport):
    for key in sorted({r["project_key"] for r in rows if r["project_key"]}):
        conn.execute(
            "INSERT INTO project (project_name, project_key, is_confirmed) VALUES (%s, %s, TRUE) "
            "ON CONFLICT (project_key) DO NOTHING",
            (f"사업 {key}", key),
        )
    conn.execute("DELETE FROM document_catalog")
    for row in rows:
        conn.execute(
            """INSERT INTO document_catalog (file_no, file_key, bundle, language, project_key, note)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (int(row["file_no"]), row["file_key"], row["bundle"], row["language"],
             row["project_key"] or None, row["note"] or None),
        )
    report.counts["document_catalog"] = len(rows)


def seed_column_roles(conn: psycopg.Connection, rows: list[dict[str, str]], report: SeedReport):
    for row in rows:
        conn.execute(
            "INSERT INTO column_role_dict (header_text, column_role) VALUES (%s, %s) "
            "ON CONFLICT (header_text) DO UPDATE SET column_role = EXCLUDED.column_role",
            (row["header_text"], row["column_role"]),
        )
    report.counts["column_role_dict"] = len(rows)


def seed_target_objects(conn: psycopg.Connection, rows: list[dict[str, str]],
                        report: SeedReport):
    conn.execute("DELETE FROM target_object_dict")
    for row in rows:
        conn.execute(
            "INSERT INTO target_object_dict (term, target_object, parent_object) "
            "VALUES (%s, %s, %s)",
            (row["term"].lower(), row["target_object"], row["parent_object"] or None),
        )
    report.counts["target_object_dict"] = len(rows)


def seed_type_rules(conn: psycopg.Connection, rows: list[dict[str, str]], report: SeedReport):
    for row in rows:
        conn.execute(
            """INSERT INTO type_rule (rule_code, pattern, type_code, match_kind, priority)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT (rule_code) DO UPDATE SET pattern = EXCLUDED.pattern,
                 type_code = EXCLUDED.type_code, match_kind = EXCLUDED.match_kind,
                 priority = EXCLUDED.priority""",
            (row["rule_code"], row["pattern"], row["type_code"], row["match_kind"],
             int(row["priority"])),
        )
    conn.execute("DELETE FROM type_rule WHERE NOT (rule_code = ANY(%s))",
                 ([r["rule_code"] for r in rows],))
    report.counts["type_rule"] = len(rows)


SEED_STEPS = [
    ("item_keys.csv", seed_item_keys),
    ("compare_rules.csv", seed_compare_rules),
    ("risk_expressions.csv", seed_risk_expressions),
    ("item_pm_mapping.csv", seed_item_pm_mapping),
    ("document_catalog.csv", seed_document_catalog),
    ("column_roles.csv", seed_column_roles),
    ("target_objects.csv", seed_target_objects),
    ("type_rules.csv", seed_type_rules),
]


def dict_version(seed_dir: Path) -> str:
    """사전·제품표 파일 내용으로 만든 판 번호. 같은 파일이면 같은 판이다 (CR-11)."""
    digest = hashlib.sha256()
    for path in sorted(seed_dir.rglob("*.csv")):
        digest.update(path.relative_to(seed_dir).as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()[:12]


def seed_rules(conn: psycopg.Connection, seed_dir: Path) -> SeedReport:
    report = SeedReport()
    with conn.transaction():
        for name, step in SEED_STEPS:
            step(conn, read_csv(seed_dir / name), report)
    return report


def product_row(row: dict[str, str]) -> dict[str, object]:
    values: dict[str, object] = {c: (row.get(c) or None) for c in PRODUCT_COLUMNS}
    values["lifecycle_status"] = values["lifecycle_status"] or "UNKNOWN"
    values["is_assumed"] = values["is_assumed"] or "N"
    description = row.get("description") or ""
    values["is_design_card"] = description.startswith(DESIGN_CARD_MARK)
    values["rated_frequency"] = next(
        (m.group(1) for p in FREQUENCY if (m := p.search(description))), None)
    # 정격 용량은 변압기만 (차단기의 "차단용량 … MVA"는 다른 값이다)
    capacity = (CAPACITY.search(row.get("product_name") or "") or CAPACITY.search(description)
                if row.get("family") == "TRANSFORMER" else None)
    values["rated_capacity"] = float(capacity.group(1).replace(",", "")) if capacity else None
    values["rated_capacity_unit"] = capacity.group(2) if capacity else None
    return values


def seed_products(conn: psycopg.Connection, product_files: list[Path],
                  loss_file: Path | None = None, replace: bool = False) -> SeedReport:
    """뒤에 오는 파일이 같은 product_code를 덮어쓴다 (여러 파일을 줄 때).

    replace면 이전 제품표와 그 제품을 참조하는 검토 실행 결과를 모두 지우고 파일 내용만 남긴다.
    """
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
            product["rated_frequency"] = (product["rated_frequency"] or row.get("frequency_hz")
                                          or None)
            if any(losses.values()):
                product["loss_is_assumed"] = row.get("is_assumed") == "Y"

    columns = [*PRODUCT_COLUMNS, "is_design_card", "rated_frequency", "rated_capacity",
               "rated_capacity_unit", *LOSS_COLUMNS.values(), "loss_is_assumed"]
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in columns if c != "product_code")
    with conn.transaction():
        if replace:
            # 판정·보증값·손실 등이 제품 행을 참조하므로 검토 실행도 함께 비운다
            conn.execute("TRUNCATE review_run, product_master, product_family CASCADE")
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
    stale = conn.execute("SELECT count(*) FROM product_master WHERE product_code <> ALL(%s)",
                         (list(products),)).fetchone()[0]
    if stale:
        report.skipped.append(f"파일에 없는 이전 제품 {stale}개가 DB에 남아 있음 "
                              "(비우려면 seed-products --replace)")
    return report
