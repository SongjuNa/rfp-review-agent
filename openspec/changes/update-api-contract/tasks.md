# Tasks

## 1. 준비

- [ ] 1.1 `api/schemas.py`에 `Location` 모델(파일 번호 필수, 절·표·항목·행은 빈 값 허용)
- [ ] 1.2 칸 대조 테스트 도구: 합성 문서 실행으로 API 응답 dict의 칸이 응답 모델 칸에 모두 있는지 검사 (design.md 위험 2)
- [ ] 1.3 응답 검사 오류 처리기: 500과 함께 API 경로·틀린 칸 이름을 로그에 남김(값은 남기지 않음)
- [ ] 1.4 `rfp-openapi` 명령(DB 없이 `/openapi.json` 출력), `frontend`에 `openapi-typescript` 개발 의존성과 `npm run gen:api`

## 2. 근거 API 응답 모델 (먼저)

- [ ] 2.1 판정 목록·판정 건수 (`/runs/{id}/judgments`, `/judgment-counts`), 결과 값 `Literal`, `locations` 하나 이상
- [ ] 2.2 요구사항 목록·하나 (`/runs/{id}/requirements`, `/requirements/{id}`), `req_kind` 포함. 이 응답은 위치 없는 줄도 허용(문서 읽기 점검)
- [ ] 2.3 위험 조건 (`/runs/{id}/risks`), 구성원마다 위치
- [ ] 2.4 일탈·질의 항목 (`/runs/{id}/outputs`), `list_kind`·`number_check` `Literal`
- [ ] 2.5 보증값 후보, 손실 환산, 공학 검산, 제안 포인트 (`/warranty`, `/losses`, `/checks`, `/proposals`)
- [ ] 2.6 TBE 준수표·데이터시트 미리보기 (`/tbe`, `/datasheet`, `/datasheets`)

## 3. 나머지 조회 API 응답 모델

- [ ] 3.1 실행 목록·요약·문서·문서 쌍·설비 묶음 (`/runs`, `/runs/{id}`, `/documents`, `/pairs`, `/equipment`)
- [ ] 3.2 검토 흐름 (`/history`, `/approval`, `/read-checks`, `/deliverables`, `/submission-check`)
- [ ] 3.3 할 일·담당 (`/tasks`, `/assignments`, `/runs/{id}/assignments`), 사용자·서버 RFP 목록 (`/users`, `/library`)
- [ ] 3.4 기준 데이터 6개 (`api/reference.py`)
- [ ] 3.5 파일 내려받기 API 3개(일탈·질의 Word, TBE·데이터시트 엑셀)는 `responses=`로 파일 형식만 밝힘

## 4. 쓰기 API 응답 모델

- [ ] 4.1 POST·PUT 15개의 응답(확정·고치기·결재·제품 바꾸기·손실값·검토 정보 등)

## 5. 화면 타입을 만든 타입으로

- [ ] 5.1 `openapi.json`·`src/api.gen.ts` 만들고 커밋
- [ ] 5.2 `api.ts`의 응답 타입을 `components['schemas'][…]` 다시 내보내기로 바꿈(화면 import는 그대로)
- [ ] 5.3 어긋난 칸 고치기(`Requirement.file_name` 등). 화면이 쓰던 칸이 서버에 없으면 화면을 고치고, 서버에 있어야 할 칸이면 조회를 고치지 않고 [확인 필요]로 남김

## 6. CI

- [ ] 6.1 `ci.yml` frontend 작업에 스키마 → 타입 다시 만들기 → `git diff --exit-code` 단계

## 7. 테스트 (Scenario마다 하나 이상, 이름에 Scenario 이름)

- [ ] 7.1 판정 목록의 응답 모양 / 파일 내려받기 API
- [ ] 7.2 정해진 값 밖의 판정 결과 / 비어 있는 값
- [ ] 7.3 위치가 없는 판정 / 팀 가정 표시가 함께 감
- [ ] 7.4 서버 칸을 바꾸고 타입을 다시 만들지 않음 / 화면이 없는 칸을 씀
- [ ] 7.5 기존 pytest·e2e 전부 통과, 판정 500줄 응답 시간 한 번 재서 design.md에 적기
