# RFP 기술 검토 지원 AI

수백 쪽 RFP에서 **지킬 조건은 빠짐없이, 내세울 강점은 근거와 함께** 찾아 주는 기술 검토 AI입니다.
SKKU × LS AI CAMPUS 1기 2조, 주제 2.

- 기능 요구사항: [docs/reference/기능요구사항명세서_v1.md](docs/reference/기능요구사항명세서_v1.md)
- 기획서: [docs/reference/프로젝트기획서_v1.4.md](docs/reference/프로젝트기획서_v1.4.md)
- 스펙과 진행 중인 작업: [openspec/](openspec/) (아래 "OpenSpec으로 일하기")

## 폴더

| 경로 | 내용 | 주 담당 |
|---|---|---|
| `backend/` | FastAPI, 처리 흐름(LangGraph), DB 명령 `rfp-db` | BE · AI |
| `frontend/` | React · Vite · TypeScript 화면 | FE |
| `db/migrations/` | 번호 순서로 적용하는 SQL (`0001_schema_v1.sql` = 스키마 초안 v1) | DB |
| `data/seed/` | 규칙 사전 4종, 제품표 (`products/`) | DB |
| `data/private/` | RFP 원본 docx. **git 제외** ([README](data/private/README.md)) | — |
| `openspec/specs/` | 지금 시스템이 하는 일 (archive된 스펙) | 모두 |
| `openspec/changes/` | 만들 일 (단계별 change) | 모두 |

## 실행

### Docker Compose (권장)

```bash
cp .env.example .env          # GEMINI_API_KEY 채우기
docker compose up --build     # db, backend(:8000), frontend(:5173)
docker compose exec backend rfp-db seed-products   # 제품표 적재 (처음 한 번)
```

백엔드는 시작할 때 마이그레이션과 규칙 사전 적재를 자동으로 합니다. <http://localhost:5173> 에서 시스템 상태를 볼 수 있습니다.

### 로컬

PostgreSQL 16, Python 3.12+, [uv](https://docs.astral.sh/uv/), Node 22가 필요합니다.

```bash
cd backend
uv sync
export DATABASE_URL=postgresql://rfp:rfp@localhost:5432/rfp
uv run rfp-db setup                     # migrate + seed-rules + seed-products
uv run uvicorn rfp_agent.api.main:app --reload

cd ../frontend
npm install && npm run dev
```

### 테스트

```bash
cd backend
uv run ruff check .
TEST_DATABASE_URL=postgresql://rfp:rfp@localhost:5432/rfp_test uv run pytest
```

`TEST_DATABASE_URL`이 가리키는 DB는 테스트마다 **스키마를 지우고 다시 만듭니다**. 개발 DB와 다른 DB를 쓰세요. 지정하지 않으면 DB 테스트는 건너뜁니다.

## DB 명령

| 명령 | 하는 일 |
|---|---|
| `rfp-db migrate` | `db/migrations/*.sql` 중 아직 적용하지 않은 파일을 순서대로 적용 |
| `rfp-db seed-rules` | 규칙 사전 4종 적재 (다시 해도 결과 같음) |
| `rfp-db seed-products` | 제품표 적재. `product_master_TRF_v2.csv`가 입력용의 같은 코드를 덮어씀 |
| `rfp-db setup` | 위 세 개를 차례로 |

스키마를 바꿀 때는 기존 파일을 고치지 말고 다음 번호의 SQL 파일을 추가합니다.

## OpenSpec으로 일하기

[OpenSpec](https://github.com/Fission-AI/OpenSpec)으로 스펙을 먼저 쓰고 그 스펙대로 만듭니다. 명세서 v1의 FR은 아래 change에 나뉘어 있습니다.

| 단계 | change | 명세서 | 상태 |
|---|---|---|---|
| 1 | `add-project-foundation` | 저장소·DB·기준 데이터 | 완료 (archive) |
| 2 | `add-document-pipeline` | FR-01~06, CR-02~05·11·12 | 할 일 |
| 3 | `add-judgment-and-outputs` | FR-07·08·09·13·14 | 할 일 |
| 4 | `add-review-approval` | FR-10, 화면 | 할 일 |

```bash
npm i -g @fission-ai/openspec
openspec list                         # 진행 중인 change
openspec show add-document-pipeline   # change 내용
openspec validate --all --strict      # 형식 검사 (CI에서도 돌림)
```

순서는 [AGENTS.md](AGENTS.md)의 "작업 흐름"을 따릅니다. 요약: change 읽기 → `tasks.md` 작업·체크 → 검사 통과 → `openspec archive <change>` → PR.
Claude Code에서는 `/opsx:propose`, `/opsx:apply`, `/opsx:archive` 명령을 쓸 수 있습니다.

공통 규칙(CR-01~12)은 [openspec/config.yaml](openspec/config.yaml)에 있고 모든 change에 적용됩니다.
