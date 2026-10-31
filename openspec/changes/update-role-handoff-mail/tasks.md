# Tasks

## 1. DB·백엔드 (최민정)

- [ ] 1.1 마이그레이션 0015: `assignment`에 `sent_by`, `mail_error`, `replied_at`, `reply_note`
- [ ] 1.2 `rfp_agent/notify/mail.py`: SMTP 발송, 환경 변수, 가짜 발송기, 3번 다시 시도
- [ ] 1.3 메일 본문·부서 몫 엑셀 첨부 만들기(인계 패키지와 같은 엑셀 함수)
- [ ] 1.4 판정 확정·여러 줄 확정·제안 포인트 채택 뒤 보낼 요청 모아 발송(design 1), 한 번만(design 3)
- [ ] 1.5 `pipeline/assignments.py`: 상태 바꾸기는 엔지니어만(DOING ↔ DONE), 회신 요지
- [ ] 1.6 `api/runs.py` 보내기·다시 보내기 경로, `PUT /assignments/{id}` 권한, `schemas.py`, `gen:api`
- [ ] 1.7 `pipeline/business.py`·홈 협조 대기 기준(TODO 또는 DOING)
- [ ] 1.8 테스트: 각 Scenario (확정 때 발송, 한 번만, 원문 위치 없는 줄 빠짐, 주소 없음, 발송 실패, 엔지니어만 회신 기록, 협조 대기 기준)

## 2. 설정·화면 (최민정)

- [ ] 2.1 `docker-compose.yml` Mailpit, `.env.example` 메일 값
- [ ] 2.2 `views/Todo.tsx`: 요약 줄 네 칸, 발송 실패 꼬리표·[다시 보내기], 판정 없는 요청 [보내기], 상세 창 [회신 받음 표시], 확인함·처리 끝 지우기
- [ ] 2.3 내 할 일(견적·품질·영업) 상태 단추 지우기
- [ ] 2.4 `Home.tsx` 협조 대기 문구(박경빈 님에게 알림)
- [ ] 2.5 e2e: 판정 확정 → Mailpit에 메일 1통, 회신 받음 표시 뒤 홈 열 바뀜

## 3. 문서·마무리

- [ ] 3.1 `docs/screens/SCR-13-협조요청.md`, `SCR-13_공유.md`, README 메일 설정
- [ ] 3.2 AGENTS.md 7장 검사, `openspec archive update-role-handoff-mail --yes`
