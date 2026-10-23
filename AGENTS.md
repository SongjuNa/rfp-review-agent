# AGENTS.md

이 저장소에서 일하는 코딩 에이전트(Claude Code, Codex, Cursor 등)와 사람을 위한 작업 지침입니다.
이 저장소는 **OpenSpec 스펙 기반 개발**을 합니다. 스펙에 없는 기능은 만들지 않고, 스펙을 먼저 고칩니다.

## 1. 무엇을 만드나

수백 쪽 RFP(docx)에서 기술 요구사항과 위험 조건을 찾아 우리 제품(product_master)과 비교·판정하고,
일탈·질의 목록, 보증값 후보, 손실 환산, 기술 제안 포인트를 **근거(원문 위치)와 함께** 만드는 시스템입니다.
주 사용자는 입찰 기술 검토 엔지니어입니다. MVP 범위는 명세서 v1의 Must 12개(FR-01~10, 13, 14)이고,
목표는 RFP 1건(파일 1)을 처음부터 끝까지 돌리는 것입니다.

| 읽을 것 | 위치 |
|---|---|
| 원본 요구사항 (FR·CR·AR 번호의 출처) | `docs/reference/기능요구사항명세서_v1.md` |
| 기획 배경, 일정, 역할 | `docs/reference/프로젝트기획서_v1.4.md` |
| 공통 규칙 CR-01~12, 스택, 작성 규칙 | `openspec/config.yaml` |
| 지금 시스템이 하는 일 (확정 스펙) | `openspec/specs/<capability>/spec.md` |
| 앞으로 만들 일 | `openspec/changes/<change>/` |
| DB 스키마 | `db/migrations/*.sql` |

## 2. OpenSpec 구조

```
openspec/
  config.yaml                 공통 맥락·규칙. 모든 change에 적용
  specs/<capability>/spec.md  archive된 현재 스펙 (Requirement + Scenario)
  changes/<change>/
    proposal.md               왜, 무엇을 (관련 FR·사례 번호)
    design.md                 어떻게 (결정과 대안, 위험)
    specs/<capability>/spec.md 이 change가 더하거나 바꾸는 요구사항 (ADDED/MODIFIED/REMOVED)
    tasks.md                  구현 작업 체크리스트
  changes/archive/            끝난 change
```

현재 change와 순서 (앞 change가 archive된 뒤 다음 change를 시작):

| 단계 | change | 내용 |
|---|---|---|
| 1 | `archive/2026-10-23-add-project-foundation` | 저장소·DB·기준 데이터 (완료) |
| 2 | `add-document-pipeline` | FR-01~06 문서 분류 → 구조 → 추출 → 유형 → 값 → 위험 조건 |
| 3 | `add-judgment-and-outputs` | FR-07·08·09·13·14 판정, 보증값, 일탈·질의 목록, 손실 환산, 제안 포인트 |
| 4 | `add-review-approval` | FR-10 확인·승인·이력, 화면 |

## 3. 작업 흐름

### 이미 있는 change를 구현할 때

1. `openspec list`로 change를 확인하고 `openspec show <change>`로 읽는다. proposal → specs → design → tasks 순서.
2. 브랜치를 만든다: `feat/<change>` 또는 작업을 나눴으면 `feat/<change>-<묶음 번호>` (예: `feat/add-document-pipeline-3`).
3. `tasks.md`의 작업을 위에서부터 한다. 끝낸 작업은 바로 `- [x]`로 바꾼다.
4. **Scenario마다 자동 테스트가 하나 이상** 있어야 한다. 테스트 이름이나 docstring에 Scenario 이름을 적는다.
5. 구현하다가 스펙이 틀렸거나 모자라면 코드만 고치지 말고 change의 `specs/`를 먼저 고친다. 결정이 바뀌면 `design.md`에 적는다.
6. 모든 작업이 `[x]`이고 검사가 통과하면 `openspec archive <change> --yes`로 `openspec/specs/`에 반영하고 PR을 올린다.

Claude Code에서는 같은 일을 `/opsx:apply <change>`, `/opsx:archive <change>`로 할 수 있다 (`.claude/skills/openspec-*`).

### 새 기능이나 스펙 변경이 필요할 때

1. `openspec list --specs`로 비슷한 capability가 있는지 본다. 있으면 그 이름을 그대로 쓴다.
2. `openspec new change <동사-명사>` (예: `add-engineering-check`, `update-risk-dictionary`)로 만들고 proposal → specs → design → tasks를 쓴다. Claude Code에서는 `/opsx:propose`.
3. `openspec validate <change> --strict`가 통과하면, 구현 전에 PR이나 팀 확인으로 스펙부터 합의한다.

