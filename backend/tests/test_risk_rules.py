"""FR-06 값 불일치 규칙 (명세 risk-detection). DB 없이 규칙만 본다."""

from rfp_agent.pipeline.risk import (
    RiskExpression,
    ValueRef,
    find_clause_risks,
    find_value_mismatches,
)

PARENTS = {"차단기": "GIS", "변류기": "GIS"}


def ref(key, doc, num, target, *, item="gas_leakage_rate", unit="%", project=None, std=None,
        equipment=None, table=None, row=None):
    return ValueRef(key=key, requirement_key=f"r{key}", document_key=doc, project_key=project,
                    item_key=item, num_value=num, unit=unit, target_object=target,
                    basis_standard=std, equipment_key=equipment, location=f"파일 {doc} {key}행",
                    raw_text=f"{num} {unit}", table_key=table, row_label=row)


def test_related_targets_with_different_standards():
    [c] = find_value_mismatches([ref(174, 6, 0.5, "GIS", std="IEC 62271-1"),
                                 ref(278, 6, 1, "차단기", std="KS C 8331")], PARENTS)
    assert "적용 대상과 근거 규격이 다름" in c.facts


def test_unrelated_targets_are_not_candidates():
    values = [ref(1, 1, 40, "GIS", item="ambient_temp_max", unit="°C"),
              ref(2, 1, 50, "케이블", item="ambient_temp_max", unit="°C")]
    assert find_value_mismatches(values, PARENTS) == []


def test_cross_document_needs_same_equipment_and_site():
    same = [ref(301, 19, 10, "UPS", item="rated_capacity", unit="kVA", project="P-D",
                equipment="UPS|154kV 변전소"),
            ref(3008, 22, 30, "UPS", item="rated_capacity", unit="kVA", project="P-D",
                equipment="UPS|154kV 변전소")]
    assert len(find_value_mismatches(same, PARENTS)) == 1
    other_site = [same[0], ref(301, 19, 5, "UPS", item="rated_capacity", unit="kVA",
                               project="P-D", equipment="UPS|수상전기실")]
    assert find_value_mismatches(other_site, PARENTS) == []


def test_other_projects_are_never_compared():
    values = [ref(1, 1, 10, "UPS", project="P-A", equipment="UPS|x"),
              ref(2, 2, 30, "UPS", project="P-D", equipment="UPS|x")]
    assert find_value_mismatches(values, PARENTS) == []


def test_equal_numbers_in_other_notation_are_not_candidates():
    values = [ref(1, 1, 0.5, "GIS"), ref(2, 1, 0.50, "GIS")]
    assert find_value_mismatches(values, PARENTS) == []


def test_two_datasheets_in_one_document_are_different_equipment():
    values = [ref(1, 1, 360, "변압기", item="rated_capacity", unit="MVA", table=10, row="1|p"),
              ref(2, 1, 240, "변압기", item="rated_capacity", unit="MVA", table=11, row="1|p")]
    assert find_value_mismatches(values, PARENTS) == []


def test_clause_risk_needs_clause_context():
    deemed = RiskExpression(1, "deemed", "en", "BLANKET")
    text = "Any item not listed shall be deemed to be accepted by the Vendor."
    assert find_clause_risks(text, ["CLARIFICATION, EXCEPTION AND DEVIATION"], [deemed])
    assert not find_clause_risks(text, ["Painting"], [deemed])
