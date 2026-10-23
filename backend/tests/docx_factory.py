"""테스트용 합성 RFP docx. 고객 원문 없이 CI에서 Scenario를 확인하려고 만든다.

실제 문서에서 본 모양을 흉내 낸다: 목차, 제목 뒤 줄바꿈 본문, 쪽 넘김으로 나뉜 데이터시트 표,
반복 머리글, "- …" 하위 항목, [REDACTED], 계산식, 한 단락 속 값 두 개, 장소가 다른 UPS 용량.
"""

from pathlib import Path

from docx import Document

HEADER = ["No.", "Description", "Unit", "Employer's Requirement", "Warranted Data"]
TOC = ["1. GENERAL", "2. SCOPE OF SUPPLY", "3. CLARIFICATION, EXCEPTION AND DEVIATION",
       "4. DATA SHEET", "5. 차단기"]


def _table(doc, rows: list[list[str]]) -> None:
    table = doc.add_table(rows=0, cols=len(HEADER))
    for values in rows:
        cells = table.add_row().cells
        for cell, value in zip(cells, values, strict=True):
            cell.text = value


def _heading_with_body(doc, heading: str, body: str) -> None:
    """"6. CLARIFICATION …⏎본문"처럼 제목 뒤에 줄바꿈(w:br)으로 본문이 붙은 단락."""
    run = doc.add_paragraph().add_run(heading)
    run.add_break()
    run.add_text(body)


def build_gis_spec(path: Path) -> Path:
    doc = Document()
    doc.add_paragraph("TECHNICAL SPECIFICATION FOR 154 kV GAS INSULATED SWITCHGEAR")
    doc.add_paragraph("TABLE OF CONTENTS")
    for line in TOC:
        doc.add_paragraph(line)

    doc.add_paragraph("1. GENERAL")
    doc.add_paragraph("The switchgear shall comply with IEC 62271-203 and IEC 62271-1.")
    doc.add_paragraph("The bidder shall indicate their data corresponding to the Employer's "
                      "Requirement in the Warranted Data column.")
    doc.add_paragraph("The maximum ambient temperature for the GIS enclosure shall be 40 °C.")
    doc.add_paragraph("Cable current ratings shall be based on an ambient temperature of 50 °C.")
    doc.add_paragraph("1)UPS : 5kVA (수상전기실) 10kVA (154kV 변전소)")

    doc.add_paragraph("2. SCOPE OF SUPPLY")
    doc.add_paragraph("The supply shall include all accessories, including but not limited to "
                      "cables, supports and earthing materials.")

    _heading_with_body(doc, "3. CLARIFICATION, EXCEPTION AND DEVIATION",
                       "Any item not listed in the deviation list shall be deemed to be "
                       "accepted by the Vendor.")

    doc.add_paragraph("4. DATA SHEET")
    # 쪽 넘김으로 나뉜 표 두 개. 두 번째 표는 제목·머리글 줄이 다시 나온다.
    title = ["TS-154-GIS"] * len(HEADER)
    _table(doc, [
        title, HEADER,
        ["1", "Rated voltage", "kV", "170", ""],
        ["2", "Rated short-time withstand current, (1 sec.)", "kA", "40", ""],
        ["3", "Annual leakage rate for each gas compartment", "%", "<0.5", ""],
    ])
    _table(doc, [
        title, HEADER,
        ["4", "Rated voltage of auxiliary circuits", "V", "[REDACTED]", ""],
        ["5", "Rated normal current", "A", "3150", ""],
        ["", "- Feeder bays", "A", "2000", ""],
        ["", "- Bus coupler", "A", "3150", ""],
        ["6", "Rated peak withstand current", "kA", "2.5 x 40", ""],
        ["7", "Type Test Report", "", "Required", ""],
    ])

    doc.add_paragraph("5. 차단기")
    doc.add_paragraph("가. 일반사항")
    doc.add_paragraph("상시 공기가 밀봉되는 부분은 압력저하가 3 % 이내로 되어야 한다. "
                      "또 가스의 경우는 가스 누설량이 연간 1 % 이내로 되어야 한다.")
    doc.save(str(path))
    return path


def build_image_only(path: Path) -> Path:
    doc = Document()
    doc.add_paragraph("［도면 삭제］")
    doc.save(str(path))
    return path


def _datasheet(doc, name: str, rows: list[list[str]]) -> None:
    _table(doc, [[name] * len(HEADER), HEADER, *rows])


GIS_115_ROWS = [
    ["1", "Rated voltage", "kV", "145", ""],
    ["2", "Rated frequency", "Hz", "50", ""],
    ["3", "Rated normal current", "A", "3000", ""],
    ["4", "Rated short-time withstand current, (1 sec.)", "kA", "40", ""],
    ["5", "Annual leakage rate for each gas compartment", "%", "<0.5", ""],
    ["6", "Rated normal current of bus coupler", "kA", "3.15", ""],
    ["7", "Manufacturer's name", "", "", ""],
    ["8", "Weight of circuit breaker", "kg", "", ""],
]
FEEDER_QUERY_ROW = ["9", "Rated normal current of feeder bays", "A", "2000/1250", ""]


def build_judgment_spec(path: Path, title: str = "SCHEDULE OF TECHNICAL DATA") -> Path:
    """판정 대상(묶음 A) 데이터시트: 230 kV GIS(4,000 A 세 곳), 115 kV GIS(3,000 A·50 Hz)."""
    doc = Document()
    doc.add_paragraph(title)
    doc.add_paragraph("1. DATA SHEET")
    _datasheet(doc, "TS-230-GIS", [
        ["1", "Rated voltage", "kV", "245", ""],
        ["2", "Rated frequency", "Hz", "50", ""],
        ["3", "Rated normal current of main busbar", "A", "4000", ""],
        ["4", "Rated normal current of bus coupler", "A", "4000", ""],
        ["5", "Rated normal current of busbar disconnector", "A", "4000", ""],
        ["6", "Rated normal current of feeder bays", "A", "3500", ""],
        ["7", "Rated short-time withstand current, (1 sec.)", "kA", "50", ""],
    ])
    _datasheet(doc, "TS-115-GIS", [*GIS_115_ROWS, FEEDER_QUERY_ROW])
    doc.save(str(path))
    return path


def build_feeder_copy(path: Path) -> Path:
    """다른 문서에 같은 115 kV 행이 다시 나오는 경우 (같은 질의가 두 문서에)."""
    doc = Document()
    doc.add_paragraph("EMPLOYER'S REQUIREMENTS")
    doc.add_paragraph("1. GENERAL")
    doc.add_paragraph("The switchgear shall be designed, manufactured and tested in accordance "
                      "with the latest IEC standards and the data sheet below.")
    for topic in ("enclosure", "gas monitoring", "earthing", "control cubicle", "painting"):
        doc.add_paragraph(f"The {topic} shall be as specified in the general specification.")
    doc.add_paragraph("2. DATA SHEET")
    _datasheet(doc, "TS-115-GIS", [GIS_115_ROWS[0], GIS_115_ROWS[1], FEEDER_QUERY_ROW])
    doc.save(str(path))
    return path
