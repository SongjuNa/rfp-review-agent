"""RFP 문서 처리 흐름 (업무 흐름 ①~⑥). 각 단계는 메모리 위의 순수 함수이고, DB 쓰기는 document.py·run.py에서."""

import hashlib
from pathlib import Path

PIPELINE_DIR = Path(__file__).parent


def code_version() -> str:
    """처리 코드(pipeline/*.py) 내용으로 만든 판 번호. 규칙 코드가 바뀌면 문서를 다시 처리한다."""
    digest = hashlib.sha256()
    for path in sorted(PIPELINE_DIR.glob("*.py")):
        digest.update(path.name.encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()[:7]
