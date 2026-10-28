# Tasks

## 1. 검토 상세 틀과 판정 탭 (SCR-08, SCR-08-1)

- [x] 1.1 화면 명세 `docs/screens/SCR-08-1-판정.md`, SCR-08 요약 칸·탭 갱신
- [x] 1.2 `queries.run_judgments`·`count_judgments`: type_code, q, unconfirmed, order=priority, 줄에 주 유형
- [x] 1.3 `queries.judgment_counts`와 `GET /judgment-counts`
- [x] 1.4 테스트: 확정 안 한 일탈 후보만 / 판정 순서로 받기 / 검색어로 거르기 / 칩 건수
- [x] 1.5 화면: 요약 칸, 탭 9개(예시 탭 3개는 예시 띠), 판정 탭 머리 단추(초안 창·결재 상신)
- [x] 1.6 화면: 판정 칩·거르기·표·페이지, 상세 패널(원문·근거·출처·목록 문장·판정 바꾸기·확정)
- [x] 1.7 e2e: 요약 칸 / 탭으로 내용 바꾸기 / 예시 탭 / 판정 칩으로 거르기 / 거른 결과가 없음 / 줄을 눌러 원문 보기 / 사유 없이 판정 바꾸기
- [x] 1.8 목업 대조 스크린샷, `SCR-08-1_공유.md`

## 2. 위험 조건 탭 (SCR-08-3)

- [x] 2.1 화면 명세 `docs/screens/SCR-08-3-위험조건.md`
- [x] 2.2 `queries.run_risks`: 값 불일치 줄에 항목 이름, 테스트 "값 불일치 항목 이름"
- [x] 2.3 화면: 머리 건수, 위험 조건 표(상태·종류·설명·위치·처리자), 위험으로 확정, 사유를 적어 문제 없음, 원문 펼치기
- [x] 2.4 화면: 사람이 찾은 특이 요구 예시 영역
- [x] 2.5 e2e: 위험 조건 건수 / 문제 없음으로 닫기 / 사유 없이 닫기 / 위험으로 확정 / 특이 요구 제안은 예시
- [x] 2.6 목업 대조 스크린샷, `SCR-08-3_공유.md`

## 3. 마무리

- [x] 3.1 `ruff`, `pytest`, `npm run lint`, `npm run build`, `openspec validate update-review-screens --strict`