### 여러 사람이 한 change를 나눌 때

`tasks.md`의 `## N.` 묶음 단위로 나눈다. 묶음 제목 옆에 담당을 적는다 (예: `## 3. FR-02 구조 나누기 (BE 나송주)`).
같은 파일을 여러 브랜치에서 고치지 않도록, 묶음마다 `backend/src/rfp_agent/pipeline/<단계>.py`처럼 파일을 나눈다.
archive는 마지막 묶음을 끝낸 사람이 한다.

## 4. 스펙 쓰는 법

- 요구사항: `### Requirement: <이름>` + `SHALL`/`MUST` 문장(500자 이하, 한 요구사항에 한 가지 동작).
- 시나리오: `#### Scenario: <이름>` (# 네 개) + `- **WHEN** …` / `- **THEN** …`. 요구사항마다 하나 이상.
- 명세서의 수용 기준(Given–When–Then)은 빠짐없이 Scenario로 옮긴다. Given은 WHEN 문장 안에 쓴다.
- 새 capability의 delta 첫 섹션은 `## Purpose`(50자 이상).
- 스펙에는 동작만 쓴다. 클래스 이름, 라이브러리, 구현 순서는 design.md나 tasks.md에 쓴다.
- 명세서의 `[결정]`, `[제안]`, `[확인 필요]` 표시는 요구사항 끝에 남긴다.

## 5. 꼭 지킬 규칙 (명세서 2장 공통 규칙)

- **CR-01** 숫자 계산, 판정, 후보 고르기, 분기 선택은 코드로만 한다. 언어 모델(Gemini)은 문장 읽기·쓰기만 한다.
- **CR-02·03** 결과 값마다 원문 위치(파일 번호 + 절 또는 표 + 행), 신뢰도, 가정 여부를 저장한다. 위치가 없으면 내보내지 않는다.
- **CR-04·05** 없는 값은 비워 두고 "확인 필요". [REDACTED]는 "값 없음". 언어 모델이 빈칸을 채우게 하지 않는다.
- **CR-06** 팀 가정 값이 들어간 결과에는 항상 "팀 가정" 표시.
- **CR-07** 언어 모델이 쓴 문장의 숫자는 자리표시자로 받고 코드가 채운 뒤 근거 값과 대조한다.
- **CR-08** 위험 조건·일탈·질의·보증값·제안 포인트는 모두 "후보". 확정은 사람(FR-10).
- **CR-09** 판정·보증값은 묶음 A·B 문서만. **CR-10** 단위 환산 금지. **CR-11** 같은 입력이면 같은 결과. **CR-12** AI 오류는 정해진 횟수만 재시도.
- 범위 밖(만들지 않음): FR-11·12·15(Should, 별도 change 필요), 가격 계산·할인, OCR, 단위 환산, 경쟁 제품 비교.

## 6. 코드 규칙

- 백엔드: Python 3.12, FastAPI, Pydantic, psycopg 3, LangGraph. 의존성은 `uv add`로 추가하고 `uv.lock`을 커밋한다.
- 프런트: React 19, Vite, TypeScript. `/api`는 Vite 프록시로 백엔드에 연결된다.
- DB: 스키마를 바꾸면 `db/migrations/`에 **다음 번호 파일을 추가**한다. 이미 있는 마이그레이션은 고치지 않는다.
- 데이터: 사전·제품표는 `data/seed/`. 고객사 RFP 원문은 `data/private/`에만 두고 **커밋하지 않는다**. 테스트 픽스처에 원문 문장을 길게 옮기지 않는다(필요한 줄만, 고객사명·연락처·단가는 가림).
- 언어 모델 호출은 한 모듈(예: `rfp_agent/llm/`)에서만 하고, 테스트에서는 가짜 응답으로 바꿀 수 있게 한다. 키는 `GEMINI_API_KEY` 환경 변수로만 받는다.
- 코드 주석과 사용자에게 보이는 문구는 한국어, 식별자는 영어.

## 7. 완료 기준 (PR 올리기 전)

```bash
cd backend && uv run ruff check . && TEST_DATABASE_URL=postgresql://rfp:rfp@localhost:5432/rfp_test uv run pytest
cd frontend && npm run lint && npm run build
openspec validate --all --strict
```

- 구현한 change의 `tasks.md`가 모두 `[x]`이고 archive되어 있다.
- PR 설명에 change 이름, 통과한 Scenario, 남은 `[확인 필요]`를 적는다.
- CI(`.github/workflows/ci.yml`)가 같은 검사를 돌린다.
