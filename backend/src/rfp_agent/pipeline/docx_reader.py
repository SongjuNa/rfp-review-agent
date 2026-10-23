"""docx를 단락·표 행 블록으로 읽고, 블록마다 줄 번호를 붙인다.

줄을 만드는 방식은 팀이 쓰는 추출 txt(6_원천텍스트)와 같다:
단락 1개 = 줄 1개, 표 행 1개 = 칸 원문을 " | "로 이은 것, 칸 안의 줄바꿈은 그대로 줄바꿈.
그래서 txt가 있으면 line_map으로 txt 줄 번호(추적표 v3의 "N행")에 맞출 수 있다.
"""

from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

REDACTION_MARKS = ("[REDACTED", "REDACTED]", "［")


@dataclass
class Block:
    """단락 하나 또는 표 행 하나."""

    seq: int                        # 문서 안 순서 (0부터)
    kind: str                       # "P" 단락, "R" 표 행
    text: str                       # 줄로 펼친 원문 (여러 줄일 수 있음)
    line_no: int                    # 첫 줄의 줄 번호 (1부터). line_map이 txt 기준으로 바꾼다
    line_count: int
    table_no: int | None = None     # Word 표 번호 (0부터)
    row_no: int | None = None       # 표 안 행 번호 (0부터)
    cells: list[str] = field(default_factory=list)          # 칸 원문 (병합 칸은 한 번만)
    raw_cells: list[str] = field(default_factory=list)      # 병합 칸 반복 포함 (txt와 같은 모양)

    @property
    def last_line(self) -> int:
        return self.line_no + self.line_count - 1


def _walk(parent) -> Iterator:
    for el in parent.iterchildren():
        if el.tag == qn("w:sdt"):
            content = el.find(qn("w:sdtContent"))
            if content is not None:
                yield from _walk(content)
        elif el.tag in (qn("w:p"), qn("w:tbl")):
            yield el


def _cell_text(cell) -> str:
    return "\n".join(p.text for p in cell.paragraphs)


def read_blocks(path: Path) -> list[Block]:
    doc = Document(str(path))
    blocks: list[Block] = []
    line_no = 1
    table_no = -1
    for el in _walk(doc.element.body):
        if el.tag == qn("w:p"):
            text = Paragraph(el, doc).text
            items = [("P", text, None, [], [])]
        else:
            table_no += 1
            items = []
            for row_no, row in enumerate(Table(el, doc).rows):
                raw, cells, seen = [], [], []
                for cell in row.cells:
                    text = _cell_text(cell)
                    raw.append(text)
                    # 가로 병합 칸은 같은 tc가 반복된다. 역할 판단용 칸 목록에는 한 번만 넣는다.
                    if not any(cell._tc is s for s in seen):
                        seen.append(cell._tc)
                        cells.append(text)
                items.append(("R", " | ".join(raw), row_no, cells, raw))
        for kind, text, row_no, cells, raw in items:
            count = text.count("\n") + 1
            blocks.append(Block(
                seq=len(blocks), kind=kind, text=text, line_no=line_no, line_count=count,
                table_no=table_no if kind == "R" else None, row_no=row_no,
                cells=cells, raw_cells=raw,
            ))
            line_no += count
    return blocks


def is_redacted(text: str) -> bool:
    return any(mark in text for mark in REDACTION_MARKS)
