"""일탈 후보 RFP(파일 25)에 OCR 시험용 도면 3장(8장)을 더한 시험용 RFP(파일 27)를 만든다.

도면은 예시 RFP(교육용 클렌징 v6)의 도면 모양을 따른다: 흰 바탕 검은 선, 단선도·정면도,
아래쪽 표제란, 설비 이름·풍선 기호와 풍선별 주기. 값은 모두 제품 마스터(GIS-170-50, SWGR-GSH20V-24, Susol VCB VL-20)에서 가져온다.
제품 마스터에 없는 값(치수, 동작 책무, 제어 전압 등)은 도면에 적지 않는다(CR-04).

OCR(add-ocr)이 값을 잘 뽑도록 지킨 것:
- 정격 줄은 한 줄에 항목 하나, 줄 사이를 글자 높이보다 넓게 띄움 → 줄마다 단락 하나(ocr.PARA_GAP)
- 정격 줄은 "항목 : 값 단위" 모양 → E-SPEC-VALUE. kV·kA·A·Hz·%가 아닌 단위(ms·pC·months·years)는
  "not exceeding / not less than"을 넣어 문장 후보(E-SENTENCE-MARKER)로 잡히게 함
- 항목 이름은 item_keys.csv의 원문 표현 그대로, 단위는 대소문자 그대로(kV, kA, ms, pC)
- 그림 안에는 설비 이름과 풍선 기호(A~D)만 두고, 값은 풍선별 주기 상자에 둠. 값 줄과 같은 높이에
  기호(CT 원, 점선 등)가 있으면 --psm 6이 기호를 글자로 섞어 읽어 값이 깨진다("60 ms" → "6 이 009")
- 값은 "항목 : 값"으로 이어 쓰고 값만 굵게. 항목과 값 사이를 멀리 띄운 표 모양에서는 짧은 줄의
  "kV"를 "kv"로 읽거나 "24 kV"를 신뢰도 0으로 버리는 일이 있었다(시험 33개 중 1~2개)
- 번호("1.")를 붙이지 않음 → 문서 절 번호로 읽히지 않게
- 도면 글자(기호 이름, 표제란)에는 ":"·shall·required를 쓰지 않음 → 요구사항 후보가 생기지 않게

실행: cd backend && uv run python ../generate_drawing_rfp.py
"""
import csv
import os
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(os.environ.get("RFP_ROOT", Path(__file__).resolve().parent))
MASTER = ROOT / "data" / "seed" / "products" / "product_master.csv"
DOCX_DIR = ROOT / "data" / "private" / "rfp_docx"
SRC = DOCX_DIR / "RFP_Product_Master_Evaluative_EN_With_Deviation_Candidates.docx"
OUT = DOCX_DIR / "RFP_Product_Master_Evaluative_EN_With_Drawings.docx"
IMG_DIR = DOCX_DIR / "drawings"
PRODUCT = "GIS-170-50"

FONT_DIRS = ["/usr/share/fonts/truetype/liberation", "C:/Windows/Fonts", "/Library/Fonts"]
FONT_FILES = {"regular": ["LiberationSans-Regular.ttf", "arial.ttf", "Arial.ttf"],
              "bold": ["LiberationSans-Bold.ttf", "arialbd.ttf", "Arial Bold.ttf"]}


def font(size, weight="regular"):
    for d in FONT_DIRS:
        for name in FONT_FILES[weight]:
            p = Path(d) / name
            if p.exists():
                return ImageFont.truetype(str(p), size)
    raise SystemExit("Arial 계열 글꼴(Liberation Sans 또는 Arial)이 필요합니다")


def num(text):
    """'125.0' → '125', '0.5000' → '0.5'"""
    v = float(text)
    return f"{v:g}"


MV_PRODUCTS = ("SWGR-GSH20V-24", "VCB-SUSOL-VL-20-25D20", "VCB-SUSOL-VL-20-25D06")

with MASTER.open(encoding="utf-8-sig", newline="") as f:
    master = {r["product_code"]: r for r in csv.DictReader(f)}
