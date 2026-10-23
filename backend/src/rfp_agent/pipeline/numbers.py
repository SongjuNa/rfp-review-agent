"""CR-07 문장 속 숫자. AI 문장에는 숫자 대신 {v1} 같은 자리표시자를 쓰게 하고, 코드가 근거 값으로
채운 뒤 문장 속 숫자를 근거 값과 다시 대조한다."""

import re
from dataclasses import dataclass

PLACEHOLDER = re.compile(r"\{(\w+)\}")
NUMBER = re.compile(r"\d+(?:,\d{3})*(?:\.\d+)?")


def fmt(num: float | None) -> str:
    """4000 → '4,000', 0.5 → '0.5', 3.0 → '3'."""
    if num is None:
        return ""
    return f"{num:,.6f}".rstrip("0").rstrip(".") if num != int(num) else f"{int(num):,}"


def _plain(number: str) -> str:
    text = number.replace(",", "")
    return text.rstrip("0").rstrip(".") if "." in text else text


def numbers_in(text: str) -> list[str]:
    return [_plain(m.group(0)) for m in NUMBER.finditer(text)]


@dataclass
class Filled:
    text: str
    check: str                  # OK / MISMATCH
    detail: str | None          # 근거에 없는 숫자


def fill(template: str, values: dict[str, str]) -> Filled:
    """자리표시자를 채우고, 채운 문장 속 숫자가 모두 근거 값(values)에 있는지 본다."""
    text = PLACEHOLDER.sub(lambda m: values.get(m.group(1), m.group(0)), template)
    allowed = {n for v in values.values() for n in numbers_in(v)}
    wrong = [n for n in numbers_in(text) if n not in allowed]
    if PLACEHOLDER.search(text):
        wrong += [m.group(0) for m in PLACEHOLDER.finditer(text)]
    if wrong:
        return Filled(text, "MISMATCH", "근거와 다른 숫자: " + ", ".join(dict.fromkeys(wrong)))
    return Filled(text, "OK", None)
