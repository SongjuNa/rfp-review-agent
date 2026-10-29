"""분석 전 문서 분류 추천 (등록 화면). 규칙만 쓰고 아무것도 저장하지 않는다 (CR-01)."""

from pathlib import Path

import psycopg

from rfp_agent.pipeline import classify as cls
from rfp_agent.pipeline.docx_reader import read_blocks


class UnreadableFile(Exception):
    """docx로 열리지 않는 파일 (빈 파일, 이름만 docx 등)."""


def _catalog(conn: psycopg.Connection) -> list[cls.CatalogEntry]:
    return [cls.CatalogEntry(*r) for r in conn.execute(
        "SELECT file_no, file_key, bundle, language, project_key FROM document_catalog")]


def preview(conn: psycopg.Connection, paths: list[Path]) -> list[dict]:
    catalog = _catalog(conn)
    out = []
    for path in paths:
        try:
            blocks = read_blocks(path)
        except Exception as exc:          # python-docx는 여러 종류의 예외를 낸다
            raise UnreadableFile(path.name) from exc
        c = cls.classify(path.name, blocks, catalog)
        in_catalog = c.file_no is not None
        bundle, reason = cls.suggest_bundle(c, in_catalog)
        out.append(dict(
            file_name=path.name, in_catalog=in_catalog, file_no=c.file_no, doc_kind=c.doc_kind,
            bundle=bundle, language=c.language, standard_system=c.standard_system,
            readable=c.readable, judge_target=bundle in ("A", "B") and c.readable,
            needs_review=c.doc_kind == "UNKNOWN", reason=reason))
    return out
