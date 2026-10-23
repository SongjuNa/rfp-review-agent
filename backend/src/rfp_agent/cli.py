"""검토 명령: rfp-review run <docx...> | rfp-review status <run_id>"""

import argparse
import sys
from pathlib import Path

from rfp_agent.db.connection import connect
from rfp_agent.pipeline import queries
from rfp_agent.pipeline.service import run_to_end, start_run


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="rfp-review")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="docx 파일로 검토 실행")
    run.add_argument("files", nargs="+", type=Path)
    status = sub.add_parser("status", help="실행 상태와 건수")
    status.add_argument("run_id", type=int)
    args = parser.parse_args(argv)

    if args.command == "run":
        missing = [str(f) for f in args.files if not f.exists()]
        if missing:
            sys.exit(f"파일이 없습니다: {', '.join(missing)}")
        with connect() as conn:
            run_id = start_run(conn)
        print(f"[검토 실행 {run_id}] 시작")
        run_to_end(run_id, [f.resolve() for f in args.files])
        args.run_id = run_id
    with connect() as conn:
        summary = queries.run_summary(conn, args.run_id)
    if summary is None:
        sys.exit(f"검토 실행 {args.run_id}이(가) 없습니다.")
    for key, value in summary.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
