"""일탈 후보 RFP(파일 25)의 TS-170-GIS 데이터시트 표를 스캔 쪽 그림으로 바꾼 시험용 RFP(파일 28)를 만든다.

스캔 모양은 예시 RFP E-039(115 kV 차단기 사양서, 쪽 전체가 스캔 그림)를 따른다:
1275×1650(150 dpi 레터), 명조체, 좌우 세로 테두리 선, 표 선, 약간 기울어짐·흐림·점 잡티.
값은 파일 25의 표에서 그대로 읽는다(새 값을 만들지 않음).

OCR(add-ocr, --psm 6)로 시험해 보고 정한 것:
- 칸마다 선을 다 그은 표는 한 줄도 읽지 못한다 → 위·아래·머리 행 가로선만 둔다
- 행 사이 가는 선도 위아래 행을 한 단락으로 묶어 버린다 → 행 사이 선 없이 행 간격을 넓게
- "≥"는 숫자 2로 읽혀 값이 틀어진다("≥170 kV" → "2170kV") → "not less than / not exceeding"으로 적는다.
  이 표현이 문장 표시(SENTENCE_MARKERS)라서 표 행 줄이 요구사항 후보가 된다.
  기호만 있으면 행 줄에 ":"도 문장 표시도 없어 후보가 되지 않는다(OCR은 표 칸을 나누지 않음).

실행: cd backend && uv run python ../generate_scan_rfp.py
"""
import os
import random
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(os.environ.get("RFP_ROOT", Path(__file__).resolve().parent))
DOCX_DIR = ROOT / "data" / "private" / "rfp_docx"
SRC = DOCX_DIR / "RFP_Product_Master_Evaluative_EN_With_Deviation_Candidates.docx"
OUT = DOCX_DIR / os.environ.get("RFP_SCAN_OUT", "RFP_Product_Master_Evaluative_EN_With_Scanned_Datasheet.docx")
IMG = DOCX_DIR / "drawings" / "TS-170-GIS_scan.png"

FONT_DIRS = ["/usr/share/fonts/truetype/liberation", "C:/Windows/Fonts", "/Library/Fonts"]
SERIF = {"regular": ["LiberationSerif-Regular.ttf", "times.ttf", "Times New Roman.ttf"],
         "bold": ["LiberationSerif-Bold.ttf", "timesbd.ttf", "Times New Roman Bold.ttf"]}


def font(size, weight="regular"):
    for d in FONT_DIRS:
        for name in SERIF[weight]:
            if (Path(d) / name).exists():
                return ImageFont.truetype(str(Path(d) / name), size)
    raise SystemExit("Times 계열 글꼴(Liberation Serif 또는 Times New Roman)이 필요합니다")


W, H = 1275, 1650
F, FB = font(25), font(27, "bold")


def scan_effect(im: Image.Image, seed=7) -> Image.Image:
    """E-039 같은 스캔 느낌: 회색 점 잡티, 약한 흐림, 0.4° 기울어짐."""
    rnd = random.Random(seed)
    d = ImageDraw.Draw(im)
    for _ in range(1800):                               # 가장자리 쪽 잡티 (본문 위는 적게)
        x, y = rnd.randrange(W), rnd.randrange(H)
        if 150 < x < W - 150 and rnd.random() < 0.85:
            continue
        g = rnd.randrange(150, 215)
        d.point((x, y), fill=(g, g, g))
    for _ in range(14):                                 # 복사기 줄무늬 점선
        x, y = rnd.randrange(W), rnd.randrange(H)
        for k in range(rnd.randrange(20, 60)):
            d.point((x + k * 3, y + k), fill=(185, 185, 185))
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    im = im.rotate(-0.4, resample=Image.BICUBIC, fillcolor="white")
    return im.convert("L").convert("RGB")


WORDS = {"≥": "not less than ", "≤": "not exceeding "}


def requirement_words(text: str) -> str:
    """"≥170 kV" → "not less than 170 kV". ≥는 OCR이 숫자 2로 읽어 값이 틀어진다("2170kV")."""
    for sym, word in WORDS.items():
        if text.startswith(sym):
            return word + text[len(sym):].strip()
    return text


def render_table(title: str, rows: list[list[str]]) -> Image.Image:
    """가로선만 있는 표. 칸마다 선을 다 그으면 --psm 6이 한 줄도 읽지 못한다."""
    im = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(im)
    d.line((38, 340, 38, 1530), fill=(40, 40, 40), width=2)          # E-039 좌우 세로 선
    d.line((1230, 340, 1230, 1530), fill=(40, 40, 40), width=2)
    # 쪽 머리 (E-039의 "115 KV AC POWER GAS CIRCUIT BREAKERS"처럼). 번호를 붙이면 문서의
    # "4.2" 제목과 같은 절이 하나 더 생기므로 번호 없이 쓴다.
    head = "170 KV GAS INSULATED SWITCHGEAR, DATA SHEET"
    d.text((W // 2, 360), head, font=FB, fill="black", anchor="ma")
    hw = d.textlength(head, font=FB)
    d.line((W // 2 - hw / 2, 392, W // 2 + hw / 2, 392), fill="black", width=2)
    cols = [100, 170, 800, 900, 1200]
    rh, y = 70, 440
    top = y
    d.text((cols[0] + 10, y + 12), title, font=FB, fill="black")
    y += rh
    for i, r in enumerate(rows):
        cells = r if i == 0 else [*r[:3], requirement_words(r[3])]
        for x0, text in zip(cols, cells):
            d.text((x0 + 10, y + 16), text, font=FB if i == 0 else F, fill="black")
        y += rh
    # 위·아래 굵은 선과 머리 행 아래 선만 둔다. 행 사이 가는 선은 OCR이 글자 줄에 붙여 읽어
    # 위아래 행이 한 단락으로 묶였다("9 Partial discharge … 10 Maintenance period …").
    for yy, w in ((top, 3), (top + rh, 1), (top + 2 * rh, 2), (y, 3)):
        d.line((cols[0], yy, cols[-1], yy), fill=(60, 60, 60), width=w)
    return scan_effect(im)


def build():
    doc = Document(str(SRC))
    table = next(t for t in doc.tables if t.rows[0].cells[0].text.strip() == "TS-170-GIS")
    rows = [[c.text.strip() for c in r.cells] for r in table.rows[1:]]
    IMG.parent.mkdir(parents=True, exist_ok=True)
    render_table("TS-170-GIS", rows).save(IMG)

    # 표 자리에 스캔 그림 단락을 넣고 표는 지운다 (값은 그림 속에만 남음)
    pic = doc.add_paragraph()
    pic.alignment = WD_ALIGN_PARAGRAPH.CENTER
    pic.add_run().add_picture(str(IMG), width=Cm(16.0))
    table._tbl.addprevious(pic._p)
    table._tbl.getparent().remove(table._tbl)
    doc.save(str(OUT))
    print(OUT)


if __name__ == "__main__":
    build()
