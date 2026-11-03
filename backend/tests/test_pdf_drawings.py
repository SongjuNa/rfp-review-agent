"""도면이 든 PDF 읽기 (change update-pdf-drawings).

명세 document-intake "PDF 쪽 속 그림 읽기"·"PDF 도면 쪽"·"PDF 돌아간 글자"의 Scenario.
reportlab으로 합성 PDF 쪽을 만든다(고객 원문 아님). 그림 OCR 시험은 Tesseract가 있어야 한다.
"""

from pathlib import Path

import pytest
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from rfp_agent.pipeline import dictionaries, ocr
from rfp_agent.pipeline.document import process_document
from rfp_agent.pipeline.pdf_reader import read_blocks
from tests.test_ocr import PAINT, picture

VERSION = "test-dict-v1"
W, H = A4
# 판독 가능 문서는 10줄 이상
BODY = [f"{n}.1 The contractor shall keep the records listed in clause {n}." for n in range(1, 11)]
NOTE = "NOTE 2: CONTRACTOR SHALL VERIFY ALL DIMENSIONS ON SITE."
CABLE = "4.1 Cable shall be rated 33 kV."


def body(c) -> None:
    c.setFont("Helvetica", 10)
    for n, text in enumerate(BODY):
        c.drawString(60, H - 70 - 18 * n, text)


def picture_pdf(path: Path) -> Path:
    """본문 아래 그림(요구 문장)과 설명"""
    c = canvas.Canvas(str(path), pagesize=A4)
    body(c)
    image = picture([PAINT])
    c.drawImage(ImageReader(image), 60, H - 420, 470, 120)       # 쪽 넓이 5 % 이상, 높이 72pt 이상
    c.drawString(60, H - 440, "Figure 1 Painting")
    c.showPage()
    c.save()
    return path


def drawing_pdf(path: Path) -> Path:
    """본문 쪽 + CAD식 단선도 쪽(라벨·치수·주기·표제란)"""
    c = canvas.Canvas(str(path), pagesize=A4)
    body(c)
    c.showPage()
    c.setFont("Helvetica", 9)
    c.line(80, H - 150, W - 80, H - 150)
    for k, x in enumerate((150, 300, 450)):
        c.line(x, H - 150, x, H - 420)
        c.rect(x - 15, H - 230, 30, 30)
        c.drawString(x + 20, H - 215, f"CB 52-{k + 1}")
        c.drawString(x + 20, H - 227, "3150A")
    c.drawString(285, H - 465, "2400")
    c.drawString(80, 230, "NOTE 1: ALL DIMENSIONS IN MM.")
    c.drawString(80, 220, NOTE)
    rows = (("TITLE", "SINGLE LINE DIAGRAM 154kV GIS"), ("DRAWING NO", "DWG-SLD-001"),
            ("SCALE", "NTS"))
    for r, (k, v) in enumerate(rows):
        c.rect(W - 300, 60 + r * 18, 70, 18)
        c.rect(W - 230, 60 + r * 18, 170, 18)
        c.drawString(W - 296, 66 + r * 18, k)
        c.drawString(W - 226, 66 + r * 18, v)
    c.showPage()
    c.save()
    return path


def rotated_pdf(path: Path) -> Path:
    """가로 문장 + 90° 돌아간 라벨"""
    c = canvas.Canvas(str(path), pagesize=A4)
    body(c)
    c.drawString(60, 200, CABLE)
    c.saveState()
    c.translate(90, 300)
    c.rotate(90)
    c.drawString(0, 0, "CABLE TRAY 600W")
    c.restoreState()
    c.showPage()
    c.save()
    return path


def processed(conn, path):
    result = process_document(conn, path, dictionaries.load(conn), VERSION, None, None)
    reqs = conn.execute("SELECT text_raw, extracted_by FROM requirement WHERE document_id = %s "
                        "AND req_kind = 'REQUIREMENT'", (result.document_id,)).fetchall()
    figures = conn.execute("SELECT caption FROM doc_figure WHERE document_id = %s ORDER BY line_no",
                           (result.document_id,)).fetchall()
    return reqs, [f[0] for f in figures]


@pytest.mark.skipif(ocr.engine_version() is None, reason="Tesseract 없음")
def test_picture_on_text_page(db, tmp_path):
    """Scenario: 글자 쪽에 박은 그림"""
    reqs, figures = processed(db, picture_pdf(tmp_path / "picture.pdf"))
    assert figures == ["Figure 1 Painting"]
    assert any(r[0] == PAINT and r[1] == "OCR" for r in reqs)
    assert any(r[0] == BODY[0] and r[1] == "RULE" for r in reqs)


def test_drawing_page(db, tmp_path):
    """Scenario: 단선도 쪽"""
    path = drawing_pdf(tmp_path / "drawing.pdf")
    texts = [b.text for b in read_blocks(path)]
    assert not any(label in t for t in texts for label in ("CB 52-1", "3150A", "2400", "NTS"))
    assert NOTE in texts and "NOTE 1: ALL DIMENSIONS IN MM." in texts     # 주기는 한 줄씩
    reqs, figures = processed(db, path)
    assert figures == ["도면 DWG-SLD-001 · SINGLE LINE DIAGRAM 154kV GIS"]
    assert any(r[0] == NOTE for r in reqs)
    tables = db.execute("SELECT count(*) AS n FROM doc_table t JOIN document d USING (document_id) "
                        "WHERE d.file_name = 'drawing.pdf'").fetchone()
    assert tables[0] == 0                                              # 표제란·기호 상자는 표 아님


def test_rotated_text(db, tmp_path):
    """Scenario: 돌아간 글자"""
    path = rotated_pdf(tmp_path / "rotated.pdf")
    texts = [b.text for b in read_blocks(path)]
    assert not any(w in t for t in texts for w in ("CABLE TRAY", "ELBAC", "600W"))
    reqs, figures = processed(db, path)
    assert figures == ["돌아간 글자 13자"]
    assert any(r[0] == CABLE for r in reqs)
