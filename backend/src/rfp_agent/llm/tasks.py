"""언어 모델에 맡기는 일 4가지. 모두 '보조'이고, 결과는 코드가 검증한다."""

import re

from rfp_agent.llm.client import LLM, call_with_retry

PROMPT_VERSION = "p1"
DOC_KINDS = ["BID_FORM", "REQUIREMENT_SPEC", "PURCHASE_SPEC", "TEST_SPEC", "SUPPLIER_SPEC",
             "UNKNOWN"]
SENTENCE_LABELS = ["REQUIREMENT", "WRITING_RULE", "DESCRIPTION"]
TYPE_CODES = ["TECH_PERF", "RISK", "STANDARD_CERT", "COST", "TEST", "MAKER_QUAL", "SITE_ENV",
              "NONE"]
CHUNK = 40


def one_line(text: str) -> str:
    """번호 매긴 목록이 깨지지 않게 줄바꿈을 없앤다."""
    return re.sub(r"\s+", " ", text).strip()


def classify_document(llm: LLM, file_name: str, first_page: str) -> str:
    prompt = (
        "다음은 전력 설비 입찰 RFP 문서의 파일명과 첫 장이다. 문서 종류를 하나 고른다.\n"
        "BID_FORM=입찰 서식, REQUIREMENT_SPEC=요구 사양, PURCHASE_SPEC=구매 사양, "
        "TEST_SPEC=시험 사양, SUPPLIER_SPEC=공급사 사양·답안, UNKNOWN=모름.\n"
        f"파일명: {file_name}\n첫 장:\n{first_page[:4000]}"
    )
    schema = {"type": "object", "properties": {"doc_kind": {"type": "string", "enum": DOC_KINDS}},
              "required": ["doc_kind"]}

    def check(d):
        assert d["doc_kind"] in DOC_KINDS

    return call_with_retry(llm, prompt, schema, check)["doc_kind"]


def label_sentences(llm: LLM, section_title: str | None, sentences: list[str]) -> list[str]:
    """절 단위로 문장마다 요구사항 / 작성 규칙 / 설명 중 하나를 붙인다."""
    labels: list[str] = []
    for start in range(0, len(sentences), CHUNK):
        part = sentences[start:start + CHUNK]
        numbered = "\n".join(f"{i}. {one_line(s)[:600]}" for i, s in enumerate(part))
        prompt = (
            "RFP의 한 절에서 뽑은 문장들이다. "
            "각 문장이 입찰자가 지켜야 할 요구사항(REQUIREMENT)인지, "
            "제출 양식을 채우는 방법에 대한 작성 규칙(WRITING_RULE)인지, "
            "설명(DESCRIPTION)인지 고른다. "
            "문장 수와 같은 개수의 label을 같은 순서로 낸다.\n"
            f"절 제목: {section_title or '(없음)'}\n{numbered}"
        )
        schema = {"type": "object", "properties": {"labels": {
            "type": "array", "items": {"type": "string", "enum": SENTENCE_LABELS}}},
            "required": ["labels"]}

        def check(d, part=part):
            assert len(d["labels"]) == len(part) and all(x in SENTENCE_LABELS for x in d["labels"])

        labels.extend(call_with_retry(llm, prompt, schema, check)["labels"])
    return labels


def type_unclassified(llm: LLM, texts: list[str]) -> list[str]:
    out: list[str] = []
    for start in range(0, len(texts), CHUNK):
        part = texts[start:start + CHUNK]
        numbered = "\n".join(f"{i}. {one_line(t)[:400]}" for i, t in enumerate(part))
        prompt = (
            "RFP 요구사항마다 유형 하나를 고른다. TECH_PERF=기술 성능, RISK=위험 조건, "
            "STANDARD_CERT=적용 규격·인증, COST=비용 영향, TEST=시험, MAKER_QUAL=제조사 자격, "
            "SITE_ENV=설치 환경, NONE=어느 것도 아님. 같은 순서, 같은 개수로 낸다.\n" + numbered
        )
        schema = {"type": "object", "properties": {"types": {
            "type": "array", "items": {"type": "string", "enum": TYPE_CODES}}},
            "required": ["types"]}

        def check(d, part=part):
            assert len(d["types"]) == len(part) and all(x in TYPE_CODES for x in d["types"])

        out.extend(call_with_retry(llm, prompt, schema, check)["types"])
    return out


NUMBER = re.compile(r"\d+(?:[.,]\d+)?")


def explain_risk(llm: LLM, kind: str, facts: str, texts: list[str]) -> str | None:
    """위험 조건 설명. 사실(facts)에 없는 숫자를 쓰면 버린다 (CR-07)."""
    prompt = (
        "입찰 기술 검토 엔지니어에게 이 조항이 왜 위험한지, 또는 두 값이 왜 다를 수 있는지 "
        "한국어 두세 문장으로 설명한다. 아래 사실에 없는 숫자는 쓰지 않는다.\n"
        f"종류: {kind}\n사실:\n{facts}\n원문:\n" + "\n".join(t[:800] for t in texts)
    )
    schema = {"type": "object", "properties": {"explanation": {"type": "string"}},
              "required": ["explanation"]}

    def check(d):
        assert d["explanation"].strip()

    text = call_with_retry(llm, prompt, schema, check)["explanation"].strip()
    allowed = {n.replace(",", "") for n in NUMBER.findall(facts + " " + " ".join(texts))}
    if any(n.replace(",", "") not in allowed for n in NUMBER.findall(text)):
        return None
    return text
