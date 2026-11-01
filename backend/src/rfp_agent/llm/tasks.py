"""언어 모델에 맡기는 일 4가지. 모두 '보조'이고, 결과는 코드가 검증한다."""

import re
from collections.abc import Callable
from dataclasses import dataclass

from rfp_agent.llm.client import LLM, LLMFailure, call_with_retry
from rfp_agent.llm.evidence import EvidenceSpan, normalize_quote
from rfp_agent.llm.parallel import run_ordered, workers_of

PROMPT_VERSION = "p2"
DOC_KINDS = ["BID_FORM", "REQUIREMENT_SPEC", "PURCHASE_SPEC", "TEST_SPEC", "SUPPLIER_SPEC",
             "UNKNOWN"]
SENTENCE_LABELS = ["REQUIREMENT", "WRITING_RULE", "DESCRIPTION"]
TYPE_CODES = ["TECH_PERF", "RISK", "STANDARD_CERT", "COST", "TEST", "MAKER_QUAL", "SITE_ENV",
              "NONE"]
CHUNK = 40

Progress = Callable[[int, int], None]      # (끝난 줄 수, 전체 줄 수) — 처리 상태 화면용


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


def _pick_each(llm: LLM, items: list[str], field: str, choices: list[str], prompt_of) -> list[str]:
    """항목마다 보기 하나를 고르게 한다. 답의 개수가 틀리면 묶음을 반으로 나눠 다시 묻는다.

    모델이 긴 목록에서 한두 개를 빠뜨리면 같은 질문을 되풀이해도 같은 답이 나온다(temperature 0).
    그래서 재시도(CR-12) 뒤에도 실패한 묶음만 둘로 나눈다. 한 개짜리도 실패하면 그대로 실패로 둔다.
    """
    prompt = prompt_of(items)
    schema = {"type": "object", "properties": {field: {
        "type": "array", "items": {"type": "string", "enum": choices}}}, "required": [field]}

    def check(d):
        assert len(d[field]) == len(items), f"{field} {len(d[field])}개, 필요 {len(items)}개"
        assert all(x in choices for x in d[field])

    try:
        return call_with_retry(llm, prompt, schema, check)[field]
    except LLMFailure:
        if len(items) == 1:
            raise
        half = len(items) // 2
        return (_pick_each(llm, items[:half], field, choices, prompt_of)
                + _pick_each(llm, items[half:], field, choices, prompt_of))


def _label_prompt(section_title: str | None, part: list[str]) -> str:
    numbered = "\n".join(f"{i}. {one_line(s)[:600]}" for i, s in enumerate(part))
    return (
        "RFP의 한 절에서 뽑은 문장들이다. "
        "각 문장이 입찰자가 지켜야 할 요구사항(REQUIREMENT)인지, "
        "제출 양식을 채우는 방법에 대한 작성 규칙(WRITING_RULE)인지, "
        "설명(DESCRIPTION)인지 고른다. "
        "문장 수와 같은 개수의 label을 같은 순서로 낸다.\n"
        f"절 제목: {section_title or '(없음)'}\n{numbered}"
    )


def _pick_chunks(llm: LLM, chunks: list[tuple[list[str], Callable[[list[str]], str]]],
                 field: str, choices: list[str], total: int,
                 on_progress: Progress | None) -> list[list[str]]:
    """40줄 묶음들을 동시에 묻는다(NFR-10). 결과는 묶음 순서, 진행은 묶음이 끝날 때마다."""
    done = 0

    def finished(i: int, _labels: list[str]) -> None:
        nonlocal done
        done += len(chunks[i][0])
        if on_progress:
            on_progress(done, total)

    jobs = [lambda part=part, prompt_of=prompt_of: _pick_each(llm, part, field, choices,
                                                              prompt_of)
            for part, prompt_of in chunks]
    return run_ordered(jobs, workers_of(llm), finished)


def label_sections(llm: LLM, sections: list[tuple[str | None, list[str]]],
                   on_progress: Progress | None = None) -> list[list[str]]:
    """절마다 문장에 요구사항 / 작성 규칙 / 설명 중 하나를 붙인다.

    묻는 글은 절 하나의 40줄 묶음 단위(차례로 할 때와 같음)이고,
    모든 절의 묶음을 함께 동시에 보낸다.
    """
    chunks, owner = [], []
    for n, (title, sentences) in enumerate(sections):
        for start in range(0, len(sentences), CHUNK):
            chunks.append((sentences[start:start + CHUNK],
                           lambda part, t=title: _label_prompt(t, part)))
            owner.append(n)
    total = sum(len(s) for _, s in sections)
    answers = _pick_chunks(llm, chunks, "labels", SENTENCE_LABELS, total, on_progress)
    out: list[list[str]] = [[] for _ in sections]
    for n, labels in zip(owner, answers, strict=True):
        out[n].extend(labels)
    return out


