## 1. 저장소와 흐름 모양
- [ ] 1.1 `uv add langgraph-checkpoint-postgres`, `uv.lock` 커밋
- [ ] 1.2 `rfp-db setup`·`migrate`와 테스트 DB 준비에서 `PostgresSaver.setup()` 부르기
- [ ] 1.3 `build_graph`에 checkpoint 저장소를 받고 `thread_id = run-<run_id>`로 돌리기
- [ ] 1.4 사람 노드 `engineer_review`·`approval`·`rejected`와 동작 이름 → 다음 노드 갈림 표

## 2. 사람 동작을 흐름에서 잇기
- [ ] 2.1 `pipeline/graph_flow.py`: `resume(ctx, run_id, action, payload)`, 멈춘 자리와 단계 칸 대조(다르면 409), 흐름 기록 없으면 지금 함수
- [ ] 2.2 상신·승인·반려·상신 취소·다시 확인 끝점이 `resume`을 부름
- [ ] 2.3 문서 추가: 검사·기록 뒤 백그라운드 작업이 `add_documents`로 이어 감

## 3. 이어서 다시 시도
- [ ] 3.1 다시 시도 작업이 저장된 흐름이 있으면 `invoke(None)`로 이어 감, 없으면 처음부터
- [ ] 3.2 `graph_state.resumed_from`·`skipped_steps`, `RunLogItem.resumed_from`, `npm run gen:api`

## 4. 시험과 마무리
- [ ] 4.1 Scenario마다 테스트(`tests/test_graph_stops.py`)
- [ ] 4.2 지금 테스트(결재·취소·다시 시도·문서 추가) 그대로 통과
- [ ] 4.3 AGENTS.md 표, 개발 기록, archive
