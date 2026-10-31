"""문서 하나를 ①~⑤(분류 → 구조 → 추출 → 유형 → 값)까지 처리해 DB에 저장한다.

같은 파일·같은 사전 판으로 이미 처리했으면 다시 하지 않고 저장된 결과를 쓴다 (NFR-05).
"""

import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

from rfp_agent.llm import tasks
from rfp_agent.llm.client import LLM
from rfp_agent.pipeline import classify as cls
from rfp_agent.pipeline.dictionaries import PipelineDicts
from rfp_agent.pipeline.docx_reader import find_figures, read_blocks
from rfp_agent.pipeline.extract import Candidate, extract
from rfp_agent.pipeline.line_map import map_lines
from rfp_agent.pipeline.structure import (
    LogicalTable,
    Section,
    SectionIndex,
    build_tables,
    find_sections,
)
from rfp_agent.pipeline.type_tags import tag
from rfp_agent.pipeline.values import normalize_candidate, target_of

# 세부 진행 알림: (세부 일, 끝난 줄 수, 전체 줄 수)
# 세부 일은 classify·structure·extract·label·save·type
Report = Callable[[str, int | None, int | None], None]


def _no_report(part: str, done: int | None = None, total: int | None = None) -> None:
    pass


@dataclass
class DocumentResult:
    document_id: int
    file_no: int
    reused: bool
    readable: bool
    requirement_count: int = 0


def _next_file_no(conn: psycopg.Connection) -> int:
    # 파일 목록(1~22)에 없는 문서는 101번부터 붙인다.
    last = conn.execute("SELECT COALESCE(max(file_no), 0) FROM document").fetchone()[0]
    return max(100, last) + 1


def _insert_document(conn, path: Path, c: cls.Classification, dicts: PipelineDicts,
                     line_basis: str, key: str) -> tuple[int, int]:
    """이 처리 판(key)으로 처리한 문서 행을 새로 만든다.

    번호는 파일 목록 → 같은 파일의 이전 번호 → 101번부터.
    """
    previous = conn.execute("SELECT max(file_no) FROM document WHERE source_path = %s",
                            (str(path),)).fetchone()[0]
    file_no = c.file_no or previous or _next_file_no(conn)
    values = dict(
        file_no=file_no, file_name=path.name, bundle=c.bundle, doc_kind=c.doc_kind,
        project_id=dicts.projects.get(c.project_key) if c.project_key else None,
        language=c.language, standard_system=c.standard_system, judge_target=c.judge_target,
        readable=c.readable, classify_by=c.classify_by, needs_review=c.needs_review,
        source_path=str(path), line_basis=line_basis, processing_key=key,
    )
    cols = ", ".join(values)
    marks = ", ".join(f"%({k})s" for k in values)
    doc_id = conn.execute(f"INSERT INTO document ({cols}) VALUES ({marks}) RETURNING document_id",
                          values).fetchone()[0]
    return doc_id, file_no


def _save_sections(conn, document_id: int, sections: list[Section]) -> dict[int, int]:
    ids: dict[int, int] = {}
    for s in sections:
        ids[s.index] = conn.execute(
            """INSERT INTO section (document_id, parent_id, section_no, title, is_toc,
                                    line_start, line_end, structure_flag)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING section_id""",
            (document_id, ids.get(s.parent) if s.parent is not None else None, s.number, s.title,
             s.is_toc, s.line_start, s.line_end, s.structure_flag),
        ).fetchone()[0]
    return ids


def _save_tables(conn, document_id: int, tables: list[LogicalTable], section_ids,
                 sections_index) -> dict[int, int]:
    """표와 행을 저장하고 블록 seq → row_id를 돌려준다."""
    row_ids: dict[int, int] = {}
    for t in tables:
        sec = sections_index.at(t.first_block_seq)
        table_id = conn.execute(
            """INSERT INTO doc_table (document_id, section_id, table_name, source_table_nos,
                                      column_roles, role_flag)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING table_id""",
            (document_id, section_ids.get(sec.index) if sec else None, t.name,
             t.source_table_nos, Jsonb({str(k): v for k, v in t.column_roles.items()}),
             t.role_flag),
        ).fetchone()[0]
        for order, r in enumerate(t.rows):
            parent = row_ids.get(t.rows[r.parent_index].block.seq) if r.parent_index is not None \
                else None
            row_ids[r.block.seq] = conn.execute(
                """INSERT INTO table_row (table_id, parent_row_id, item_no, item_name_raw,
                     unit_raw, required_raw, warranted_raw, supplier_mark, line_no, row_order,
                     source_table_no, cells)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING row_id""",
                (table_id, parent, r.item_no, r.item_name, (r.unit or "")[:40] or None,
                 r.required, r.warranted, r.supplier_mark, r.block.line_no, order,
                 r.block.table_no, Jsonb(r.block.cells)),
            ).fetchone()[0]
    return row_ids


