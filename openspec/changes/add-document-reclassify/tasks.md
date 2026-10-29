# Tasks

## 1. DB

- [ ] 1.1 마이그레이션 0014: `run_document`에 `bundle`, `doc_kind`, `judge_target`, `classify_by`, `needs_review` 칸(NULL이면 문서 행 값), `document_class_edit` 표

## 2. 분류 고치기

- [ ] 2.1 `pipeline/reclassify.py`: 조건 확인(단계·역할·사유·코드·읽기), 검토별 값 저장, 이력, 판정 대상이 바뀌면 `judge_run` + `rebuild_outputs`
- [ ] 2.2 `judge.load_values`·`queries.run_documents`·머리글 묶음 질의가 검토별 값을 먼저 보게

## 3. API

- [ ] 3.1 `PUT /runs/{run_id}/documents/{document_id}/classification`, 응답 모델
- [ ] 3.2 `GET /runs/{run_id}/documents`에 `original_bundle`, `original_doc_kind`, `last_edit`
- [ ] 3.3 `npm run gen:api`

## 4. 화면

- [ ] 4.1 문서 표 창: "분류 고치기", 종류·묶음 고르기, 사유, 다시 판정 안내(확정한 판정 수), 저장 뒤 새로 불러오기, "사람이 바꿈"·원래 값·사유
- [ ] 4.2 SCR-08 명세·`SCR-08_공유.md` 갱신

## 5. 테스트 (Scenario마다 하나 이상, 이름에 Scenario 이름)

- [ ] 5.1 백엔드: 판정 문서를 판정 안 함으로 고치기 / 판정 안 하던 문서를 판정 대상으로 고치기 / 문서 종류만 고치기 / 다른 검토는 그대로 / 상신 뒤에는 고칠 수 없음 / 사유 없이 고치기 / 읽지 못한 문서를 판정 묶음으로
- [ ] 5.2 화면: 문서 표에서 묶음 고치기 / 고칠 수 없는 단계 (`e2e/document-reclassify.spec.ts`)

## 6. 마무리

- [ ] 6.1 ruff, pytest, lint, check:api, build, `openspec validate --all --strict`
- [ ] 6.2 archive
