# 화면 명세

목업을 바로 코드로 옮기지 않고, 화면마다 **화면 명세(SCR-xx)**를 먼저 쓴 뒤 구현한다.
백엔드가 "요구사항(FR) → 스펙(OpenSpec) → 구현"을 하듯, 프런트는 "목업 → 화면 명세 → 구현"을 한다.
화면 명세의 수용 기준은 구현할 때 OpenSpec change의 `review-workspace` Scenario와 화면 테스트로 옮긴다.

| 파일 | 내용 |
|---|---|
| `README.md` (이 파일) | SCR 번호표, 화면–FR–API 연결표 |
| `_공통규칙.md` | 모든 화면에 같은 것: 화면 상태 4종, 라벨표, 형식, 권한, 예시 화면 규칙 |
| `_템플릿.md` | 화면 명세 하나의 틀 |
| `SCR-xx-<이름>.md` | 화면별 명세 (작성 예정) |

## 기준 목업

- `Spec2Win_목업_v4.57.html` 한 파일에 24개 화면이 들어 있다. 화면은 주소 뒤 화면 키로 연다: `…v4.57.html#Detail`.
- 목업 파일은 `docs/screens/mockup/Spec2Win_목업_v4.57.html`에 둔다(5.5 MB). 브라우저로 열면 오른쪽 아래 "화면 목록"으로 화면을 바꿀 수 있다. 새 판이 오면 같은 폴더에 판 번호를 붙여 더하고, README의 기준 판을 바꾼다.
- 목업은 **레이아웃 기준선**이다. 값 종류(문서 종류, 요구사항 유형, 할 일 상태)와 라벨은 목업이 아니라 API를 따른다(2026-10-28 결정, `_공통규칙.md` 2장).
- 목업과 API의 차이 전체는 갭 목록(공유 폴더 `gap-list/갭목록_목업v4.57_vs_API.md`)에 있다.

## 1. SCR 번호표

구현 방식
- **실제**: 지금 API로 만든다.
- **실제 + 예정**: 일부 칸이 승인된 change(`add-review-info`, `update-approval-flow`)의 API를 기다린다. 그 칸은 change가 archive될 때까지 비워 둔다.
- **일부 예시**: 화면은 실제로 만들되, API가 없는 영역만 예시 데이터로 보여 준다.
- **예시 화면**: 백엔드 없이 목업처럼 예시 데이터로만 보여 준다(2026-10-28 결정: 로그인, 입찰 이력, 팀 공유, 설정). 예시 화면 규칙은 `_공통규칙.md` 5장.

