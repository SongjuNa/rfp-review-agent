# 화면 명세: SCR-08 검토 상세 (머리글)

- 연결 요구사항: FR-01·07·09·13, `review-workspace` 검토 정보 입력과 표시 (`add-review-info`), 검토 상세 문서 표 (`update-document-info`), 문서 추가 (`add-document-addendum`, FR-01 ⑤)
- 기준 목업: `Spec2Win_목업_v4.57.html#Detail`
- 구현 방식: 머리글은 실제. 탭(SCR-08-1~11)은 `update-review-screens`에서 목업대로 바꾸고, 그전까지 예전 탭 화면을 머리글 아래에 둔다
- 사용 API: `GET /api/runs/{id}`(처리 중이면 2초마다), `PUT /api/runs/{id}/info`, `GET /api/runs/{id}/documents`, `POST /api/runs/preview`·`POST /api/runs/{id}/documents`(문서 추가)
- 화면 주소: `#/reviews/:id`. 머리글 위치 마지막 칸은 검토 번호

## 화면 구성 (머리글)

| 영역 | 보이는 항목 | API 칸 |
|---|---|---|
| 첫 줄 (`.idl`) | 검토 번호, 단계 배지, "마감 MM-DD D-n" | `review_no`, `stage`, `due_date` |
| 제목 (`h1`) | "사업명 · 검토명" (한쪽이 비면 있는 쪽, 둘 다 비면 첫 파일 이름) | `project_name`, `review_name` |
| 아래 줄 | 사업 …, 문서 n개(단추), 묶음 A·B(판정 대상 문서의 묶음, 없으면 빨간 "판정 문서 없음"), 고객사 · 국가, 담당 … | `documents`, `/documents`의 `bundle`·`judge_target`, `customer_name`, `country`, `engineer_name` |
| 문서 표 창 (`.mdo > .apw.docw`) | 판정 대상 n개 · 판정 안 함 n개 · 확인 필요 n개, 표(파일, 파일 이름, 문서 종류 + 확인 필요, 분류 방법 규칙·AI·사람, 묶음, 판정 대상 / 판정 안 함 + 이유, 요구사항 수). 판정 안 함 줄은 빨간 바탕 | `/documents`의 `file_no`, `file_name`, `doc_kind`, `needs_review`, `classify_by`, `bundle`, `judge_target`, `readable`, `requirements` |
| 문서 표 창 아래 "문서 추가" (`.docadd`, 엔지니어·담당자 확인 단계만) | 안내 문장, "docx 고르기", 고른 파일 표(파일 이름 + 이미 있으면 빨간 안내, 문서 종류·묶음 고르기, 판정 대상 / 판정 안 함 + 추천 이유), "추가하고 다시 분석 (n개)" | `/runs/preview`의 `doc_kind`·`bundle`·`readable`·`reason` |
| 오른쪽 | "검토 정보 고치기" | |
| 고치기 창 (`.mdo > .apw`) | 사업명, 설비 범위, 고객사, 국가, 제출 마감일, 담당 엔지니어, "n칸 바뀜", 취소 / 저장 | `PUT /info`는 바뀐 칸만 보낸다 |

## 사용자 동작 → 시스템 반응

| 동작 | 누가 | 호출 API | 성공 시 | 실패 시 |
|---|---|---|---|---|
| 검토 정보 저장 | 모두 (단계와 관계없이) | `PUT /api/runs/{id}/info` | 창이 닫히고 머리글이 바뀜, 이력 탭에 EDIT 1건 | 창 아래 오류 문장, 값 그대로 |
| 문서 n개 누르기 | 모두 | (머리글이 불러 둔 `/documents`) | 문서 표 창이 열림 | — |
| docx 고르기 | 엔지니어 (담당자 확인 단계) | `POST /api/runs/preview` | 고른 파일마다 분류 추천이 칸에 채워짐 | "분석하면서 정합니다" |
| 추가하고 다시 분석 | 엔지니어 (담당자 확인 단계) | `POST /api/runs/{id}/documents` (files, choices, actor_id) | 창이 닫히고 처리 중 화면, 끝나면 "문서 n+1개". 같은 줄의 확정·수정·반려는 그대로, 이력에 "문서 추가: 파일 이름" | 창 아래 오류 문장(409 같은 파일·상신 뒤, 403 엔지니어 아님) |
| 창 닫기 | 모두 | — | Esc, 바깥 누르기, 닫기, 취소 | — |

## 수용 기준 (Given / When / Then)

- **Given** 검토 상세, **When** 엔지니어가 머리글에서 고객사를 고치고 저장하면, **Then** 머리글과 목록에 새 고객사가 보이고 이력 탭에 그 변경이 보인다. (머리글에서 고치기)
- **Given** 묶음 A 문서 하나로 판정을 마친 검토, **When** 상세를 열면, **Then** 머리글에 "문서 1개"와 "묶음 A"가 보인다. (판정 묶음 보기)
- **When** "문서 1개"를 누르면, **Then** 파일 이름·문서 종류·분류 방법·묶음 A·판정 대상·요구사항 수가 보이는 창이 열린다. (문서 표 열기)
- **Given** 묶음 C 문서만 있는 검토, **Then** 머리글에 "판정 문서 없음", 표에 "판정 안 함"·이유·"확인 필요"가 강조된다. (판정하지 않는 문서)
- **Given** 판정 1줄을 확정한 검토, **When** 엔지니어가 문서 표에서 docx 하나를 골라 "추가하고 다시 분석"을 누르면, **Then** 끝난 뒤 "문서 2개", 확정한 줄은 "확정" 그대로, 이력에 "문서 추가"와 파일 이름. (문서 추가하고 다시 분석)
- **Given** 담당자 확인 단계 검토, **When** 승인자가 문서 표를 열면, **Then** "문서 추가" 칸이 없다. (승인자에게는 문서 추가 없음)
