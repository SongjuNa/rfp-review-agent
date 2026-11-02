"""FR-03 요구사항 추출. 표의 데이터시트 행은 모두 후보, 문장은 정해진 표현으로 1차 후보."""

import re
from dataclasses import dataclass, field

from rfp_agent.pipeline.docx_reader import Block
from rfp_agent.pipeline.structure import LogicalTable, Section, SectionIndex, TableRow, normalize

SENTENCE_MARKERS = re.compile(
    r"\b(shall|must|required|is to be|are to be|not exceeding|not less than|at least)\b"
    r"|하여야|되어야|할 것|한다\s*\.?$|하여야 한다",
    re.IGNORECASE,
)
WRITING_RULE = re.compile(
    r"not allow(?:ed)? to use|\bfill(?:ing|ed)?\b.*\bcolumn\b|excel format"
    r"|bidder shall indicate their data|기재하지 않|작성 요령",
    re.IGNORECASE,
)
ROMAN = re.compile(r"^(?:[IVX]+|[A-Z])\.?$")
# 사양 목록 줄 ("1)UPS 30kVA", "정격전압 : 154 kV")은 문장 표현이 없어도 값이 있으면 후보다.
SPEC_VALUE = re.compile(r"\d\s*(?:kVA|MVA|kV|kA|kW|MW|A|V|Hz|%|℃|°C)(?![A-Za-z])")
CHAPTER_STYLES = ("NUM", "PART", "CHAPTER")       # 장·절 번호 제목은 값이 있어도 제목이다
STANDARD_TITLE = re.compile(r"\bPart\s+\d+\s*:")    # 규격 목록 줄 ("… Part 103: … 52 kV")

# 문서 종류별 추출 규칙 (add-kind-extract-rules, C1). 처리기가 고르고, 규칙 자체는 코드다(CR-01).
MARK_TABLE_ROWS = "MARK_TABLE_ROWS"     # 공급사 답안: 표시 있는 문서의 표 조항 줄은 모두 후보
FORM_NOTES = "FORM_NOTES"               # 입찰 서식: 표 밖 서식 작성 안내 문장은 작성 규칙
MIN_CLAUSE = 15                         # 답안 표 조항 줄 최소 글자 수 (요구사항 정답지와 같은 기준)
FORM_NOTE = re.compile(
    r"\bfill(?:ed|ing)?\s+(?:out|in)\b|\bthis form\b|\bfollowing table\b|\[note:"
    r"|\btypewritten\b|\bin print form\b",
    re.IGNORECASE,
)


@dataclass
class Candidate:
    block: Block
    source_kind: str                 # SENTENCE / TABLE_CELL / SUPPLIER_ANSWER
    text: str
    req_kind: str                    # REQUIREMENT / WRITING_RULE / HEADER / TOC
    rule_id: str
    section: Section | None
    table: LogicalTable | None = None
    row: TableRow | None = None
    supplier_mark: str | None = None
    part_title: str | None = None    # 표 안 로마 숫자 구분 행 제목 (예: "Circuit Breaker")
    extracted_by: str = "RULE"
    dedup_key: str = field(default="")
    line_offset: int = 0             # 제목 줄 뒤 본문만 쓸 때 건너뛴 줄 수

    @property
    def line_start(self) -> int:
        return self.block.line_no + self.line_offset


def row_text(row: TableRow) -> str:
    parts = [row.item_no, row.item_name, row.unit, row.required]
    return " / ".join(p.strip() for p in parts if p and p.strip())


def _row_kind(row: TableRow) -> tuple[str, str]:
    text = " ".join(filter(None, [row.item_name, row.required]))
    if WRITING_RULE.search(text):
        return "WRITING_RULE", "E-WRITING-RULE"
    if row.item_no and ROMAN.match(row.item_no.strip()) and not row.required and not row.unit:
        return "HEADER", "E-PART-HEADER"
    return "REQUIREMENT", "E-TABLE-ROW"


def _clause(row: TableRow) -> str | None:
    """답안 표의 조항 원문: 가장 긴 칸. 짧거나 소문자가 없는 줄(제목·머리)은 None."""
    text = max(row.block.cells, key=len).strip() if row.block.cells else ""
    return text if len(text) >= MIN_CLAUSE and any(c.islower() for c in text) else None


