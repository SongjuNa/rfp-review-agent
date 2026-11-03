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
from rfp_agent.pipeline.structure import MARK_LEGEND, heading_of

PARA_GAP = 1.5          # 쪽의 줄 간격을 모를 때: 줄 위아래 간격이 줄 높이의 이 배를 넘으면 새 단락
# 쪽마다 가장 흔한 줄 사이 간격을 단락 안 간격으로 보고, 그보다 이만큼 넓으면 새 단락
# (update-pdf-tables)
GAP_RATIO, GAP_MIN = 0.5, 2.0
EDGE = 0.05             # 쪽 위·아래 이 비율 안의 줄은 머리말·꼬리말 후보
# 번호로 시작하는 줄은 새 단락 ("1.", "1.1", "A.", "PART 1", "가.", "1)")
NUMBERED = re.compile(r"^\s*(?:PART\s+\d+|\d+(?:\.\d+)*\.?\s|[A-Z]\.\s|[가-힣]\.\s|\d+\)\s)")
# 글머리표로 시작하는 줄도 새 단락 (•·▪◦●○■□※, 기호 글꼴이 바꾼 \x80~\x9f·\uf0xx)
BULLET = re.compile(r"^\s*[•·▪◦●○■□※\x80-\x9f\uf020-\uf0ff]")


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


def _join(lines: list[str]) -> str:
    """접혀 넘어간 줄을 한 줄로 잇는다 (docx 단락처럼). 줄 끝 "-"로 끊긴 낱말은 붙인다."""
    text = lines[0]
    for line in lines[1:]:
        if re.search(r"[A-Za-z]-$", text) and line[:1].islower():
            text = text[:-1] + line
        else:
            text = f"{text} {line}"
    return text


def line_gap(lines: list[dict]) -> float | None:
    """쪽에서 가장 흔한 줄 사이 간격(1pt 단위)을 단락 안 간격으로 본다.

    그보다 넓은 간격(단락 사이)이 쪽에 따로 있을 때만 쓴다. 간격이 고르면(단락 사이를 띄우지 않은
    쪽) 무엇이 단락 사이인지 알 수 없어 None을 돌려주고 줄 높이 기준을 쓴다.
    """
    gaps = [round(b["top"] - a["bottom"]) for a, b in zip(lines, lines[1:], strict=False)
            if 0 <= b["top"] - a["bottom"] < 2 * (a["bottom"] - a["top"] or 1)]
    if len(gaps) < 2:
        return None
    common = Counter(gaps).most_common(1)[0][0]
    wider = any(g > common + max(GAP_MIN, common * GAP_RATIO) for g in gaps)
    return common if wider else None


def _paragraphs(lines: list[dict], gap: float | None = None) -> list[str]:
    """표 밖 글자 줄을 단락으로 묶는다. 단락 하나가 한 줄이다(줄 번호도 단락마다 하나).

    gap은 그 쪽의 단락 안 줄 간격(line_gap). 없으면 줄 높이로 정한다.
    """
    out: list[list[str]] = []
    prev = None
    for line in lines:
        height = line["bottom"] - line["top"] or 1
        limit = height * (PARA_GAP - 1) if gap is None else gap + max(GAP_MIN, gap * GAP_RATIO)
        new = prev is None or line["top"] - prev["bottom"] > limit \
            or NUMBERED.match(line["text"]) or BULLET.match(line["text"])
        if new:
            out.append([line["text"]])
        else:
            out[-1].append(line["text"])
        prev = line
    return [_join(p) for p in out]


def _next_line(blocks: list[Block]) -> int:
    return blocks[-1].last_line + 1 if blocks else 1


def _add_paragraphs(blocks: list[Block], lines: list[dict], gap: float | None = None) -> None:
    # OCR 줄과 글자 층 줄은 섞지 않는다 (OCR 단락은 표시가 따로 붙는다)
    groups: list[list[dict]] = []
    for line in lines:
        if groups and groups[-1][0].get("ocr", False) == line.get("ocr", False):
            groups[-1].append(line)
        else:
            groups.append([line])
    for group in groups:
        for text in _paragraphs(group, gap):
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


MARK_ONLY = re.compile(r"^([CDE])$")                    # 조항 줄 위에 따로 놓인 준수 표시
MARK_LEAD = re.compile(r"^([CDE])\s+(\S.*)$")             # 표시가 조항 줄 앞에 붙음 ("C 1. …")
LEGEND_BLOCKS = 60                                        # 앞 몇 단락에서 준수 표시 머리를 찾나


def _section_heading(text: str) -> bool:
    """답안 표 밖에 두는 절 제목: 장·PART, "1.1"처럼 점이 든 번호. "A."·"1." 조항은 표 행이다."""
    h = heading_of(text)
    if h is None:
        return False
    style = h[0]                         # NUM 뒤 숫자는 번호 안 점 수 ("1.1" → NUM1, "1." → NUM0)
    return style in ("CHAPTER", "PART") or (style.startswith("NUM") and style != "NUM0")


def _mark_rows(blocks: list[Block]) -> list[Block]:
    """공급사 답안 PDF: 선 없는 표의 조항을 표 행으로 되돌린다 (update-pdf-tables).

    준수 표시 머리가 있는 문서에서만, 머리 뒤 단락 중 제목이 아닌 조항을 [표시, 조항] 행으로 만든다.
    조항 위에 따로 놓인 C/D/E 단락은 바로 다음 조항의 표시로 붙인다. docx는 같은 조항이 표 행이라
    공급사 답안 규칙(MARK_TABLE_ROWS)이 같게 걸린다.
    """
    start = next((i for i, b in enumerate(blocks[:LEGEND_BLOCKS])
                  if b.kind == "P" and MARK_LEGEND.search(b.text)), None)
    if start is None:
        return blocks
    table_no = max((b.table_no for b in blocks if b.table_no is not None), default=-1) + 1
    out = blocks[:start + 1]
    i, row_no = start + 1, 0
    while i < len(blocks):
        b = blocks[i]
        mark, text, lines = "", b.text, b.line_count
        if b.kind != "P" or _section_heading(b.text):
            out.append(b)
            i += 1
            continue
        if (m := MARK_ONLY.match(b.text.strip())) and i + 1 < len(blocks) \
                and blocks[i + 1].kind == "P" and not _section_heading(blocks[i + 1].text):
            mark, text = m.group(1), blocks[i + 1].text
            lines += blocks[i + 1].line_count
            i += 1
        elif m := MARK_LEAD.match(b.text.strip()):
            mark, text = m.group(1), m.group(2)
        cells = [mark, text]
        out.append(Block(seq=0, kind="R", text=" | ".join(cells), line_no=b.line_no,
                         line_count=lines, table_no=table_no, row_no=row_no, cells=cells,
                         raw_cells=list(cells)))
        row_no += 1
        i += 1
    for n, b in enumerate(out):
        b.seq = n
    return out


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
            gap = line_gap([obj for _, kind, obj in items if kind == "P"])
            # 위에서 아래로: 표 사이의 글자 줄은 모아 두었다가 단락으로 묶는다
            pending: list[dict] = []
            for _, kind, obj in items:
                if kind == "P":
                    pending.append(obj)
                    continue
                _add_paragraphs(blocks, pending, gap)
                pending = []
                table_no += 1
                _add_table(blocks, obj.extract(), table_no)
            _add_paragraphs(blocks, pending, gap)
    return _mark_rows(blocks)