def _refine_with_ai(llm: LLM, candidates: list[Candidate], report: Report,
                    risk_patterns: list[re.Pattern]) -> None:
    by_section: dict[int | None, list[Candidate]] = {}
    for c in candidates:
        # 위험 표현이 든 문장은 언어 모델에 묻지 않고 요구사항으로 둔다.
        # 작성 규칙·설명으로 바뀌면 위험 조건 찾기에서 빠지기 때문이다 (CR-01, FR-06).
        if any(p.search(c.text) for p in risk_patterns):
            continue
        if c.source_kind == "SENTENCE" and c.req_kind == "REQUIREMENT":
            by_section.setdefault(c.section.index if c.section else None, []).append(c)
    total = sum(len(g) for g in by_section.values())
    before = 0                  # 절마다 나눠 묻지만 진행은 문서 전체 문장 수로 이어 센다
    report("label", 0, total)
    for group in by_section.values():
        title = group[0].section.title if group[0].section else None
        labels = tasks.label_sentences(llm, title, [c.text for c in group],
                                       lambda done, _, b=before: report("label", b + done, total))
        before += len(group)
        for c, label in zip(group, labels, strict=True):
            if label == "WRITING_RULE":
                c.req_kind, c.rule_id, c.extracted_by = "WRITING_RULE", "E-AI-WRITING-RULE", "AI"
            elif label == "DESCRIPTION":
                c.req_kind, c.rule_id, c.extracted_by = "DESCRIPTION", "E-AI-DESCRIPTION", "AI"


@dataclass
class Choice:
    """등록 화면에서 사람이 정한 문서 분류 (없는 칸은 규칙 결과를 쓴다)."""
    bundle: str | None = None
    doc_kind: str | None = None