| SCR | 목업 화면 키 | 화면 이름 | 메뉴 | 연결 FR·스펙 | 구현 방식 |
|---|---|---|---|---|---|
| SCR-01 | `Login` | 로그인 | — | 범위 밖 (로그인 없음, 사용자 고르기) | 예시 화면 |
| SCR-02 | `Loading` | 처리 상태 | — | FR-01~06, `review-run` | 실제 |
| SCR-03 | `Home` | 홈 | 홈 | FR-10, FR-11, `review-workspace` 내 할 일 | 실제 + 예정 (검토 정보·마감). 팀 공유·교육 영역은 일부 예시 |
| SCR-04 | `Projects` | 사업 현황 | RFP 관리 | 없음 (사업 단위는 `add-review-info` Non-Goal) | 예시 화면 |
| SCR-05 | `Project` | 사업 상세 | RFP 관리 | 없음 | 예시 화면 |
| SCR-06 | `Main` | 검토 목록 | RFP 관리 | FR-10, `add-review-info` | 실제 + 예정 |
| SCR-07 | `Register` | 검토 등록 | RFP 관리 | FR-01, `add-review-info` | 실제 + 예정. 자동 추출 확인(2단계)은 일부 예시 |
| SCR-08 | `Detail` | 검토 상세 | RFP 관리 | 아래 SCR-08-x | 탭별로 다름 |
| SCR-09 | `Tbe` | TBE 준수표 | 검토 상세 안 | FR-07, FR-09 | 실제 (표시). 엑셀 내려받기는 없음 |
| SCR-10 | `Datasheet` | 데이터시트 채우기 | 검토 상세 안 | FR-08 | 실제 (표시). 엑셀 내려받기·영업에 넘기기는 없음 |
| SCR-11 | `Fail` | 분석 실패 상세 | RFP 관리 | CR-12, `review-run` AI 오류 처리 | 실제 (단계·오류 문장). 재시도 방법 고르기·처리 기록은 일부 예시 |
| SCR-12 | `Wait` | 결재 대기 상세 | RFP 관리 | FR-10, `update-approval-flow` | 실제 + 예정 |
| SCR-13 | `Todo` | 협조 요청 | RFP 관리 | FR-11, `role-assignment` | 실제. 재요청·회신은 없음 |
| SCR-14 | `Bids` | 입찰 이력 | RFP 관리 | 범위 밖 (금액은 가격 범위) | 예시 화면 |
| SCR-15 | `BidView` | 입찰 상세 | RFP 관리 | 범위 밖 | 예시 화면 |
| SCR-16 | `Products` | 제품표 | 지식 관리 | `reference-data`, FR-07 근거, FR-13, FR-15, `add-reference-views` | 실제 + 예정 (읽기 전용, 2026-10-28 결정) |
| SCR-17 | `Rules` | 판정 규칙 | 지식 관리 | `reference-data`, FR-05·06·07 사전, `add-reference-views` | 실제 + 예정 (읽기 전용, 2026-10-28 결정) |
| SCR-18 | `Phrases` | 표준 문구 | 지식 관리 | 없음 (일탈·질의 문장은 FR-09에서 언어 모델이 씀) | 예시 화면 |
| SCR-19 | `Eval` | 정답지·채점 | 지식 관리 | K1~K12 (정답지·채점기, 남은 작업) | 예시 화면 |
| SCR-20 | `Team` | 팀 현황 | 팀 공유 | 범위 밖 | 예시 화면 |
| SCR-21 | `Notice` | 공지사항 | 팀 공유 | 범위 밖 | 예시 화면 |
| SCR-22 | `SysNotice` | 시스템 공지 | 팀 공유 | 범위 밖 | 예시 화면 |
| SCR-23 | `Files` | 자료실 | 팀 공유 | 범위 밖 | 예시 화면 |
| SCR-24 | `Settings` | 설정 | 설정 | 범위 밖 | 예시 화면 |

### SCR-08 검토 상세의 탭

검토 상세는 머리글(검토 정보·요약 칸)과 탭 9개, 창 3개로 되어 있어 탭마다 명세를 나눈다. 머리글은 SCR-08 본문에 쓴다.

| SCR | 탭·창 | 연결 FR·스펙 | 구현 방식 |
|---|---|---|---|
| SCR-08 | 머리글, 요약 칸 | FR-07·09·13, `add-review-info` | 실제 + 예정 |
| SCR-08-1 | 판정 (표 + 오른쪽 판정 상세) | FR-07, FR-08, FR-10, FR-12 | 실제. 번역·질의 보냄 표시는 없음 |
| SCR-08-2 | 문서 읽기 점검 | FR-01·02 (읽지 못한 곳) | 일부 예시 (문서 단위 `readable`·`needs_review`만 실제) |
| SCR-08-3 | 위험 조건 | FR-06 | 실제. "사전에 추가 제안"은 예시 |
| SCR-08-4 | 손실 환산 (참고) | FR-13 | 실제 |
| SCR-08-5 | 입찰 영향 | FR-14, FR-15, FR-09 | 실제 |
| SCR-08-6 | 상업 조건 | 없음 (C1 비용 조건 요약 아이디어) | 예시 화면 |
| SCR-08-7 | 지난 RFP 비교 | 없음 | 예시 화면 |
| SCR-08-8 | 제출본 | 없음 | 예시 화면 |
| SCR-08-9 | 이력 | FR-10 수정 이력 | 실제 |
| SCR-08-10 | 결재 상신 창 | FR-10, `update-approval-flow` | 실제 + 예정 |
| SCR-08-11 | 일탈 목록 초안 · 질의서 초안 창 | FR-09 | 실제 (표시). docx 내려받기는 없음 |

