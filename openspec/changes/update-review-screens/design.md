# Design

## Context

검토 상세(`views/ReviewDetail.tsx`)는 머리글만 목업대로 바뀌었고 본문은 예전 탭(`Findings`, `Compliance`, `Outputs`, `Approval`)을 `.legacy` 범위 안에서 그대로 쓴다.
목업 Detail 화면의 CSS는 `src/mockup/Detail.css`로 이미 들어와 있다(`usePageCss('Detail')`). 판정 목록 API는 판정 값·설비 묶음으로만 거르고 판정 번호 순으로 준다.

## Decisions

### 1. 화면 하나씩, 묶음 하나씩
- 이 change는 화면이 많아 `tasks.md`의 `## N.` 묶음마다 로컬 브랜치 `feat/update-review-screens-<N>`를 쌓는다. archive는 마지막 묶음에서 한다.
- 묶음 1: 검토 상세 요약 칸·탭 틀 + 판정 탭(SCR-08, SCR-08-1). 다른 탭은 묶음마다 하나씩 목업대로 바꾸고, 그전까지 탭 안에 예전 화면을 둔다.

### 2. 판정 목록 API
- `GET /judgments`에 `type_code`(주 유형), `q`(대소문자 무시, 항목 이름·영문 항목명·원문 표 이름에 들어감), `unconfirmed=true`(review_status = CANDIDATE), `order=priority`를 더한다. 기본값은 지금과 같다.
- 판정 순서는 SQL `CASE result` 순서 + judgment_id. 반려한 판정(review_status REJECTED)은 거르지 않는다(지금도 보임).
- `GET /judgment-counts`: `{by_result: {RESULT: n}, total, unconfirmed, unconfirmed_comply}`. 칩 6개를 요청 한 번으로 채운다.
- 대안: 화면이 판정 값마다 `limit=1`로 5번 불러 X-Total-Count를 읽기 → 요청이 많고 "확정 안 한 줄만"과 함께 쓰면 10번이 된다.

### 3. 화면 구성
- 탭은 화면 안 상태로 고르고 주소는 바꾸지 않는다(SCR-00: `#/reviews/:id`, 탭은 화면 안에서 고름). 처음 탭은 판정.
- 요약 칸 값: 일탈·질의·작성 필요는 `judgment-counts`, 확인 필요 비율은 `approval.review_ratio`(AR-03과 같은 계산), 손실 환산은 `losses` 합(값 없는 줄이 있으면 "—").
- 판정 표 행 값: 항목 = 한글 항목 이름(없으면 영문), 아래 줄 = 영문 항목명. 요구값 = 원문 값 + 단위. 제품값 = 제품 값 + 단위, 아래 줄 = 제품 코드. 원문 위치 = 첫 위치(`locationText`), 더 있으면 "외 n곳".
- 상세 패널의 원문 문장은 `GET /requirements/{id}`의 `text_raw`, 목록 문장은 `GET /outputs`에서 그 판정을 출처로 가진 항목. 판정 바꾸기·확정은 지금 `POST /actions`(judgment EDIT·CONFIRM).
- 판정 표는 한 쪽 10줄(목업), 아래 `Pager`.

### 4. 예시 탭
- 상업 조건, 지난 RFP 비교, 제출본 탭은 `_공통규칙.md` 5장대로 예시 띠 + `src/examples/`의 예시 데이터. 저장 단추를 두지 않는다.

## Risks / Trade-offs

- 검색어 `q`는 ILIKE라 판정이 수천 줄이면 느릴 수 있다. 지금 실행은 판정 수백 줄이라 받아들인다.
- 예전 탭 화면은 묶음마다 하나씩 지우므로 중간 묶음에는 목업 탭 안에 예전 화면이 섞여 보인다.