def label_sentences(llm: LLM, section_title: str | None, sentences: list[str],
                    on_progress: Progress | None = None) -> list[str]:
    """절 하나의 문장마다 요구사항 / 작성 규칙 / 설명 중 하나를 붙인다."""
    return label_sections(llm, [(section_title, sentences)], on_progress)[0]


def type_unclassified(llm: LLM, texts: list[str],
                      on_progress: Progress | None = None) -> list[str]:

    def prompt_of(part: list[str]) -> str:
        numbered = "\n".join(f"{i}. {one_line(t)[:400]}" for i, t in enumerate(part))
        return (
            "RFP 요구사항마다 유형 하나를 고른다. TECH_PERF=기술 성능, RISK=위험 조건, "
            "STANDARD_CERT=적용 규격·인증, COST=비용 영향, TEST=시험, MAKER_QUAL=제조사 자격, "
            "SITE_ENV=설치 환경, NONE=어느 것도 아님. 같은 순서, 같은 개수로 낸다.\n" + numbered
        )

    chunks = [(texts[start:start + CHUNK], prompt_of) for start in range(0, len(texts), CHUNK)]
    answers = _pick_chunks(llm, chunks, "types", TYPE_CODES, len(texts), on_progress)
    return [code for part in answers for code in part]


NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
RELATIONS = ["DIRECT", "DERIVED", "INFERRED"]


@dataclass(frozen=True)
class Claim:
    """설명 문장 하나와 그 근거: 고른 근거 조각 ID와 그 조각에서 그대로 옮긴 인용."""
    text: str
    quote: str
    evidence_ids: tuple[str, ...]
    relation: str


@dataclass(frozen=True)
class RiskExplanation:
    text: str
    claims: tuple[Claim, ...]


def explain_risk(llm: LLM, kind: str, facts: str,
                 spans: list[EvidenceSpan]) -> RiskExplanation | None:
    """위험 조건 설명을 문장(claim)마다 근거 조각 ID·원문 인용과 함께 받는다.

    코드가 검증해서 하나라도 어긋나면 설명 전체를 버린다 (CR-07):
    없는 근거 ID, 고른 조각에 없는 인용, 사실·근거에 없는 숫자.
    """
    prompt = (
        "입찰 기술 검토 엔지니어에게 이 조항이 왜 위험한지, 또는 두 값이 왜 다를 수 있는지 "
        "한국어 두세 문장으로 설명한다. 아래 근거 조각만 쓰고, 근거에 없는 사실이나 숫자는 "
        "쓰지 않는다. 문장마다 쓴 근거 조각 ID(evidence_ids), 그 조각에서 그대로 옮긴 "
        "짧은 인용(exact_quote), 근거와의 관계(relation: DIRECT 그대로, DERIVED 계산·비교, "
        "INFERRED 추론)를 함께 낸다.\n"
        f"종류: {kind}\n사실:\n{facts}\n근거:\n"
        + "\n".join(f"[{s.evidence_id}] {s.text[:800]}" for s in spans)
    )
    schema = {"type": "object", "properties": {"claims": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "text": {"type": "string"},
            "exact_quote": {"type": "string"},
            "evidence_ids": {"type": "array", "items": {"type": "string"}},
            "relation": {"type": "string", "enum": RELATIONS},
        },
        "required": ["text", "exact_quote", "evidence_ids", "relation"]}}},
        "required": ["claims"]}

    def check(d):
        assert d["claims"]
        for c in d["claims"]:
            assert c["text"].strip() and c["exact_quote"].strip() and c["evidence_ids"]
            assert c["relation"] in RELATIONS

    data = call_with_retry(llm, prompt, schema, check)
    sources = {s.evidence_id: s.text[:800] for s in spans}
    claims = tuple(Claim(c["text"].strip(), c["exact_quote"].strip(), tuple(c["evidence_ids"]),
                         c["relation"]) for c in data["claims"])
    for c in claims:
        if any(i not in sources for i in c.evidence_ids):
            return None                     # 주지 않은 근거를 댔다
        quote = normalize_quote(c.quote)
        if not any(quote in normalize_quote(sources[i]) for i in c.evidence_ids):
            return None                     # 인용이 고른 근거 조각에 없다
    text = "\n".join(c.text for c in claims)
    allowed = {n.replace(",", "") for n in NUMBER.findall(facts + " " + " ".join(sources.values()))}
    if any(n.replace(",", "") not in allowed for n in NUMBER.findall(text)):
        return None
    return RiskExplanation(text, claims)


DRAFT_VERSION = "d1"
COMPETITOR = re.compile(r"경쟁|타사|다른 회사|competitor|other manufacturer", re.IGNORECASE)
_PLACEHOLDER = re.compile(r"\{(\w+)\}")


