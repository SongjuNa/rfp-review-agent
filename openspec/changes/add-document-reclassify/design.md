# Design

## 결정

- **검토별 값**: 문서 행(`document`)은 같은 파일·같은 처리 판이면 여러 검토가 함께 쓴다. 그래서 문서 행을 고치지 않고
  `run_document`에 검토별 칸 `bundle`, `doc_kind`, `judge_target`(NULL이면 문서 행 값)을 더한다(마이그레이션 0014).
  다른 검토의 결과를 바꾸지 않는다(CR-11). 문서를 새 처리 판으로 다시 처리하는 대안보다 빠르고 AI 비용이 없다.
- **판정 대상 고르기**: 지금 판정은 `judge.load_values`의 `d.bundle IN ('A','B') AND d.judge_target`으로 거른다.
  검토 번호를 받아 `COALESCE(rd.bundle, d.bundle)`, `COALESCE(rd.judge_target, d.judge_target)`로 거른다.
  묶음을 보는 다른 질의(`queries.run_documents`, 머리글 "묶음 A·B")도 같은 방식으로 바꾼다.
- **다시 판정**: 묶음이 바뀌어 판정 대상이 달라지면 `judge_run(전체)` 뒤 `rebuild_outputs`. 이전 판정은 `is_current = false`로 남는다
  (비교 제품 바꾸기 `switch_product`와 같은 방식). 위험 조건은 묶음과 상관없이 읽을 수 있는 문서 전체에서 찾으므로 다시 만들지 않는다.
  묶음이 바뀌어도 판정 대상 여부가 같으면(A↔B, C↔D) 다시 판정하지 않는다.
- **이미 확정한 판정**: 다시 판정하면 확정한 판정도 현재가 아니게 된다. 화면은 저장 전에 "확정한 판정 n줄을 다시 확인해야 합니다"를 보인다. [제안]
- **조건** (어기면 저장하지 않고 이유를 돌려준다):
  - 검토 단계가 `ENGINEER_REVIEW`(담당자 확인)일 때만. 그 밖은 409.
  - 고치는 사람은 엔지니어(`ENGINEER`). 그 밖은 403. [제안]
  - 사유 필수. 묶음은 A~D, 종류는 문서 종류 코드표 안. 읽지 못한 문서를 A·B로 바꾸면 400.
  - 값이 지금과 같으면 아무것도 하지 않는다.
- **이력**: `document_class_edit(edit_id, run_id, document_id, before_bundle, before_doc_kind, after_bundle, after_doc_kind, reason, actor_id, edited_at)`.
  고치면 검토의 분류 방법은 "사람", 확인 필요는 해제.
- **API**: `PUT /api/runs/{run_id}/documents/{document_id}/classification` 본문 `{bundle, doc_kind, reason, actor_id}`,
  응답 `{document, rejudged, judgment_count, ...counts}`. `GET /api/runs/{run_id}/documents` 응답에 `original_bundle`, `original_doc_kind`, `last_edit`(사유·사람·시각 또는 null)을 더한다.
- **화면**: 문서 표 창(`DocumentsDialog`)에서 담당자 확인 단계이고 엔지니어면 줄마다 "분류 고치기" 단추. 누르면 그 줄 아래에 종류·묶음 고르기, 사유 칸, 판정이 다시 도는지 안내, 저장/취소.
  저장하면 표와 머리글, 판정 탭을 새로 불러온다. 고친 줄은 "사람이 바꿈"과 원래 값·사유를 보인다. 그 밖 단계·역할이면 지금처럼 "이 창에서 고칠 수 없습니다"와 이유.

## 대안

- 문서 행(`document`)을 직접 고치기 → 같은 문서를 쓰는 다른 검토의 판정 대상이 바뀐다(CR-11 위반).
- 새 처리 판으로 문서를 다시 처리(`|H:` 키) → 실제 RFP 약 15분과 AI 비용. 묶음은 추출에 쓰지 않으므로 필요 없다.

## 위험

- 판정·출력 질의 중 `document.bundle`·`judge_target`을 직접 보는 곳을 놓치면 화면과 판정이 어긋난다 → 테스트로 판정 대상 문서가 바뀌는지 본다.
- 확정한 판정이 많은 뒤에 고치면 확인을 다시 해야 한다 → 저장 전 안내.
