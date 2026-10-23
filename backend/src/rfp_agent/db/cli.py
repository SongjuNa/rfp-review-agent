"""DB 명령: rfp-db migrate | seed-rules | seed-products | setup"""

import argparse
import sys

from rfp_agent.config import get_settings
from rfp_agent.db.connection import connect
from rfp_agent.db.migrate import migrate
from rfp_agent.db.seed import SeedReport, seed_products, seed_rules

PRODUCT_FILES = ["product_master_입력용.csv", "product_master_TRF_v2.csv"]
LOSS_FILE = "trf_spec_v2.csv"


def print_report(title: str, report: SeedReport) -> None:
    print(f"[{title}] " + ", ".join(f"{k} {v}" for k, v in report.counts.items()))
    for line in report.skipped:
        print(f"  건너뜀: {line}")


def run_products(conn) -> None:
    product_dir = get_settings().seed_dir / "products"
    files = [product_dir / name for name in PRODUCT_FILES]
    missing = [f.name for f in files if not f.exists()]
    if missing:
        sys.exit(f"제품표가 없습니다: {product_dir} 에 {', '.join(missing)} 를 넣어 주세요.")
    loss_file = product_dir / LOSS_FILE
    print_report("제품표", seed_products(conn, files, loss_file if loss_file.exists() else None))


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="rfp-db")
    parser.add_argument("command", choices=["migrate", "seed-rules", "seed-products", "setup"])
    args = parser.parse_args(argv)
    settings = get_settings()
    with connect() as conn:
        if args.command in ("migrate", "setup"):
            applied = migrate(conn, settings.migrations_dir)
            print(f"[마이그레이션] 적용 {len(applied)}건 {applied}")
        if args.command in ("seed-rules", "setup"):
            print_report("규칙 사전", seed_rules(conn, settings.seed_dir))
        if args.command in ("seed-products", "setup"):
            run_products(conn)


if __name__ == "__main__":
    main()