def draft_sentences(llm: LLM, purpose: str, items: list[tuple[str, dict[str, str]]]) -> list[str]:
    """항목마다 한국어 문장 하나. 숫자는 자리표시자로만 쓰게 하고(CR-07) 채우기·대조는 코드가 한다.

    items: (사실 문장, {자리표시자: 뜻}) 목록.
    자리표시자 밖의 숫자나 경쟁 제품 비교가 있으면 실패로 본다.
    """

    def ask(part: list[tuple[str, dict[str, str]]]) -> list[str]:
        numbered = "\n".join(
            f"{i}. {one_line(facts)} (자리표시자: "
            + ", ".join(f"{{{k}}}={v}" for k, v in marks.items()) + ")"
            for i, (facts, marks) in enumerate(part))
        prompt = (
            f"입찰 기술 검토 엔지니어가 쓸 {purpose} 문장 초안을 "
            "항목마다 한국어 한두 문장으로 쓴다. "
            "숫자와 제품 이름은 직접 쓰지 말고 주어진 자리표시자만 그대로 쓴다. "
            "사실에 없는 내용을 더하지 않고, 경쟁 제품이나 다른 회사와 비교하는 말은 쓰지 않는다. "
            "항목 수와 같은 개수의 문장을 같은 순서로 낸다.\n" + numbered
        )
        schema = {"type": "object", "properties": {"texts": {
            "type": "array", "items": {"type": "string"}}}, "required": ["texts"]}

        def check(d):
            assert len(d["texts"]) == len(part)
            for text, (_, marks) in zip(d["texts"], part, strict=True):
                assert text.strip() and not COMPETITOR.search(text)
                assert set(_PLACEHOLDER.findall(text)) <= set(marks)

        return [t.strip() for t in call_with_retry(llm, prompt, schema, check)["texts"]]

    # 40줄 묶음을 동시에 묻고 묶음 순서대로 잇는다 (NFR-10)
    jobs = [lambda part=items[start:start + CHUNK]: ask(part)
            for start in range(0, len(items), CHUNK)]
    return [t for part in run_ordered(jobs, workers_of(llm)) for t in part]


ASSISTANT_VERSION = "a1"
ASSISTANT_ACTIONS = ["search_requirements", "find_judgments", "get_requirement", "answer"]
JUDGMENT_RESULTS = ["COMPLY", "DEVIATION_CANDIDATE", "QUERY_CANDIDATE", "NEEDS_REVIEW",
                    "WARRANTY_TO_FILL"]


def assistant_step(llm: LLM, question: str, observations: str, can_search: bool) -> dict:
    """검토 도우미 한 단계 (add-review-assistant, FR-17).

    다음에 쓸 읽기 도구와 인자, 또는 답 문장(근거 번호 함께)을 JSON 하나로 받는다.
    도구를 실행하고 답을 검증하는 일은 코드(pipeline/assistant.py)가 한다.
    """
    tools = (
        "도구(읽기만 한다):\n"
        "- search_requirements: 이 검토 요구사항 원문에서 words(문서 언어로, 보통 영어 낱말)가 "
        "모두 들어간 줄. type_code로 유형을 거를 수 있다 "
        f"({', '.join(TYPE_CODES[:-1])}).\n"
        "- find_judgments: 이 검토의 판정. result로 판정 값을 거르고 "
        f"({', '.join(JUDGMENT_RESULTS)}), words로 항목 이름·원문을 거른다.\n"
        "- get_requirement: 근거 번호 하나(ref, 예: R12)의 원문.\n"
        "- answer: 답한다.\n"
    ) if can_search else "더 찾을 수 없다. action은 answer만 쓴다.\n"
    prompt = (
        "너는 입찰 기술 검토 엔지니어를 돕는 검토 도우미다. 값을 바꾸거나 판정하지 않고, "
        "도구가 돌려준 줄만 근거로 한국어로 짧게 답한다. 문장마다 쓴 근거 번호(evidence_ids, "
        "예: R12, J30)를 단다. 근거에 없는 사실이나 숫자는 쓰지 않는다. 근거가 없으면 "
        "sentences를 비운다.\n"
        + tools
        + f"질문: {one_line(question)[:500]}\n"
        + (f"지금까지 찾은 것:\n{observations}\n" if observations else "아직 찾은 것이 없다.\n")
    )
    actions = ASSISTANT_ACTIONS if can_search else ["answer"]
    schema = {"type": "object", "properties": {
        "action": {"type": "string", "enum": actions},
        "words": {"type": "string"},
        "type_code": {"type": "string", "enum": TYPE_CODES[:-1] + [""]},
        "result": {"type": "string", "enum": JUDGMENT_RESULTS + [""]},
        "ref": {"type": "string"},
        "sentences": {"type": "array", "items": {"type": "object", "properties": {
            "text": {"type": "string"},
            "evidence_ids": {"type": "array", "items": {"type": "string"}}},
            "required": ["text", "evidence_ids"]}},
    }, "required": ["action"]}

    def check(d):
        assert d["action"] in actions
        if d["action"] == "answer":
            assert isinstance(d.get("sentences", []), list)

    return call_with_retry(llm, prompt, schema, check)
