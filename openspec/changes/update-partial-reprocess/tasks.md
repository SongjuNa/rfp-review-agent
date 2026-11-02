## 1. 처리기 표와 첫 답 남기기 (BE 나송주)
- [ ] 1.1 `pipeline/processors.py` 처리기마다 고칠 AI 단계(`fix`: LABEL·TYPE·없음)
- [ ] 1.2 `_refine_with_ai`·`_prepare`가 절마다 물은 문장과 답, 유형을 물은 줄과 답을 남김

## 2. 떨어진 부분만 다시 묻기 (BE 나송주)
- [ ] 2.1 LABEL: 요구 문장이 하나도 남지 않은 절만 되돌려 일반 처리기로 다시 묻고, 규칙 유형 다시 붙이기·새 요구사항 줄의 유형 묻기
- [ ] 2.2 TYPE: 유형 NONE 줄만 일반 처리기로 다시 묻기
- [ ] 2.3 고칠 단계가 없는 점검은 다시 묻지 않음, 처리기는 처음 고른 것 그대로

## 3. 기록과 응답 (BE 나송주)
- [ ] 3.1 마이그레이션 0032(번호는 main에서 다시 확인): `document.reprocessed_lines`
- [ ] 3.2 문서 표 응답 `reprocessed_lines`, 실행 기록 `lines_reprocessed`, `npm run gen:api`

## 4. 시험과 마무리 (BE 나송주)
- [ ] 4.1 Scenario마다 테스트(`tests/test_document_processors.py`), 기존 "동시 처리 = 차례 처리" 통과
- [ ] 4.2 명세서·기획서 반영 확인, AGENTS.md 표, 개발 기록, archive
