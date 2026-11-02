"""글자가 든 PDF를 docx와 같은 단락·표 행 블록으로 읽는다 (add-pdf-input).

쪽마다 표는 표 행으로, 표 밖 글자 줄은 줄 간격으로 묶어 단락으로 만든다. 줄 번호는 문서 처음부터
이어 센다. 쪽마다 같은 높이에 반복되는 머리말·꼬리말(쪽 번호 등)은 뺀다.
글자 층이 없는 쪽은 OCR 엔진이 있으면 OCR로 읽는다(add-ocr).
엔진이 없는 스캔 PDF나 열 수 없는 PDF는 블록 0개(판독 불가).
"""

import re
from collections import Counter
from pathlib import Path

import pdfplumber

from rfp_agent.pipeline import ocr
from rfp_agent.pipeline.docx_reader import Block

PARA_GAP = 1.5          # 줄 위아래 간격이 줄 높이의 이 배를 넘으면 새 단락
EDGE = 0.05             # 쪽 위·아래 이 비율 안의 줄은 머리말·꼬리말 후보
# 번호로 시작하는 줄은 새 단락 ("1.", "1.1", "A.", "PART 1", "가.", "1)")
NUMBERED = re.compile(r"^\s*(?:PART\s+\d+|\d+(?:\.\d+)*\.?\s|[A-Z]\.\s|[가-힣]\.\s|\d+\)\s)")


def _inside(line: dict, boxes: list[tuple]) -> bool:
    mid = (line["top"] + line["bottom"]) / 2
    return any(x0 - 1 <= line["x0"] and line["x1"] <= x1 + 1 and top - 1 <= mid <= bottom + 1
               for x0, top, x1, bottom in boxes)


def _edge_key(line: dict, height: float) -> str | None:
    """머리말·꼬리말 후보면 (위치, 숫자를 지운 글자). 쪽 번호가 달라도 같은 줄로 본다."""
    if line["top"] > height * EDGE and line["bottom"] < height * (1 - EDGE):
        return None
    where = "top" if line["top"] <= height * EDGE else "bottom"
    return f"{where}|{re.sub(r'\d+', '#', line['text'].strip())}"


def _paragraphs(lines: list[dict]) -> list[str]:
    """표 밖 글자 줄을 단락으로 묶는다."""
    out: list[list[str]] = []
    prev = None
    for line in lines:
        height = line["bottom"] - line["top"] or 1
        new = prev is None or line["top"] - prev["bottom"] > height * (PARA_GAP - 1) \
            or NUMBERED.match(line["text"])
        if new:
            out.append([line["text"]])
        else:
            out[-1].append(line["text"])
        prev = line
    return ["\n".join(p) for p in out]


def _next_line(blocks: list[Block]) -> int:
    return blocks[-1].last_line + 1 if blocks else 1


def _add_paragraphs(blocks: list[Block], lines: list[dict]) -> None:
    # OCR 줄과 글자 층 줄은 섞지 않는다 (OCR 단락은 표시가 따로 붙는다)
    groups: list[list[dict]] = []
    for line in lines:
        if groups and groups[-1][0].get("ocr", False) == line.get("ocr", False):
            groups[-1].append(line)
        else:
            groups.append([line])
    for group in groups:
        for text in _paragraphs(group):
            blocks.append(Block(seq=len(blocks), kind="P", text=text, line_no=_next_line(blocks),
                                line_count=text.count("\n") + 1,
                                ocr=group[0].get("ocr", False)))


OCR_DPI = 300


def _ocr_page(page) -> list[dict]:
    """글자 층이 없는 쪽을 그림으로 만들어 OCR한 줄 (add-ocr). 위치는 쪽 좌표로 바꾼다."""
    if not ocr.available():
        return []
    image = page.to_image(resolution=OCR_DPI).original
    scale = page.height / image.height
    return [{"text": ln.text, "top": ln.top * scale, "bottom": ln.bottom * scale,
             "x0": 0, "x1": page.width, "ocr": True} for ln in ocr.read_lines(image)]


def _add_table(blocks: list[Block], rows: list[list[str | None]], table_no: int) -> None:
    for row_no, row in enumerate(rows):
        cells = [(c or "").strip() for c in row]
        if not any(cells):
            continue
        text = " | ".join(cells)
        blocks.append(Block(seq=len(blocks), kind="R", text=text, line_no=_next_line(blocks),
                            line_count=text.count("\n") + 1, table_no=table_no, row_no=row_no,
                            cells=cells, raw_cells=list(cells)))


def read_blocks(path: Path) -> list[Block]:
    try:
        pdf = pdfplumber.open(str(path))
    except Exception:                                   # 암호·깨진 PDF: 판독 불가
        return []
    with pdf:
        pages = []
        for page in pdf.pages:
            tables = page.find_tables()
            boxes = [t.bbox for t in tables]
            lines = [ln for ln in page.extract_text_lines() if ln["text"].strip()]
            if not lines and not tables:
                lines = _ocr_page(page)                 # 스캔한 쪽 (add-ocr)
            pages.append((page, tables, [ln for ln in lines if not _inside(ln, boxes)]))
        # 쪽 절반 이상(2쪽 이상)에서 같은 높이에 반복되는 줄은 머리말·꼬리말
        counts = Counter(k for page, _, lines in pages
                         for k in {_edge_key(ln, page.height) for ln in lines} if k)
        repeated = {k for k, n in counts.items() if len(pages) >= 2 and n >= max(2, len(pages) / 2)}

        blocks: list[Block] = []
        table_no = -1
        for page, tables, lines in pages:
            items = [(ln["top"], "P", ln) for ln in lines
                     if _edge_key(ln, page.height) not in repeated]
            items += [(t.bbox[1], "T", t) for t in tables]
            items.sort(key=lambda it: (it[0], it[1]))
            # 위에서 아래로: 표 사이의 글자 줄은 모아 두었다가 단락으로 묶는다
            pending: list[dict] = []
            for _, kind, obj in items:
                if kind == "P":
                    pending.append(obj)
                    continue
                _add_paragraphs(blocks, pending)
                pending = []
                table_no += 1
                _add_table(blocks, obj.extract(), table_no)
            _add_paragraphs(blocks, pending)
    return blocks
