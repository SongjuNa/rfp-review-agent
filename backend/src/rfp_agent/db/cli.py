"""DB 명령: rfp-db migrate | seed-rules [--reset-edits] | seed-products [--replace] | setup
| demo-businesses --business 사업명 a.docx [b.docx ...] (시연용 사업, add-project-status)
| load-answer-key 정답지.csv --name 이름 [--human] (유형 정답지, add-evaluation)"""

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path

from rfp_agent.config import get_settings
from rfp_agent.db.connection import connect
from rfp_agent.db.migrate import migrate
from rfp_agent.db.seed import SeedReport, seed_products, seed_rules

PRODUCT_FILES = ["product_master.csv"]
# 변압기 손실값 (product_code, no_load_loss_kw, load_loss_kw, aux_loss_kw, is_assumed).
# 파일이 없으면 손실 칸은 비워 둔다.
LOSS_FILE = "trf_spec.csv"


def print_report(title: str, report: SeedReport) -> None:
    print(f"[{title}] " + ", ".join(f"{k} {v}" for k, v in report.counts.items()))
    for line in report.skipped:
        print(f"  건너뜀: {line}")


def run_products(conn, replace: bool = False) -> None:
    product_dir = get_settings().seed_dir / "products"
    files = [product_dir / name for name in PRODUCT_FILES]
    missing = [f.name for f in files if not f.exists()]
    if missing:
        sys.exit(f"제품표가 없습니다: {product_dir} 에 {', '.join(missing)} 를 넣어 주세요.")
    loss_file = product_dir / LOSS_FILE
    print_report("제품표", seed_products(conn, files, loss_file if loss_file.exists() else None,
                                             replace))


def demo_businesses(groups: list[list[str]], customer: str | None, due_in: int) -> None:
    """시연용 사업: --business마다 사업 하나를 만들고 파일 하나마다 검토 하나(설비 범위)를 돌린다.

    고객 원문이 아닌 합성 문서(예: 프로젝트 파일 demo-tests/files)를 넣는다.
    키가 없으면 AI 없이 돈다.
    """
    from rfp_agent.pipeline import business, review, review_info
    from rfp_agent.pipeline.service import run_to_end, start_run

    due = date.today() + timedelta(days=due_in)
    for name, *files in groups:
        paths = [Path(f) for f in files]
        missing = [str(p) for p in paths if not p.exists()]
        if not paths or missing:
            sys.exit(f"[{name}] 파일이 없습니다: {', '.join(missing) or '(파일 없음)'}")
        with connect() as conn:
            info = {"due_date": due} | ({"customer_name": customer} if customer else {})
            engineer = review.default_user(conn, "ENGINEER")      # 시작한 사람 = 담당 엔지니어
            business_id = business.create(conn, {"business_name": name, **info}, engineer)
            for path in paths:
                run_id = start_run(conn, engineer)
                review_info.save_on_start(conn, run_id, {"review_name": path.stem, "due_date": due},
                                          engineer)
                business.link(conn, run_id, business_id, engineer)
                stage = run_to_end(run_id, [path])
                print(f"[시연 사업] {name}: 검토 {run_id} {path.name} → {stage}")


def load_answer_key(path: Path, name: str, human: bool) -> None:
    from rfp_agent.pipeline.evaluation import load_key

    if not path.exists():
        sys.exit(f"정답지 파일이 없습니다: {path}")
    with connect() as conn:
        report = load_key(conn, path, name, human)
    who = "사람" if human else "Claude 초안"
    print(f"[정답지] {name} ({who}): {report.rows}줄, 사람 확인 {report.human_checked}줄")
    for line in report.skipped:
        print(f"  건너뜀: {line}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="rfp-db")
    parser.add_argument("command", choices=["migrate", "seed-rules", "seed-products", "setup",
                                            "demo-businesses", "load-answer-key"])
    parser.add_argument("path", nargs="?", help="load-answer-key: 정답지 CSV 파일")
    parser.add_argument("--name", help="load-answer-key: 정답지 이름 (같은 이름이면 줄을 바꿈)")
    parser.add_argument("--human", action="store_true",
                        help="load-answer-key: 사람이 만든 정답지 (주지 않으면 Claude 초안)")
    parser.add_argument("--business", action="append", nargs="+", metavar=("사업명", "DOCX"),
                        help="demo-businesses: 사업명과 docx 파일들 (여러 번 줄 수 있음)")
    parser.add_argument("--customer", help="demo-businesses: 고객사 (주지 않으면 비움)")
    parser.add_argument("--due-in", type=int, default=14,
                        help="demo-businesses: 오늘부터 제출 마감까지 날 수 (기본 14)")
    parser.add_argument("--replace", action="store_true",
                        help="이전 제품과 검토 실행 결과를 지우고 파일 내용만 넣음")
    parser.add_argument("--reset-edits", action="store_true",
                        help="화면에서 고친 규칙을 버리고 사전 파일 내용만 넣음 (이력은 남음)")
    args = parser.parse_args(argv)
    settings = get_settings()
    if args.command == "demo-businesses":
        if not args.business or any(len(g) < 2 for g in args.business):
            parser.error("--business 사업명 a.docx [b.docx ...] 가 필요합니다")
        demo_businesses(args.business, args.customer, args.due_in)
        return
    if args.command == "load-answer-key":
        if not args.path or not args.name:
            parser.error("load-answer-key 정답지.csv --name 이름 이 필요합니다")
        load_answer_key(Path(args.path), args.name, args.human)
        return
    with connect() as conn:
        if args.command in ("migrate", "setup"):
            applied = migrate(conn, settings.migrations_dir)
            print(f"[마이그레이션] 적용 {len(applied)}건 {applied}")
        if args.command in ("seed-rules", "setup"):
            print_report("규칙 사전", seed_rules(conn, settings.seed_dir, args.reset_edits))
        if args.command in ("seed-products", "setup"):
            run_products(conn, args.replace)


if __name__ == "__main__":
    main()
