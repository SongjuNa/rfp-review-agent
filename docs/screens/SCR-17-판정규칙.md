# 화면 명세: SCR-17 판정 규칙

- 연결 요구사항: `reference-data` 규칙 사전 조회·문서 종류 규칙 조회, FR-01 문서 종류, FR-05 항목 이름, FR-06 위험 표현, FR-07 비교 방향
- 기준 목업: `Spec2Win_목업_v4.57.html#Rules`
- 구현 방식: 실제, 읽기 전용 (`add-reference-views`). 위 "사람이 제안한 표현"은 예시. 화면 CSS는 목업 Rules CSS 그대로(`frontend/src/mockup/Rules.css`)
- 사용 API: `GET /rules/compare`, `GET /rules/items`, `GET /rules/risk-expressions`, `GET /rules/doc-kinds` (`update-doc-kind-rules`)
- 예정 API: 수정 요청, 규칙 추가, 수정 이력

## 화면 구성

| 영역 | 보이는 항목 | API 칸 | 비고 |
|---|---|---|---|
| 제목(`.ttl`) | 판정 규칙, 수정 요청, 규칙 추가 | — | 둘 다 잠김 |
| 사람이 제안한 표현(`.rkp`) | 예시 띠, 날짜 · 표현 · 제안한 사람 · 상태, 정답지·채점 연결 | — | 예시. 제안 흐름은 만들지 않는다 |
| 규칙 종류 탭(`.rtabs`) | 비교 방향 · 위험 표현 · 항목 이름 · 문서 종류 (줄 수) | 각 목록 길이 | 탭을 바꾸면 검색·펼침·쪽을 처음으로 |
| 머리 줄(`.rhead`) | 마지막 수정(기록 없음), 지금 판정에 쓰임 n회 (문서 종류 탭은 "규칙이 분류한 문서 n개") | `used` 합 | |
| 검색(`.filters`) | 규칙 검색, 검색 지우기 | — | 화면 안에서 거름(이름·키·표·방향·원문 표기) |
| 비교 방향 표 | 항목, 표 · 번호, 방향, 시간 조건, 강점 방향, 쓴 판정 | `name_ko`, `table_name`, `item_no`, `direction`, `time_condition`, `strength_direction`, `used` | 강점 방향이 비면 항목 기본값(판정과 같음). 문장 읽기 방향은 주황 |
| 위험 표현 표 | 표현(원문), 위험 종류, 언어, 위험으로 보는 조건, 쓴 횟수 | `expression`, `risk_kind`, `language`, `context_rule`, `used` | 쓴 횟수 = 그 표현으로 찾은 위험 조건 후보 수. 조건 미정은 주황 |
| 항목 이름 표 | 표준 항목, RFP에 나오는 표기, 제품표 칸, 기본 방향, 쓴 판정 | `name_ko`, `aliases`, `pm_column`/`fixed_key`, `default_direction`, `used` | |
| 문서 종류 표 | 문서 종류, 파일 이름에서 찾는 표현, 첫 장에서 찾는 표현(없으면 "파일 이름만 봄"), 순서, 분류한 문서 | `doc_kind`, `name_pattern`, `page_pattern`, `priority`, `used` | 표현은 정규식. 펼치면 메모와 찾는 순서 설명. 분류한 문서 = 규칙이 그 종류로 정한 문서 수(AI·사람 제외) |
| 펼친 줄(`.rx`) | 이 규칙의 내용, 수정 이력 | 처리 메모·키·강점 방향 | 수정 이력은 저장하지 않는다는 안내 |
| 쪽 나눔 | 10·20·50개씩 | — | |

## 수용 기준 (Given / When / Then)

- **Given** 판정 규칙 화면, **When** 비교 방향 탭에서 "정격 전류"를 검색하면, **Then** 정격 전류 줄만 남고, 줄을 펼치면 표준 항목 rated_current. 없는 이름이면 "조건에 맞는 규칙이 없습니다." (규칙 검색)
- **Given** 위험 표현 탭, **When** "including"을 검색하면, **Then** "including but not limited to" 줄과 쓴 횟수. (위험 표현이 쓰인 횟수)
- **Given** 판정 규칙 화면, **When** 문서 종류 탭에서 "bidding"을 검색하면, **Then** 입찰 양식 줄만 파일 이름 표현·첫 장 표현·순서·분류한 문서 수와 함께 보이고 규칙 추가는 잠김. (문서 종류 규칙 탭)
