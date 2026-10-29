# Design

## Context

- 응답은 `pipeline/queries.py` 같은 조회 함수가 만든 dict다. API 함수는 `-> dict`, `-> list[dict]`로 그대로 돌려준다(`api/runs.py` 45개, `api/reference.py` 6개). 응답 모델은 `api/main.py`의 `Health` 하나다.
- 원문 위치는 조회 함수가 붙인다. 판정·보증값·손실·검산·일탈·질의·제안 포인트는 `_with_locations` 또는 같은 거르기로 위치 없는 줄을 뺀다(CR-02). 요구사항 목록(문서 읽기 점검)은 위치 없는 줄도 보여 준다.
- 목록 API는 전체 개수를 `X-Total-Count` 머리글로 보낸다(`add-review-info`).
- 화면 타입 42개는 `frontend/src/api.ts`에 손으로 썼다. `call<T>`가 JSON을 검사 없이 `T`로 믿는다.
- 이미 어긋난 곳(조사, 2026-10-29): `Requirement.file_name`은 API가 보내지 않고, API의 `req_kind`·`rule_id`·`supplier_mark`·`dedup_of`는 화면 타입에 없다. 값의 `cell_form`·`operator` 등도 같다. 구현 중 전수 비교로 더 찾는다.

## Decisions

### 1. 응답 모델은 `api/schemas.py` 한 파일
- Pydantic `BaseModel`. 이름은 화면 타입 이름과 같게 한다(`Location`, `Requirement`, `Judgment`, `Risk`, `OutputItem` …). 생성된 타입 이름이 그대로 화면에서 쓰이게 하려는 것이다.
- 각 API 장식자에 `response_model=`을 붙인다. 함수의 반환 타입 표기는 `list[Judgment]`처럼 바꾼다.
- 조회 함수(`pipeline/queries.py`)는 계속 dict를 돌려준다. FastAPI가 응답 모델로 검사·직렬화한다. 조회 코드를 고치지 않아 결과 값이 바뀌지 않는다.
- 대안: 조회 함수가 모델 객체를 돌려줌 → 파이프라인 코드까지 고쳐야 하고 CLI(`rfp-review`)도 영향을 받는다. 지금은 API 경계에서만 한다.

### 2. 칸 규칙
- DB에서 NULL이 될 수 있는 칸은 `X | None`, 아닌 칸은 필수. NOT NULL 여부는 `db/migrations/`를 기준으로 한다.
- DB의 CHECK로 정해진 값은 `Literal`로 쓴다. 예: 판정 `result`는 `COMPLY`·`DEVIATION_CANDIDATE`·`QUERY_CANDIDATE`·`NEEDS_REVIEW`·`WARRANTY_TO_FILL`(`0001_schema_v1.sql`), 일탈·질의 `list_kind`는 `DEVIATION`·`QUERY`, 숫자 대조 `number_check`는 `OK`·`MISMATCH`.
- 근거 응답(spec "근거 응답의 원문 위치")의 `locations`는 `list[Location]`에 `min_length=1`. `Location.file_no`는 필수, 나머지 위치 칸은 빈 값 허용(절·표·행 중 있는 것만 있음).
- 기본값을 넣지 않는다. 빈 값은 `None` 그대로 보낸다(CR-04). 모델에 `default=0` 같은 값을 두지 않는다.
- `model_config = ConfigDict(extra="ignore")`(기본값). 모델에 없는 칸은 응답에서 빠진다. 그래서 묶음 1에서 "바꾸기 전 응답 칸 ⊆ 모델 칸" 검사를 먼저 만든다(위험 2).

### 3. 모양이 틀린 응답
- FastAPI는 응답 검사에 실패하면 `ResponseValidationError`로 500을 낸다. 이것을 그대로 쓰고, 오류 처리기에서 API 경로와 틀린 칸 이름을 로그에 남긴다(값은 남기지 않음: 원문 문장이 로그에 들어가지 않게).
- 틀린 줄만 빼고 나머지를 보내는 방식은 쓰지 않는다. 빠진 줄을 사람이 알아채지 못해 "조용히 빠짐"이 다시 생긴다.

### 4. 화면 타입 만들기
- `uv run rfp-openapi > frontend/openapi.json`(새 CLI 진입점, `api/main.py`의 `app.openapi()`를 출력) → `npx openapi-typescript openapi.json -o src/api.gen.ts`.
- `api.ts`는 `export type Judgment = components['schemas']['Judgment']`처럼 만든 타입을 다시 내보낸다. 화면 코드의 import는 바꾸지 않는다.
- 화면만 쓰는 타입(`JudgmentQuery`, `TbeQuery`, `StartInfo`, `Page<T>`)은 손으로 둔다.
- `openapi.json`과 `api.gen.ts`는 커밋한다. 리뷰에서 응답 모양 변화가 diff로 보이게 하려는 것이다.
- 대안: `pydantic-to-typescript` → 파이썬과 노드를 함께 써야 하고 FastAPI 경로(요청·응답 쌍)를 모른다. 대안: 화면 타입을 계속 손으로 쓰고 테스트로 대조 → 대조 테스트를 또 손으로 맞춰야 한다.

### 5. CI
- `frontend` 작업에 `rfp-openapi` → `openapi-typescript` → `git diff --exit-code frontend/openapi.json frontend/src/api.gen.ts` 단계를 더한다. 그 뒤 `npm run build`(tsc)가 없는 칸을 쓰는 화면 코드를 잡는다.
- `rfp-openapi`는 DB 없이 돈다(앱 객체만 만듦).

### 6. 순서
- 묶음 2(근거 API)를 먼저 끝내고 화면 타입 생성(묶음 5)을 그 API들부터 바꾼다. 묶음 3·4는 같은 방식으로 이어서 한다. 묶음 2만 끝나도 근거 응답 보장은 된다.

## Risks / Trade-offs

1. **지금 DB 값이 모델과 맞지 않음.** 필수로 정한 칸에 NULL이 있으면 그 API가 500을 낸다. → 기존 pytest(합성 문서 실행)와 e2e를 돌려 찾는다. 찾으면 DB 제약을 보고, 정말 빈 값이 나올 수 있는 칸이면 `| None`으로 바꾸고 design.md에 적는다.
2. **칸이 조용히 빠짐.** 모델에 적지 않은 칸은 응답에서 사라져 화면이 빈칸을 보인다. → 묶음 1의 칸 대조 테스트: 합성 실행으로 바꾸기 전 dict의 칸이 모두 모델에 있는지 검사한다.
3. **속도.** 판정 500줄을 모델로 검사하는 시간. Pydantic v2라 수 ms 수준으로 본다(추정). 구현 후 한 번 잰다.
4. **같은 입력 같은 결과(CR-11).** 직렬화 순서가 바뀌지 않게 리스트 순서는 조회 함수 그대로 둔다. 숫자 칸(`NUMERIC`)은 지금처럼 `float`로 보낸다. `Decimal`로 바꾸지 않는다.
