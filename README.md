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

처음 설치하는 조원은 **[내 컴퓨터에서 설치하고 실행하기](docs/setup-guide.md)** 를 따라 하세요 (준비물부터 문제 해결까지 쉽게 정리).
이미 설치한 조원이 최신 main을 받아 켤 때는 **[최신 코드 받아서 켜기](docs/pull-and-run.md)** 를 보세요 (포트 충돌 해결 포함).

### Docker Compose (권장)

```bash
cp .env.example .env          # GEMINI_API_KEY 채우기
docker compose up --build     # db, backend(:8000), frontend(:5173)
docker compose exec backend rfp-db seed-products   # 제품표 적재 (처음 한 번)
```

백엔드는 시작할 때 마이그레이션과 규칙 사전 적재를 자동으로 합니다. <http://localhost:5173> 에서 시스템 상태를 볼 수 있습니다.

협조 요청 메일은 함께 뜨는 확인용 메일 서버 Mailpit으로만 갑니다. 보낸 메일은 <http://localhost:8025> 에서 봅니다(밖으로 나가지 않음). 로컬 실행은 `docker compose up mailpit`만 따로 켜고 `.env`의 `RFP_SMTP_*`·`RFP_MAIL_*` 값을 그대로 쓰면 됩니다.

### 로컬