p = master[PRODUCT]
sw, vin, vfd = (master[c] for c in MV_PRODUCTS)     # 배전반, 수전 VCB 2000 A, 급전 VCB 630 A

TYPE = p["product_name"].split("(")[-1].rstrip(")") if "(" in p["product_name"] else p["product_name"]
STD_CB = next((s for s in p["standards"].split(";") if s.startswith("IEC 62271-100")), "")
KV = num(p["rated_voltage_kv"])

# 도면 1: 단선도 인출선 주기 (설비별)
RATING_BUS = [
    ("RATED VOLTAGE", f"{KV} kV"),
    ("RATED FREQUENCY", "60 Hz"),                       # description "60Hz"
    ("RATED NORMAL CURRENT", f"{num(p['rated_current_a'])} A"),
    ("RATED SHORT-TIME WITHSTAND CURRENT", f"{num(p['short_circuit_ka'])} kA (1 s)"),  # 1초
]
RATING_GCB = [
    ("RATED SHORT-CIRCUIT BREAKING CURRENT", f"{num(p['short_circuit_ka'])} kA"),
    ("RATED SHORT-CIRCUIT MAKING CURRENT", f"{num(p['making_current_ka'])} kA"),
    ("RATED PEAK WITHSTAND CURRENT", f"{num(p['peak_current_ka'])} kA"),
    ("TOTAL BREAKING TIME", f"not exceeding {num(p['breaking_time_ms'])} ms"),
]
RATING_INS = [
    ("RATED LIGHTNING IMPULSE WITHSTAND VOLTAGE", f"{num(p['lightning_impulse_kv'])} kV"),
    ("RATED SHORT-DURATION POWER-FREQUENCY WITHSTAND VOLTAGE",
     f"{num(p['power_freq_withstand_kv'])} kV"),
    ("RATED SWITCHING IMPULSE WITHSTAND VOLTAGE", f"{num(p['switching_impulse_kv'])} kV"),
]
RATING_GAS = [
    ("ANNUAL LEAKAGE RATE FOR EACH GAS COMPARTMENT",
     f"not exceeding {num(p['gas_leakage_percent'])} %"),
    ("PARTIAL DISCHARGE", f"not exceeding {num(p['partial_discharge_pc'])} pC"),
]
# 도면 3: 24 kV 배전반 (배전반 SWGR-GSH20V-24 + Susol VCB VL-20 2000 A / 630 A)
MV_KV = num(sw["rated_voltage_kv"])
RATING_MV = [
    ("RATED VOLTAGE", f"{MV_KV} kV"),
    ("RATED LIGHTNING IMPULSE WITHSTAND VOLTAGE", f"{num(sw['lightning_impulse_kv'])} kV"),
    ("RATED SHORT-DURATION POWER-FREQUENCY WITHSTAND VOLTAGE",
     f"{num(sw['power_freq_withstand_kv'])} kV"),
    ("STANDARD", sw["standards"]),
]
RATING_VCB_IN = [
    ("RATED NORMAL CURRENT", f"{num(vin['rated_current_a'])} A"),
    ("RATED SHORT-CIRCUIT BREAKING CURRENT", f"{num(vin['short_circuit_ka'])} kA"),
    ("RATED SHORT-CIRCUIT MAKING CURRENT", f"{num(vin['making_current_ka'])} kA"),
    ("RATED PEAK WITHSTAND CURRENT", f"{num(vin['peak_current_ka'])} kA"),
    ("TOTAL BREAKING TIME", f"not exceeding {num(vin['breaking_time_ms'])} ms"),
    ("TOTAL CLOSING TIME", f"not exceeding {num(vin['closing_time_ms'])} ms"),
]
RATING_VCB_FD = [
    ("RATED NORMAL CURRENT", f"{num(vfd['rated_current_a'])} A"),
    ("RATED SHORT-CIRCUIT BREAKING CURRENT", f"{num(vfd['short_circuit_ka'])} kA"),
]
# operating_temp "-5 to +40 °C"에서 최고값만 쓴다. 음수 부호는 값 정리에서 빠지므로(-5 → 5) 넣지 않는다.
RATING_SERVICE = [
    ("MAXIMUM AMBIENT TEMPERATURE", f"{vin['operating_temp'].split('+')[-1].split()[0]} °C"),
    ("MAINTENANCE PERIOD", f"not less than {num(vin['maintenance_months'])} months"),
    ("SERVICE LIFE", f"not less than {num(vin['service_life_years'])} years"),
]
# 도면 2: 차단기 명판
RATING_CB = [
    ("TYPE", TYPE),
    ("STANDARD", STD_CB),
    ("RATED VOLTAGE", f"{KV} kV"),
    ("RATED NORMAL CURRENT", f"{num(p['rated_current_a'])} A"),
    ("RATED SHORT-CIRCUIT BREAKING CURRENT", f"{num(p['short_circuit_ka'])} kA"),
    ("TOTAL CLOSING TIME", f"not exceeding {num(p['closing_time_ms'])} ms"),
    ("INSULATION MEDIUM", f"{p['insulation_medium']} GAS"),
    ("MAINTENANCE PERIOD", f"not less than {num(p['maintenance_months'])} months"),
    ("SERVICE LIFE", f"not less than {num(p['service_life_years'])} years"),
]

