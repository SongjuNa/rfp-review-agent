import json
import logging
from dataclasses import astuple, dataclass, replace
from typing import Protocol

log = logging.getLogger(__name__)

MAX_RETRIES = 2                 # CR-12: 정해진 횟수만 재시도
FAILURE_MESSAGE = "처리 실패 — 다시 시도"


class LLMFailure(RuntimeError):
    """재시도 뒤에도 응답을 받지 못함."""


@dataclass
class Usage:
    """언어 모델 사용량 (실행 기록, add-run-log). 실행마다 차이를 저장한다."""
    calls: int = 0              # 요청 수 (재시도 포함)
    retries: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    thinking_tokens: int = 0

    def copy(self) -> "Usage":
        return replace(self)

    def minus(self, before: "Usage") -> "Usage":
        return Usage(*(a - b for a, b in zip(astuple(self), astuple(before), strict=True)))


def usage_of(llm: object) -> Usage | None:
    """사용량을 세는 모델이면 그 Usage (테스트 대역 등은 없을 수 있다)."""
    usage = getattr(llm, "usage", None)
    return usage if isinstance(usage, Usage) else None


class LLM(Protocol):
    model: str

    def generate_json(self, prompt: str, schema: dict) -> dict: ...


def call_with_retry(llm: LLM, prompt: str, schema: dict, validate) -> dict:
    """응답을 검증하고, 실패하면 MAX_RETRIES번 더 시도한다."""
    last: Exception | None = None
    usage = usage_of(llm)
    for attempt in range(MAX_RETRIES + 1):
        if usage:
            usage.calls += 1
            usage.retries += attempt > 0
        try:
            data = llm.generate_json(prompt, schema)
            validate(data)
            return data
        except Exception as exc:  # noqa: BLE001 - 어떤 오류든 재시도 대상
            last = exc
            log.warning("언어 모델 호출 실패 (%d/%d): %s", attempt + 1, MAX_RETRIES + 1, exc)
    raise LLMFailure(FAILURE_MESSAGE) from last


class GeminiLLM:
    def __init__(self, api_key: str, model: str):
        from google import genai

        self.model = model
        self.usage = Usage()
        self._client = genai.Client(api_key=api_key)

    def generate_json(self, prompt: str, schema: dict) -> dict:
        response = self._client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={"response_mime_type": "application/json", "response_schema": schema,
                    "temperature": 0},
        )
        meta = getattr(response, "usage_metadata", None)
        if meta is not None:
            self.usage.input_tokens += meta.prompt_token_count or 0
            self.usage.output_tokens += meta.candidates_token_count or 0
            self.usage.thinking_tokens += getattr(meta, "thoughts_token_count", 0) or 0
        return json.loads(response.text)


def make_llm(api_key: str | None, model: str) -> LLM | None:
    """키가 없으면 None. 그때는 AI 보조 단계를 건너뛰고 코드 규칙만으로 처리한다."""
    return GeminiLLM(api_key, model) if api_key else None