PostgreSQL 16, Python 3.12+, [uv](https://docs.astral.sh/uv/), Node 22가 필요합니다.
스캔 PDF·그림 속 글자를 읽으려면(OCR, add-ocr) Tesseract도 설치합니다: macOS `brew install tesseract tesseract-lang`, Ubuntu `sudo apt-get install tesseract-ocr tesseract-ocr-kor`. 없으면 OCR만 꺼지고 나머지는 그대로 돕니다(`/api/health`의 `ocr_available`).

```bash
cd backend
uv sync
export DATABASE_URL=postgresql://rfp:rfp@localhost:5433/rfp
uv run rfp-db setup                     # migrate + seed-rules + seed-products
uv run uvicorn rfp_agent.api.main:app --reload

cd ../frontend
npm install && npm run dev               # http://localhost:5173
```

화면에서 docx·PDF를 올리거나 서버의 `data/private/rfp_docx` 파일을 골라 검토를 시작합니다. 처리가 끝나면 **담당자 확인** 단계에서 결과(요구사항, 위험 조건, 적합성 판정, 보증값, 손실 환산, 일탈·질의 목록, 제안 포인트)를 확정·수정·반려하고, "담당자 확인 마치기"를 누르면 승인 기준(AR-01·02·03·06·07·08)에 걸릴 때 **승인 대기**가 됩니다. 오른쪽 위 사용자를 "기본 승인자"로 바꾸면 승인·반려할 수 있습니다(로그인 전 임시).

### 테스트

화면 E2E(Playwright)는 백엔드(8000)와 `npm run dev`(5173)를 띄우고 서버에 파일 1 원문이 있을 때 `cd frontend && npm run e2e`로 돌립니다(CI에서는 돌지 않음).


```bash
cd backend
uv run ruff check .
TEST_DATABASE_URL=postgresql://rfp:rfp@localhost:5433/rfp_test uv run pytest
```

`TEST_DATABASE_URL`이 가리키는 DB는 테스트마다 **스키마를 지우고 다시 만듭니다**. 개발 DB와 다른 DB를 쓰세요. 지정하지 않으면 DB 테스트는 건너뜁니다.

테스트는 두 가지입니다. 합성 docx(`tests/docx_factory.py`)로 도는 테스트는 CI에서도 돕니다. 실제 RFP 원문으로 Scenario를 확인하는 `tests/test_corpus.py`는 `data/private/rfp_docx`·`rfp_txt`가 있을 때만 돕니다 (원문은 저장소에 올리지 않음).

## DB 명령

| 명령 | 하는 일 |
|---|---|
| `rfp-db migrate` | `db/migrations/*.sql` 중 아직 적용하지 않은 파일을 순서대로 적용 |
| `rfp-db seed-rules` | 규칙 사전 적재 (항목키·비교 규칙·위험 표현·항목 매핑·파일 번호표·칸 이름·적용 대상·유형 규칙, 고장 사전·해결 사례·요구–고장 연결표, 다시 해도 결과 같음) |
| `rfp-db seed-products` | 제품표 적재 (`data/seed/products/product_master.csv`, 손실값 `trf_spec.csv`는 있으면). 파일에 없는 이전 제품이 남아 있으면 알려 줌 |
| `rfp-db seed-products --replace` | 제품표 바꾸기. 이전 제품·제품군과 **검토 실행 결과를 모두 지우고** 파일 내용만 넣음 (되돌릴 수 없음) |
| `rfp-db setup` | 위 세 개를 차례로 |

스키마를 바꿀 때는 기존 파일을 고치지 말고 다음 번호의 SQL 파일을 추가합니다.

## 검토 실행

```bash
uv run rfp-review run "../data/private/rfp_docx/00지역_문서검토_1. Bidding Forms_Draft_교육용클렌징v6.docx"
uv run rfp-review status 1
```

docx를 읽어 분류 → 절·표 나누기 → 요구사항 추출 → 유형 → 값 정리 → 위험 조건 후보 → 제품 비교 판정 → 보증값 후보 → 손실 환산 → 일탈·질의 목록 초안 → 기술 제안 포인트 후보까지 돌리고 DB에 저장합니다. 판정에는 제품표(`rfp-db seed-products`)가 필요합니다. `GEMINI_API_KEY`가 없으면 AI 보조 단계를 건너뛰고 코드 규칙 결과만 냅니다. 같은 파일·같은 사전 판·같은 코드면 저장된 결과를 다시 씁니다.

API: `POST /api/runs`(docx 올리기), `POST /api/runs/library`(서버의 `data/private/rfp_docx` 파일 이름으로), `GET /api/runs/{id}`, `…/documents`, `…/pairs`, `…/requirements?type_code=&document_id=`, `…/risks`, `…/judgments?result=&group=`, `…/equipment`(설비 묶음별 비교 제품과 후보), `PUT …/equipment/{묶음}/product`(비교 제품 바꿔 보기), `…/warranty`, `…/losses`, `PUT …/losses/{id}`(손실값 고치기, 팀 가정), `…/outputs?list_kind=`, `…/submission-check`, `…/proposals`, 확인·승인 `POST …/actions`(확정·수정·반려·채택·버림), `…/history`, `POST …/finish-review`, `GET·POST …/approval`, `POST …/reopen`, `…/deliverables`(전달 대상: 채택한 제안 포인트만). 자세한 모양은 `/docs`(FastAPI 문서).

## OpenSpec으로 일하기

[OpenSpec](https://github.com/Fission-AI/OpenSpec)으로 스펙을 먼저 쓰고 그 스펙대로 만듭니다. 명세서 v1의 FR은 아래 change에 나뉘어 있습니다.

| 단계 | change | 명세서 | 상태 |
|---|---|---|---|
| 1 | `add-project-foundation` | 저장소·DB·기준 데이터 | 완료 (archive) |
| 2 | `add-document-pipeline` | FR-01~06, CR-02~05·11·12 | 완료 (archive) |
| 3 | `add-judgment-and-outputs` | FR-07·08·09·13·14 | 완료 (archive) |
| 4 | `add-review-approval` | FR-10, 화면 | 완료 (archive) |

```bash
npm i -g @fission-ai/openspec
openspec list                         # 진행 중인 change
openspec show add-document-pipeline   # change 내용
openspec validate --all --strict      # 형식 검사 (CI에서도 돌림)
```

순서는 [AGENTS.md](AGENTS.md)의 "작업 흐름"을 따릅니다. 요약: change 읽기 → `tasks.md` 작업·체크 → 검사 통과 → `openspec archive <change>` → PR.
Claude Code에서는 `/opsx:propose`, `/opsx:apply`, `/opsx:archive` 명령을 쓸 수 있습니다.

공통 규칙(CR-01~12)은 [openspec/config.yaml](openspec/config.yaml)에 있고 모든 change에 적용됩니다.
