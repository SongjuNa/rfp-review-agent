"""AI 호출 규칙: 재시도 횟수, 실패 메시지, 사실에 없는 숫자 버리기 (CR-07, CR-12)."""

import pytest

from rfp_agent.llm import tasks
from rfp_agent.llm.client import FAILURE_MESSAGE, MAX_RETRIES, LLMFailure, make_llm
from rfp_agent.llm.evidence import EvidenceSpan
from tests.conftest import FakeLLM


def test_no_key_means_no_llm():
    assert make_llm(None, "gemini-3.8-flash") is None


def test_retries_then_fails_with_message():
    llm = FakeLLM(fail=True)
    with pytest.raises(LLMFailure, match=FAILURE_MESSAGE):
        tasks.classify_document(llm, "a.docx", "first page")
    assert len(llm.prompts) == MAX_RETRIES + 1


FACTS = "파일 6 174행: 0.5 % 이내\n파일 6 278행: 1 % 이내"
SPANS = [EvidenceSpan("E-6-174", "Annual leakage rate shall be 0.5 % or less."),
         EvidenceSpan("E-6-278", "The leakage rate shall not exceed 1 % per year.")]


class ClaimLLM(FakeLLM):
    """정해 둔 설명 문장 하나를 낸다."""

    def __init__(self, text="허용 누설량이 두 곳에서 다르다.", quote="0.5 % or less",
                 ids=("E-6-174",)):
        super().__init__()
        self.claim = {"text": text, "exact_quote": quote, "evidence_ids": list(ids),
                      "relation": "DIRECT"}

    def generate_json(self, prompt, schema):
        self.prompts.append(prompt)
        return {"claims": [self.claim]}


def test_explanation_with_invented_number_is_dropped():
    llm = ClaimLLM(text="허용 누설량이 연간 2 % 로 더 크다.")
    assert tasks.explain_risk(llm, "VALUE_MISMATCH", FACTS, SPANS) is None


def test_explanation_keeps_claim_with_quote_and_evidence():
    """근거 조각 ID와 그 조각에 있는 인용을 댄 설명만 남는다 (add-claim-evidence)."""
    llm = ClaimLLM()
    out = tasks.explain_risk(llm, "VALUE_MISMATCH", FACTS, SPANS)
    assert out is not None and out.text == "허용 누설량이 두 곳에서 다르다."
    assert out.claims[0].evidence_ids == ("E-6-174",) and out.claims[0].relation == "DIRECT"
    assert "[E-6-174] Annual leakage rate" in llm.prompts[0]


@pytest.mark.parametrize("quote, ids", [
    ("2 % per year", ("E-6-174",)),            # 인용이 근거 조각에 없다
    ("1 % per year", ("E-6-174",)),            # 다른 조각에 있는 인용을 엉뚱한 ID로 댔다
    ("0.5 % or less", ("E-9-999",)),           # 주지 않은 근거 ID
])
def test_explanation_with_unsupported_quote_is_dropped(quote, ids):
    """Scenario: 근거에 없는 인용 — 인용·근거 ID가 맞지 않으면 설명을 버린다."""
    llm = ClaimLLM(quote=quote, ids=ids)
    assert tasks.explain_risk(llm, "VALUE_MISMATCH", FACTS, SPANS) is None


def test_explanation_failure_is_not_hidden():
    """Scenario: 설명을 받지 못함 — 정해진 횟수만 다시 묻고 실패를 알린다 (CR-12)."""
    llm = FakeLLM(fail=True)
    with pytest.raises(LLMFailure):
        tasks.explain_risk(llm, "VALUE_MISMATCH", FACTS, SPANS)
    assert len(llm.prompts) == MAX_RETRIES + 1


class ShortListLLM(FakeLLM):
    """긴 목록이면 답을 하나 빠뜨리는 모델. 같은 질문에는 늘 같은 답(temperature 0)."""

    def generate_json(self, prompt, schema):
        self.prompts.append(prompt)
        n = sum(1 for line in prompt.splitlines() if line[:1].isdigit() and ". " in line)
        return {"types": ["TECH_PERF"] * (n - 1 if n > 10 else n)}


def test_missing_answer_splits_chunk_and_keeps_count():
    """모델이 40개 중 하나를 빠뜨려도 묶음을 나눠 다시 물어 개수를 맞춘다."""
    texts = [f"요구사항 {i}" for i in range(40)]
    out = tasks.type_unclassified(ShortListLLM(), texts)
    assert out == ["TECH_PERF"] * 40