def process_document(conn: psycopg.Connection, path: Path, dicts: PipelineDicts, key: str,
                     llm: LLM | None, txt_dir: Path | None,
                     report: Report = _no_report, choice: Choice | None = None) -> DocumentResult:
    report("classify")
    blocks = read_blocks(path)
    line_basis = "DOCX"
    txt = txt_dir / f"{path.stem}.txt" if txt_dir else None
    if txt and txt.exists():
        blocks, ratio = map_lines(blocks, txt)
        line_basis = "TXT" if ratio == 1.0 else "DOCX"

    c = cls.classify(path.name, blocks, dicts.catalog, dicts.kind_rules)
    if choice:
        c = cls.apply_choice(c, choice.bundle, choice.doc_kind)
        if c.classify_by == "HUMAN":
            # 규칙과 다른 분류는 다른 처리 판으로 둔다. 같은 파일의 다른 검토 결과를 바꾸지 않는다.
            key = f"{key}|H:{c.bundle}:{c.doc_kind}"
    if c.file_no is not None:
        existing = conn.execute(
            "SELECT document_id, file_no FROM document WHERE file_no = %s "
            "AND processing_key = %s", (c.file_no, key)).fetchone()
    else:
        # 파일 목록에 없는 문서는 파일 경로로 찾는다.
        existing = conn.execute(
            "SELECT document_id, file_no FROM document WHERE source_path = %s "
            "AND processing_key = %s", (str(path), key)).fetchone()
    if existing:
        count = conn.execute("SELECT count(*) FROM requirement WHERE document_id = %s",
                             (existing[0],)).fetchone()[0]
        return DocumentResult(existing[0], existing[1], True, c.readable, count)

    if llm is not None and c.readable and c.classify_by != "HUMAN":
        c = cls.apply_ai_kind(c, tasks.classify_document(llm, path.name,
                                                         cls.first_page_text(blocks)))

    with conn.transaction():
        doc_id, file_no = _insert_document(conn, path, c, dicts, line_basis, key)
        if not c.readable:
            # 판독 불가 문서는 이후 단계를 건너뛴다 (FR-01 예외).
            return DocumentResult(doc_id, file_no, False, False)

        report("structure")
        sections = find_sections(blocks)
        tables = build_tables(blocks, dicts.column_roles,
                              supplier_marks=bool(re.search(r"C: Complied", "\n".join(
                                  b.text for b in blocks[:400]))))
        index = SectionIndex(sections)
        section_ids = _save_sections(conn, doc_id, sections)
        row_ids = _save_tables(conn, doc_id, tables, section_ids, index)
        for block, caption in find_figures(blocks):
            # 그림 위치만 남긴다. 그림 속 글자는 읽지 않는다 (OCR 범위 밖)
            sec = index.at(block.seq)
            conn.execute("INSERT INTO doc_figure (document_id, section_id, line_no, caption) "
                         "VALUES (%s, %s, %s, %s)",
                         (doc_id, section_ids.get(sec.index) if sec else None, block.line_no,
                          caption))

        report("extract")
        candidates = extract(blocks, sections, tables)
        if llm is not None:
            _refine_with_ai(llm, candidates, report,
                            [e.pattern for e in dicts.risk_expressions])

        report("save")

        doc_title = " ".join(b.text for b in blocks[:FIRST_TITLE_BLOCKS]) + " " + path.stem
        doc_target = target_of(doc_title, dicts.values)
        risk_terms = [e.pattern for e in dicts.risk_expressions]
        unclassified: list[tuple[int, Candidate]] = []
        saved = 0
        recent_text: list[str] = []
        current_top: int | None = None
        for cand in candidates:
            if cand.req_kind == "DESCRIPTION":
                continue
            sec_id = section_ids.get(cand.section.index) if cand.section else None
            loc_id = conn.execute(
                """INSERT INTO source_location (document_id, section_id, row_id, line_start,
                                                line_end)
                   VALUES (%s, %s, %s, %s, %s) RETURNING location_id""",
                (doc_id, sec_id, row_ids.get(cand.block.seq), cand.line_start,
                 cand.block.last_line),
            ).fetchone()[0]
            rep = conn.execute(
                "SELECT r.requirement_id FROM requirement r JOIN document d USING (document_id) "
                "WHERE r.dedup_key = %s AND r.dedup_of IS NULL AND r.document_id <> %s "
                "AND d.processing_key = %s ORDER BY r.requirement_id LIMIT 1",
                (cand.dedup_key, doc_id, key)).fetchone() if cand.dedup_key else None
            req_id = conn.execute(
                """INSERT INTO requirement (document_id, section_id, row_id, source_kind,
                     text_raw, req_kind, dedup_of, extracted_by, confidence, rule_id,
                     supplier_mark, dedup_key)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING requirement_id""",
                (doc_id, sec_id, row_ids.get(cand.block.seq), cand.source_kind, cand.text,
                 cand.req_kind, rep[0] if rep else None, cand.extracted_by,
                 1.0 if cand.extracted_by == "RULE" else 0.7, cand.rule_id, cand.supplier_mark,
                 cand.dedup_key),
            ).fetchone()[0]
            conn.execute("INSERT INTO requirement_location VALUES (%s, %s)", (req_id, loc_id))
            if rep:
                # 같은 요구가 다른 문서에 이미 있으면 대표 요구사항에 위치를 더한다 (CR-03).
                conn.execute("INSERT INTO requirement_location VALUES (%s, %s) "
                             "ON CONFLICT DO NOTHING", (rep[0], loc_id))
            saved += 1

            if cand.req_kind != "REQUIREMENT":
                continue
            tags = tag(cand, dicts.type_rules, risk_terms)
            if not tags:
                unclassified.append((req_id, cand))
            for t in tags:
                conn.execute(
                    """INSERT INTO requirement_type_tag (requirement_id, type_code, is_primary,
                                                         decided_by, type_rule_id)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (req_id, t.type_code, t.is_primary, t.decided_by,
                     t.rule.rule_id if t.rule else None),
                )

            top = _top_section(cand.section, sections)
            if top != current_top:
                # 앞 문장 문맥은 같은 최상위 절 안에서만 이어 쓴다.
                recent_text.clear()
                current_top = top
            values = normalize_candidate(cand, sections, dicts.values, doc_target,
                                         preceding_text="\n".join(recent_text))
            recent_text.append(cand.text)
            for v in values:
                conn.execute(
                    """INSERT INTO req_value (requirement_id, raw_text, cell_form, num_value,
                         operator, unit_raw, cond_time_s, cond_raw, item_key, target_object,
                         basis_standard, delegated_std, equipment_key, project_id, flag, value_seq)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (req_id, v.raw_text, v.cell_form, v.num_value, v.operator,
                     (v.unit_raw or "")[:40] or None, v.cond_time_s, v.cond_raw, v.item_key,
                     v.target_object, v.basis_standard, v.delegated_std, v.equipment_key,
                     dicts.projects.get(c.project_key) if c.project_key else None, v.flag, v.seq),
                )

        if llm is not None and unclassified:
            report("type", 0, len(unclassified))
            ai_types = tasks.type_unclassified(llm, [cand.text for _, cand in unclassified],
                                               lambda done, total: report("type", done, total))
            for (req_id, _), code in zip(unclassified, ai_types, strict=True):
                if code != "NONE":
                    conn.execute(
                        "INSERT INTO requirement_type_tag (requirement_id, type_code, is_primary, "
                        "decided_by) VALUES (%s, %s, TRUE, 'AI')", (req_id, code))

    return DocumentResult(doc_id, file_no, False, True, saved)


FIRST_TITLE_BLOCKS = 15


def _top_section(section: Section | None, sections: list[Section]) -> int | None:
    while section is not None and section.parent is not None:
        section = sections[section.parent]
    return section.index if section else None


__all__ = ["process_document", "DocumentResult"]