W, H = 2400, 3800
BLACK, BLUE, GREY = (0, 0, 0), (0, 0, 200), (110, 110, 110)
F_SM, F_MD, F_LB = font(26), font(36), font(30)
F_HD, F_TT = font(40, "bold"), font(46, "bold")
F_VAL = font(38, "bold")          # 값은 굵게: OCR이 "kV"를 "kv"로 읽는 일을 줄임


class Sheet:
    def __init__(self):
        self.im = Image.new("RGB", (W, H), "white")
        self.d = ImageDraw.Draw(self.im)

    def line(self, *pts, w=3, fill=BLACK):
        self.d.line(pts, fill=fill, width=w)

    def rect(self, x0, y0, x1, y1, w=3, fill=None, outline=BLACK):
        self.d.rectangle((x0, y0, x1, y1), outline=outline, width=w, fill=fill)

    def circle(self, x, y, r, w=3):
        self.d.ellipse((x - r, y - r, x + r, y + r), outline=BLACK, width=w)

    def text(self, x, y, s, f=F_MD, anchor="la", fill=BLACK):
        self.d.text((x, y), s, font=f, fill=fill, anchor=anchor)

    def frame(self):
        self.rect(30, 30, W - 30, H - 30, w=3)
        self.rect(60, 60, W - 60, H - 60, w=6)
        for i in range(1, 8):                 # 테두리 눈금 (숫자는 넣지 않음)
            x = 60 + i * (W - 120) // 8
            self.line((x, 30), (x, 60), w=2)
            self.line((x, H - 60), (x, H - 30), w=2)

    def title_block(self, title1, title2, dwg_no):
        x0, y0, x1, y1 = W - 1140, H - 420, W - 60, H - 60
        self.rect(x0, y0, x1, y1, w=5)
        rows = [y0, y0 + 70, y0 + 160, y0 + 250, y1]
        for y in rows[1:-1]:
            self.line((x0, y), (x1, y), w=3)
        self.line((x0 + 230, y0), (x0 + 230, y0 + 250), w=3)
        self.text(x0 + 20, y0 + 20, "CLIENT", F_SM)
        self.text(x0 + 250, y0 + 18, "PROCURING ENTITY", F_LB)
        self.text(x0 + 20, y0 + 100, "PROJECT", F_SM)
        self.text(x0 + 250, y0 + 95, "PRODUCT MASTER BASED PROCUREMENT", F_LB)
        self.text(x0 + 20, y0 + 175, "TITLE", F_SM)
        self.text(x0 + 250, y0 + 168, title1, F_LB)
        self.text(x0 + 250, y0 + 208, title2, F_LB)
        cols = [x0, x0 + 450, x0 + 640, x0 + 840, x1]
        for x in cols[1:-1]:
            self.line((x, y0 + 250), (x, y1), w=3)
        for x, (k, v) in zip(cols, [("DWG NO", dwg_no), ("REV", "0"), ("SCALE", "NTS"),
                                    ("DATE", "2026-11-02")]):
            self.text(x + 18, y0 + 262, k, F_SM)
            self.text(x + 18, y0 + 300, v, F_HD)

        # 왼쪽 개정란 + 주기
        rx0, rx1 = 90, 1200
        self.rect(rx0, H - 240, rx1, H - 90, w=3)
        self.line((rx0, H - 190), (rx1, H - 190), w=2)
        self.line((rx0 + 120, H - 240), (rx0 + 120, H - 90), w=2)
        self.line((rx0 + 420, H - 240), (rx0 + 420, H - 90), w=2)
        self.text(rx0 + 20, H - 230, "REV", F_SM)
        self.text(rx0 + 140, H - 230, "DATE", F_SM)
        self.text(rx0 + 440, H - 230, "DESCRIPTION", F_SM)
        self.text(rx0 + 40, H - 170, "0", F_SM)
        self.text(rx0 + 140, H - 170, "2026-11-02", F_SM)
        self.text(rx0 + 440, H - 170, "ISSUED FOR BID", F_SM)
        self.text(90, H - 330, "FOR BID PURPOSE ONLY", F_HD)

    # ---- 기호 (세로 선 위)
    def ds(self, x, y):                       # 단로기: 끊긴 선 + 비스듬한 날
        self.line((x, y - 30), (x, y - 18), w=3)
        self.line((x, y + 18), (x, y + 30), w=3)
        self.line((x, y + 18), (x - 22, y - 16), w=4)
        self.line((x - 10, y - 18), (x + 10, y - 18), w=3)

    def cb(self, x, y):                       # 차단기: 네모
        self.rect(x - 26, y - 26, x + 26, y + 26, w=4, fill="white")

    def ct(self, x, y):                       # 변류기: 원 두 개
        self.circle(x, y - 11, 14)
        self.circle(x, y + 11, 14)

    def gnd(self, x, y):
        for i, half in enumerate((20, 13, 6)):
            self.line((x - half, y + i * 8), (x + half, y + i * 8), w=3)

    def es(self, x, y, side=1):               # 접지개폐기: 옆 가지 + 날 + 접지
        bx = x + side * 60
        self.line((x, y), (bx - side * 30, y), w=3)
        self.line((bx - side * 30, y), (bx + side * 2, y - 18), w=4)
        self.line((bx + side * 4, y), (bx + side * 4, y + 30), w=3)
        self.line((bx - side * 4, y), (bx + side * 10, y), w=3)
        self.gnd(bx + side * 4, y + 30)

    def vt(self, x, y, side=-1):
        bx = x + side * 70
        self.line((x, y), (bx, y), w=3)
        self.line((bx, y), (bx, y + 20), w=3)
        self.circle(bx, y + 36, 16)
        self.circle(bx, y + 60, 16)

    def la(self, x, y, side=1):               # 피뢰기
        bx = x + side * 70
        self.line((x, y), (bx, y), w=3)
        self.line((bx, y), (bx, y + 18), w=3)
        self.rect(bx - 12, y + 18, bx + 12, y + 62, w=3)
        self.line((bx, y + 30), (bx, y + 50), w=2)
        self.line((bx, y + 62), (bx, y + 80), w=3)
        self.gnd(bx, y + 80)

    def cable_head(self, x, y):
        self.d.polygon([(x - 22, y), (x + 22, y), (x, y + 34)], outline=BLACK, width=3)
        self.line((x, y + 34), (x, y + 70), w=3)

    def tr(self, x, y):                       # 변압기 기호: 겹친 원
        self.circle(x, y + 32, 32, w=4)
        self.circle(x, y + 78, 32, w=4)


