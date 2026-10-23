"""FR-02 구조 나누기와 FR-03 추출을 합성 docx로 본다.

명세 document-intake, requirement-extraction의 Scenario.
"""

import pytest

from rfp_agent.pipeline.docx_reader import read_blocks
from rfp_agent.pipeline.extract import extract
from rfp_agent.pipeline.structure import build_tables, find_sections, heading_of
from tests.docx_factory import build_gis_spec

ROLES = {"No.": "ITEM_NO", "Description": "ITEM_NAME", "Unit": "UNIT",
         "Employer's Requirement": "REQUIRED", "Warranted Data": "WARRANTED"}


@pytest.fixture(scope="module")
def doc(tmp_path_factory):
    blocks = read_blocks(build_gis_spec(tmp_path_factory.mktemp("docx") / "spec.docx"))
    sections = find_sections(blocks)
    tables = build_tables(blocks, ROLES)
    return blocks, sections, tables


def test_heading_patterns():
    assert heading_of("5.2.2 154 kV 가스절연개폐장치")[:2] == ("NUM2", "5.2.2")
    assert heading_of("1)주 모 선")[:2] == ("PAREN_NUM", "1")
    assert heading_of("가. 일반사항")[:2] == ("HANGUL", "가")
    assert heading_of("표. 주모선 설계 자료") is None
    assert heading_of("3)기기 조작함에는 수동스위치를 설치하여야 한다. (투입, 트립") is None


def test_toc_lines_are_not_body_sections(doc):
    _, sections, _ = doc
    clar = [s for s in sections if s.title.startswith("CLARIFICATION")]
    assert [s.is_toc for s in clar] == [True, False]


def test_heading_followed_by_body_in_same_paragraph(doc):
    blocks, sections, tables = doc
    deemed = [c for c in extract(blocks, sections, tables) if "deemed" in c.text]
    assert len(deemed) == 1
    assert deemed[0].section.title.startswith("CLARIFICATION")
    assert deemed[0].text.startswith("Any item")


def test_split_table_is_joined_without_repeated_header(doc):
    _, _, tables = doc
    [table] = [t for t in tables if t.name == "TS-154-GIS"]
    assert table.source_table_nos == [0, 1]
    numbers = [r.item_no for r in table.rows]
    assert numbers == ["1", "2", "3", "4", "5", "5-1", "5-2", "6", "7"]
    assert not any(r.item_name == "Description" for r in table.rows)
    assert table.rows[5].parent_index == 4


def test_writing_rule_is_not_a_requirement(doc):
    blocks, sections, tables = doc
    rule = [c for c in extract(blocks, sections, tables) if "bidder shall indicate" in c.text]
    assert rule[0].req_kind == "WRITING_RULE"