## 2. 화면–FR–API 연결표

"예정"은 승인된 change에서 생길 API, "없음"은 아직 어떤 change에도 없는 것이다. 응답 칸 이름은 `frontend/src/api.ts` 타입을 따른다.

| SCR | 지금 있는 API | 예정 API | 없음 (예시 데이터 또는 빼기) |
|---|---|---|---|
| SCR-02 | `GET /runs/{id}` (`stage`, `step`) | — | 진행률 %, 남은 시간 |
| SCR-03 | `GET /tasks?user_id=`, `GET /runs` | 검토 정보·마감 (`add-review-info`), 승인자에게 온 검토만 (`update-approval-flow`) | 판정 기준 변경 영향, 팀 업무, 교육·행사 |
| SCR-06 | `GET /runs` | 검토 번호·검토 정보·개수·담당 (`add-review-info`) | 같은 입찰 묶기 |
| SCR-07 | `POST /runs`, `GET /library`, `POST /runs/library` | 검토 정보 입력 칸 (`add-review-info`) | 문서 종류 미리 확인, 자동 추출, Lot 나누기, 사업 연결 |
| SCR-08 | `GET /runs/{id}`, `/documents`, `/equipment`, `/losses`, `/approval`(preview) | 검토 정보 고치기 `PUT /runs/{id}/info` | 문서 추가, 상신 권장일 |
| SCR-08-1 | `GET /judgments`, `/requirements/{id}`, `/checks`, `/risks`, `/outputs`, `/history`, `POST /actions`, `PUT /equipment/{group}/product` | 전체 개수 `X-Total-Count` | 번역, 질의 보냄 상태, 한꺼번에 확정 |
| SCR-08-2 | `GET /documents` | — | 점검 항목 목록, "직접 확인함" |
| SCR-08-3 | `GET /risks`, `POST /actions` | — | 사전 추가 제안 |
| SCR-08-4 | `GET /losses`, `PUT /losses/{id}` | — | 직접 협조 요청 |
| SCR-08-5 | `GET /proposals`, `GET /outputs`, `POST /actions` | — | — |
| SCR-08-9 | `GET /history` | — | 시스템 처리 기록 |
| SCR-08-10 | `GET /approval`, `GET /submission-check`, `GET /users` | 결재자·상신 의견 `POST /finish-review` (`update-approval-flow`) | 참조자, 첨부 |
| SCR-08-11 | `GET /outputs` | — | docx 내려받기 |
| SCR-09 | `GET /judgments`, `/documents` | — | 엑셀 내려받기, 제출본 기준 |
| SCR-10 | `GET /warranty`, `/judgments` | 전체 개수 | 성적서 근거, 중복 칸, 엑셀, 영업에 넘기기 |
| SCR-11 | `GET /runs/{id}` (`failed_step`, `error_message`), `/documents` | — | 멈춘 위치·원문, 이어서 재시도, 처리 기록 |
| SCR-12 | `GET /approval`, `POST /approval`, `/outputs`, `/risks`, `/history` | 상신 정보·상신 취소 `POST /withdraw` (`update-approval-flow`) | 열람 시각, 다시 알림, 전자결재 번호 |
| SCR-13 | `GET /tasks`, `PUT /assignments/{id}`, `GET /runs/{id}/assignments` | — | 재요청, 직접 요청, 회신, 내보내기 |
| SCR-16 | — | `GET /products`, `GET /products/{code}` (`add-reference-views`) | 엑셀 가져오기, 요구 조건으로 찾기, 고치기 |
| SCR-17 | — | `GET /rules/compare`, `/rules/items`, `/rules/risk-expressions` (`add-reference-views`) | 단위 사전, 수정 요청, 규칙 추가, 수정자·수정일 |
| 그 밖 (예시 화면) | — | — | 화면 전체 |
