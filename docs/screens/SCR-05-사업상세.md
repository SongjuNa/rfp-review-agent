# 화면 명세: SCR-05 사업 상세

- 연결 요구사항: `review-workspace` 사업 상세 화면, `business-status` 사업 상세·제출 완료 표시·사업 정보 고침 이력 (`add-project-status`)
- 기준 목업: `Spec2Win_목업_v4.57.html#Project`
- 구현 방식: 실제 (지난 이력 탭만 예시). 화면은 `frontend/src/views/Project.tsx`, 고치기 창은 `BusinessDialog.tsx`, CSS는 목업 Project CSS 그대로
- 화면 주소: `#/projects/<사업 번호>` (예: `#/projects/PJ-2026-003`). 번호 끝의 숫자가 사업 id
- 사용 API: `GET /api/businesses/{id}?user_id=`, `PUT /api/businesses/{id}`, `POST`·`DELETE /api/businesses/{id}/submitted`, `GET /api/users`

## 화면 구성

| 영역 | 보이는 항목 | 데이터 칸 | 비고 |
|---|---|---|---|
| 머리(`.pd-top`, `.ttl`) | 사업 번호, 고객 입찰 번호, 진행 중/제출 완료, 사업명, 사업 목록, 사업 정보 고치기, 제출 완료로 표시(또는 취소), 이 사업에 RFP 등록 | `business_no`, `tender_no`, `submitted_at`, `business_name` | 제출 완료 단추는 연결 검토가 모두 승인되어야 켜진다 |
| 사업 정보(`.pd-info`) | 사업명, 고객사 · 국가, 발주 방식, 제출 마감, 다음 일정, 내 역할 | `customer_name`, `country`, `order_mode`, `due_date`, `schedule`, `my_role` | 사업 마감이 비면 "(검토 마감)" |
| 개요 탭 | 범위 카드: 범위 n(하나면 단일 발주), 상태, 설비 범위, 검토 번호, 담당, 협조 미확인·검토 마감, 다음 동작 | `ranges` | 카드는 상태에 맞는 화면으로: 협조 대기 → 협조 요청 현황, 그 밖 → 검토 상세 |
| 담당자 탭 | 사내 담당자(역할, 이름, 맡은 범위, 직무, 협조 요청) | `people` | 연결 검토의 엔지니어·결재자·협조 받은 사람과 영업 |
| 일정 탭 | 날짜 · 일정(검토 시작, 결재 상신, 승인/반려, 검토 마감, 제출 마감, 제출 완료) · 지남 | `schedule` | 날짜 순 |
| 문서 탭 | 문서, 종류, 검토 번호, 설비 범위 | `documents` | 줄을 누르면 그 검토 |
| 지난 이력 탭 | 같은 고객의 지난 입찰 (입찰 상세로) | — | 예시 (탭 안에 예시 띠) |

## 수용 기준 (Given / When / Then)

- **Given** 사업 상세 개요, **When** "판정 확인" 범위 카드를 누르면, **Then** 그 검토의 검토 상세가 열린다. (범위 카드에서 검토로)
- **Given** 사업 상세, **When** "이 사업에 RFP 등록"을 누르면, **Then** 검토 등록이 "진행 중인 사업에 추가"와 그 사업을 고른 채 열린다. (이 사업에 RFP 등록)
- **Given** 결재 대기 검토가 있는 사업, **When** 사업 상세를 열면, **Then** "제출 완료로 표시"가 잠겨 있고 안내가 보인다. (제출 완료 단추)
- **Given** 사업 상세, **When** 지난 이력 탭을 열면, **Then** 탭 안에 예시 띠가 보인다. (지난 이력은 예시)