def extract(blocks: list[Block], sections: list[Section],
            tables: list[LogicalTable], rules: frozenset[str] = frozenset(),
            risk_patterns: list[re.Pattern] | None = None) -> list[Candidate]:
    """rules는 처리기가 고른 문서 종류별 추출 규칙 (없으면 모든 종류 공통 규칙만).

    risk_patterns(위험 표현 사전)가 든 문장은 종류별 규칙으로 작성 규칙이 되지 않는다(FR-06).
    """
    risky = risk_patterns or []
    out: list[Candidate] = []
    toc_seqs = {s.block_seq for s in sections if s.is_toc}
    heading_style = {s.block_seq: s.style for s in sections if not s.is_toc and s.line_offset == 0}
    heading_seqs = set(heading_style)
    table_seqs: set[int] = set()
    index = SectionIndex(sections)

    # 문서에 C/D/E 표시 줄이 하나라도 있으면 모든 표의 조항 줄이 답안 조항이다 (MARK_TABLE_ROWS)
    marked_doc = MARK_TABLE_ROWS in rules and any(r.supplier_mark for t in tables for r in t.rows)
    for table in tables:
        part = None
        mark_table = marked_doc
        for row in table.rows:
            table_seqs.add(row.block.seq)
            sec = index.at(row.block.seq)
            if table.is_datasheet:
                kind, rule = _row_kind(row)
                if kind == "HEADER":
                    part = row.item_name
                out.append(Candidate(
                    block=row.block, source_kind="TABLE_CELL", text=row_text(row) or row.block.text,
                    req_kind=kind, rule_id=rule, section=sec, table=table, row=row,
                    part_title=part,
                    dedup_key="T|" + "|".join(normalize(x or "").lower() for x in
                                              (table.name, row.item_no, row.item_name,
                                               row.unit, row.required)),
                ))
            elif row.supplier_mark or (mark_table and _clause(row)):
                # 답안 표 조항 줄: 표시가 없거나 못 읽은 줄도 후보 (MARK_TABLE_ROWS)
                text = max(row.block.cells, key=len)
                out.append(Candidate(
                    block=row.block, source_kind="SUPPLIER_ANSWER", text=text,
                    req_kind="REQUIREMENT",
                    rule_id="E-SUPPLIER-MARK" if row.supplier_mark else "E-MARK-TABLE-ROW",
                    section=sec, table=table, row=row, supplier_mark=row.supplier_mark,
                    dedup_key="A|" + normalize(text).lower(),
                ))
            else:
                text = " | ".join(c.strip() for c in row.block.cells if c.strip())
                if SENTENCE_MARKERS.search(text):
                    out.append(_sentence(row.block, text, sec, table=table))

    for b in blocks:
        if b.kind != "P" or b.seq in table_seqs or not b.text.strip():
            continue
        sec = index.at(b.seq)
        if b.seq in toc_seqs:
            continue
        raw, offset = b.text, 0
        first = normalize(raw.strip().split("\n")[0])
        spec_line = SPEC_VALUE.search(first) and not STANDARD_TITLE.search(first)
        if b.seq in heading_seqs and spec_line \
                and not heading_style[b.seq].startswith(CHAPTER_STYLES):
            out.append(_spec_value(b, normalize(raw), sec))
            continue
        if b.seq not in heading_seqs and ":" in first and spec_line \
                and not SENTENCE_MARKERS.search(raw):
            out.append(_spec_value(b, normalize(raw), sec))
            continue
        if b.seq in heading_seqs:
            # 제목 줄은 빼고, 같은 단락에 붙은 본문만 본다.
            raw, offset = raw.strip().partition("\n")[2], 1
            if not raw.strip():
                continue
        text = normalize(raw)
        if WRITING_RULE.search(text) or SENTENCE_MARKERS.search(text):
            cand = _sentence(b, text, sec)
            cand.line_offset = offset
            if FORM_NOTES in rules and cand.req_kind == "REQUIREMENT" and FORM_NOTE.search(text) \
                    and not any(p.search(text) for p in risky):
                # 입찰 서식의 서식 작성 안내 ("Each Bidder must fill out this form")
                cand.req_kind, cand.rule_id = "WRITING_RULE", "E-FORM-NOTE"
            out.append(cand)
    out.sort(key=lambda c: c.block.seq)
    return out


def _spec_value(block: Block, text: str, sec: Section | None) -> Candidate:
    return Candidate(block=block, source_kind="SENTENCE", text=text, req_kind="REQUIREMENT",
                     rule_id="E-SPEC-VALUE", section=sec,
                     dedup_key="S|" + text.lower())


def _sentence(block: Block, text: str, sec: Section | None,
              table: LogicalTable | None = None) -> Candidate:
    is_rule = bool(WRITING_RULE.search(text))
    return Candidate(
        block=block, source_kind="SENTENCE", text=text,
        req_kind="WRITING_RULE" if is_rule else "REQUIREMENT",
        rule_id="E-WRITING-RULE" if is_rule else "E-SENTENCE-MARKER",
        section=sec, table=table, dedup_key="S|" + normalize(text).lower(),
    )
