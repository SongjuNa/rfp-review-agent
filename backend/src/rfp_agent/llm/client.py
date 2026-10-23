import json
import logging
from typing import Protocol

log = logging.getLogger(__name__)

MAX_RETRIES = 2                 # CR-12: 정해진 횟수만 재시도
FAILURE_MESSAGE = "처리 실패 — 다시 시도"


class LLMFailure(RuntimeError):
    """재시도 뒤에도 응답을 받지 못함."""


class LLM(Protocol):
    model: str

    def generate_json(self, prompt: str, schema: dict) -> dict: ...


def call_with_retry(llm: LLM, prompt: str, schema: dict, validate) -> dict:
    """응답을 검증하고, 실패하면 MAX_RETRIES번 더 시도한다."""
    last: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
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
        self._client = genai.Client(api_key=api_key)

    def generate_json(self, prompt: str, schema: dict) -> dict:
        response = self._client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={"response_mime_type": "application/json", "response_schema": schema,
                    "temperature": 0},
        )
        return json.loads(response.text)


def make_llm(api_key: str | None, model: str) -> LLM | None:
    """키가 없으면 None. 그때는 AI 보조 단계를 건너뛰고 코드 규칙만으로 처리한다."""
    return GeminiLLM(api_key, model) if api_key else None