def callout(s, x0, y0, x1, heading, rows, value_x, step=70):
    """설비별 주기 상자: 풍선 기호가 붙은 굵은 제목 + "항목 : 값" 줄."""
    tag, title = heading
    s.circle(x0 + 55, y0 + 50, 30, w=4)
    s.text(x0 + 55, y0 + 50, tag, F_HD, anchor="mm")
    s.text(x0 + 110, y0 + 30, title, F_HD)
    yy = y0 + 30 + step + 20
    for name, value in rows:
        s.text(x0 + 110, yy, name + " :", F_MD)
        s.text(x0 + 110 + s.d.textlength(name + " : ", font=F_MD), yy, value, F_VAL)
        yy += step
    y1 = yy + 10
    s.rect(x0, y0, x1, y1, w=3)
    return y1


def balloon(s, x, y, tag, tx, ty):
    """그림 안 풍선 기호와 설비까지 인출선."""
    s.line((x, y), (tx, ty), w=2)
    s.d.ellipse((tx - 8, ty - 8, tx + 8, ty + 8), fill=BLACK)
    s.d.ellipse((x - 30, y - 30, x + 30, y + 30), fill="white", outline=BLACK, width=4)
    s.text(x, y, tag, F_HD, anchor="mm")


def drawing_sld():
    """단선도. 그림 안에는 설비 이름과 풍선 기호, 값은 풍선별 주기 상자.

    값 줄과 같은 높이에 기호가 있으면 OCR(--psm 6)이 기호를 글자로 섞어 읽는다.
    그래서 주기 상자는 그림 아래, 기호가 없는 높이에 둔다.
    """
    global H
    H = 3800                                    # 단선도 + 주기 상자 4개
    s = Sheet()
    s.frame()
    bus_a, bus_b, x0, x1 = 300, 380, 300, 2100
    s.line((x0, bus_a), (x1, bus_a), w=8)
    s.line((x0, bus_b), (x1, bus_b), w=8)
    s.text(x0, bus_a - 70, f"{KV} kV BUS A", F_LB)
    s.text(x1, bus_a - 70, f"{KV} kV BUS B", F_LB, anchor="ra")

    def feeder(x, kind):
        s.line((x - 45, bus_a), (x - 45, 510), w=3)
        s.line((x + 45, bus_b), (x + 45, 510), w=3)
        s.ds(x - 45, 440)
        s.ds(x + 45, 460)
        s.line((x - 45, 510), (x + 45, 510), w=3)
        s.line((x, 510), (x, 1320), w=3)
        s.es(x, 580)
        s.ct(x, 660)
        s.cb(x, 760)
        s.ct(x, 860)
        s.es(x, 930)
        s.ds(x, 1010)
        s.es(x, 1090)
        s.vt(x, 1140)
        if kind == "LINE":
            s.la(x, 1210)
            s.cable_head(x, 1320)
        else:
            s.tr(x, 1320)
        for yb in (530, 990):                   # 가스 구획 경계 (점선)
            for xx in range(x - 130, x + 130, 30):
                s.line((xx, yb), (xx + 16, yb), w=2)

    xl, xc, xt = 620, 1200, 1780
    feeder(xl, "LINE")
    feeder(xt, "TR")
    s.line((xc - 80, bus_a), (xc - 80, 760), w=3)        # 모선 연락
    s.line((xc + 80, bus_b), (xc + 80, 760), w=3)
    s.line((xc - 80, 760), (xc + 80, 760), w=3)
    s.ds(xc - 80, 460)
    s.ds(xc + 80, 480)
    s.ct(xc - 80, 650)
    s.cb(xc, 760)
    s.ct(xc + 80, 650)
    # 그림 안 설비 이름 (값 없음)
    s.text(xl - 150, 760, "52 GCB", F_SM, anchor="rm")
    s.text(xl - 150, 1010, "89L DS", F_SM, anchor="rm")
    s.text(xl - 150, 630, "CT", F_SM, anchor="rm")
    s.text(xl + 100, 605, "57", F_SM, anchor="lm")
    s.text(xl - 150, 1170, "VT", F_SM, anchor="rm")
    s.text(xl - 110, 425, "89A", F_SM, anchor="rm")
    s.text(xl + 90, 425, "89B", F_SM, anchor="lm")
    s.text(xl + 150, 1250, "LA", F_SM, anchor="lm")
    s.text(xl + 40, 1380, "CABLE SEALING END", F_SM, anchor="lm")
    s.text(xt + 60, 1430, "MAIN TR", F_SM, anchor="lm")
    s.text(xt - 150, 760, "52 GCB", F_SM, anchor="rm")
    s.text(xt - 150, 1010, "89T DS", F_SM, anchor="rm")
    for x, lab in [(xl, "LINE NO.1"), (xc, "BUS COUPLER"), (xt, "TR NO.1")]:
        s.text(x, 1500, lab, F_LB, anchor="ma")
    balloon(s, 2230, 210, "A", 2050, bus_a)
    balloon(s, 2230, 760, "B", xt + 28, 760)
    balloon(s, 2230, 1290, "C", xt + 32, 1350)
    balloon(s, 2230, 1050, "D", xt + 130, 990)
    s.text(W // 2, 1590, "SINGLE LINE DIAGRAM", F_TT, anchor="ma")

    vx, bx0, bx1 = 1600, 120, W - 120
    y = callout(s, bx0, 1720, bx1, ("A", f"{KV} kV DOUBLE BUSBAR"), RATING_BUS, vx)
    y = callout(s, bx0, y + 40, bx1, ("B", "GAS CIRCUIT BREAKER"), RATING_GCB, vx)
    y = callout(s, bx0, y + 40, bx1, ("C", "INSULATION LEVEL"), RATING_INS, vx)
    callout(s, bx0, y + 40, bx1, ("D", "SF6 GAS COMPARTMENT"), RATING_GAS, vx)
    s.title_block(f"{KV} kV GIS", "SINGLE LINE DIAGRAM", "E-GIS-001")
    return s.im


def drawing_lcc():
    """현장 조작반 정면도 + 명판 상세 (예시: 26 11 16.01 FRONT VIEW, NP 1, LATCH SIDE)."""
    global H
    H = 3000
    s = Sheet()
    s.frame()
    cx0, cy0, cx1, cy1 = 520, 150, 1880, 1250
    s.rect(cx0, cy0, cx1, cy1, w=6)
    s.rect(cx0 + 20, cy0 + 20, cx1 - 20, cy1 - 20, w=2)
    for y in (cy0 + 120, cy1 - 140):                         # 경첩
        s.rect(cx0 - 22, y, cx0, y + 60, w=3)
    s.circle(cx1 - 60, (cy0 + cy1) // 2, 18)                # 손잡이
    s.line((cx1 - 72, (cy0 + cy1) // 2), (cx1 - 48, (cy0 + cy1) // 2), w=4)
    s.line((cx1 + 10, 520), (cx1 + 10, 800), w=8)
    s.text(cx1 + 60, 400, "LATCH", F_LB)
    s.text(cx1 + 60, 440, "SIDE", F_LB)
    s.line((cx1 + 100, 480), (cx1 + 100, 560), (cx1 + 20, 640), w=3)
    s.d.polygon([(cx1 + 18, 642), (cx1 + 42, 612), (cx1 + 50, 640)], fill=BLACK)
    npx0, npy0, npx1, npy1 = cx1 - 330, cy0 + 50, cx1 - 90, cy0 + 110
    s.rect(npx0, npy0, npx1, npy1, w=3)
    s.text((npx0 + npx1) // 2, npy0 + 14, "NP 1", F_LB, anchor="ma")
    mx = 900                                                 # 모의 계통
    s.line((mx - 160, 330), (mx + 160, 330), w=6)
    s.line((mx, 330), (mx, 980), w=4)
    s.ds(mx, 420)
    s.cb(mx, 560)
    s.ds(mx, 700)
    s.es(mx, 800)
    s.cable_head(mx, 900)
    for y, lab in [(420, "DS1"), (560, "CB"), (700, "DS2"), (800, "ES1")]:
        s.circle(mx - 170, y, 24)
        s.text(mx - 220, y, lab, F_SM, anchor="rm")
    gx = 1250
    for i, lab in enumerate(["SF6 LOW", "SF6 BLOCK", "MOTOR FAIL", "SPRING DISCH"]):
        y = 330 + i * 120
        s.rect(gx, y, gx + 380, y + 80, w=3)
        s.text(gx + 190, y + 40, lab, F_SM, anchor="mm")
    for i, lab in enumerate(["LOCAL", "REMOTE"]):
        s.text(gx + 60 + i * 260, 880, lab, F_SM, anchor="ma")
    s.circle(gx + 190, 960, 40, w=4)
    s.line((gx + 190, 925), (gx + 190, 995), w=6)
    s.text(W // 2, 1300, "FRONT VIEW", F_TT, anchor="ma")

    # 명판 상세: NP 1에서 인출선으로 연결
    y0 = 1460
    s.text(140, y0, "DETAIL OF NP 1", F_HD)
    px0, py0, px1 = 120, y0 + 100, W - 120
    rows_end = py0 + 140 + len(RATING_CB) * 64
    s.line((npx1, (npy0 + npy1) // 2), (W - 90, (npy0 + npy1) // 2), (W - 90, py0 + 60),
           (px1, py0 + 60), w=2)
    s.d.ellipse((npx1 - 8, (npy0 + npy1) // 2 - 8, npx1 + 8, (npy0 + npy1) // 2 + 8),
                fill=BLACK)
    s.d.rounded_rectangle((px0, py0, px1, rows_end + 40), radius=30, outline=BLACK, width=5)
    for x, y in [(px0 + 40, py0 + 40), (px1 - 40, py0 + 40),
                 (px0 + 40, rows_end), (px1 - 40, rows_end)]:
        s.circle(x, y, 12)
    s.text(W // 2, py0 + 40, f"GAS CIRCUIT BREAKER FOR {KV} kV GIS", F_MD, anchor="ma")
    yy = py0 + 130
    for name, value in RATING_CB:
        s.text(180, yy, name + " :", F_MD)
        s.text(180 + s.d.textlength(name + " : ", font=F_MD), yy, value, F_VAL)
        yy += 64
    s.text(140, rows_end + 90, "STAINLESS STEEL, ENGRAVED BLACK LETTERS", F_SM)
    s.title_block(f"{KV} kV GIS LOCAL CONTROL CABINET", "FRONT VIEW AND NAMEPLATE DETAIL",
                  "E-GIS-002")
    return s.im


def drawing_mv():
    """24 kV 금속폐쇄형 배전반 정면도 (예시: 26 11 16.01 FRONT VIEW, 26 13 00 MV switchgear).

    그림 안: 반 이름, 구획 이름, 풍선 A~D. 값: 풍선별 주기 상자 (기호와 같은 높이를 피함).
    """
    global H
    H = 3950
    s = Sheet()
    s.frame()
    panels = [(300, "INCOMER"), (900, "FEEDER NO.1"), (1500, "FEEDER NO.2")]
    pw, top, bot = 600, 300, 1480
    s.rect(300, 250, 2100, top, w=4)                         # 모선실 덮개
    s.text(1200, 205, f"{MV_KV} kV MAIN BUS", F_LB, anchor="ma")
    for x0, name in panels:
        s.rect(x0, top, x0 + pw, bot, w=5)
        # 저압실 문: 계전기·계기
        s.rect(x0 + 25, top + 20, x0 + pw - 25, top + 330, w=3)
        s.rect(x0 + 150, top + 40, x0 + pw - 150, top + 90, w=2)
        s.text(x0 + pw // 2, top + 50, name, F_SM, anchor="ma")
        for i in range(3):
            s.rect(x0 + 70 + i * 160, top + 130, x0 + 170 + i * 160, top + 220, w=3)
        for i in range(2):
            s.circle(x0 + 200 + i * 200, top + 275, 30)
        # 차단기실 문: 들여다보는 창, 모의 계통, 인출 구멍
        s.rect(x0 + 25, top + 350, x0 + pw - 25, top + 820, w=3)
        s.rect(x0 + 180, top + 420, x0 + pw - 180, top + 600, w=3)
        s.line((x0 + 110, top + 380), (x0 + 110, top + 790), w=6)
        s.rect(x0 + 92, top + 560, x0 + 128, top + 596, w=4, fill="white")
        s.circle(x0 + pw // 2, top + 700, 22)
        s.rect(x0 + pw - 70, top + 560, x0 + pw - 50, top + 680, w=3)
        # 케이블실 문: 통풍구
        s.rect(x0 + 25, top + 840, x0 + pw - 25, bot - 20, w=3)
        for k in range(6):
            yy = top + 900 + k * 30
            s.line((x0 + 200, yy), (x0 + pw - 200, yy), w=3)
        s.rect(x0 + pw - 70, top + 980, x0 + pw - 50, top + 1080, w=3)
    s.rect(280, bot, 2120, bot + 30, w=3)                    # 받침 채널
    # 구획 이름 (왼쪽 인출)
    for y, lab in [(top + 170, "LV"), (top + 585, "CB"), (top + 1000, "CABLE")]:
        s.text(90, y - 80, lab, F_SM)
        s.text(90, y - 46, "COMPARTMENT", F_SM)
        s.line((90, y - 12), (290, y - 12), (325, y), w=2)
    balloon(s, 2240, 330, "A", 2100, 280)
    balloon(s, 2240, 760, "B", 600, top + 510)
    balloon(s, 2240, 1040, "C", 2020, top + 600)
    balloon(s, 2240, 1380, "D", 2100, bot - 40)
    s.text(W // 2, 1590, "FRONT VIEW", F_TT, anchor="ma")

    vx, bx0, bx1 = 1600, 120, W - 120
    y = callout(s, bx0, 1720, bx1, ("A", f"{MV_KV} kV METAL-CLAD SWITCHGEAR"), RATING_MV, vx)
    y = callout(s, bx0, y + 40, bx1, ("B", "VACUUM CIRCUIT BREAKER, INCOMER"), RATING_VCB_IN, vx)
    y = callout(s, bx0, y + 40, bx1, ("C", "VACUUM CIRCUIT BREAKER, FEEDER"), RATING_VCB_FD, vx)
    callout(s, bx0, y + 40, bx1, ("D", "SERVICE CONDITIONS"), RATING_SERVICE, vx)
    s.title_block(f"{MV_KV} kV METAL-CLAD SWITCHGEAR", "FRONT VIEW", "E-MV-001")
    return s.im


def build():
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    img1, img2 = IMG_DIR / "E-GIS-001_SLD.png", IMG_DIR / "E-GIS-002_LCC.png"
    img3 = IMG_DIR / "E-MV-001_SWGR.png"
    drawing_sld().save(img1)
    drawing_lcc().save(img2)
    drawing_mv().save(img3)

    doc = Document(str(SRC))
    anchor = next(q for q in doc.paragraphs if q.text.startswith("Appendix A"))

    def para(text, style="Normal"):
        return anchor.insert_paragraph_before(text, style=style)

    def picture(path, caption):
        pic = para("")
        pic.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pic.add_run().add_picture(str(path), width=Cm(17.0))
        cap = para(caption)
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER

    para("8. Reference Drawings", "Heading 1")
    para("The following drawings form part of this RFP and show the ratings of the offered "
         "equipment.")
    para(f"8.1 Single Line Diagram of {KV} kV Gas Insulated Switchgear", "Heading 2")
    picture(img1, f"Figure 8.1 {KV} kV GIS single line diagram (DWG No. E-GIS-001)")
    para("8.2 Local Control Cabinet and Circuit Breaker Nameplate", "Heading 2")
    picture(img2, f"Figure 8.2 {KV} kV GIS local control cabinet front view and nameplate "
                  "detail (DWG No. E-GIS-002)")
    para(f"8.3 {MV_KV} kV Metal-Clad Switchgear", "Heading 2")
    picture(img3, f"Figure 8.3 {MV_KV} kV metal-clad switchgear front view (DWG No. E-MV-001)")
    doc.save(str(OUT))
    print(OUT)


if __name__ == "__main__":
    build()
