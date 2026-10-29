// 처리 진행률: 처리 상태 화면(SCR-02)과 홈 카드(SCR-03)가 같이 쓴다.

// 처리 단계 순서 (pipeline/run.py build_graph)와 단계마다 보이는 문장
export const STEPS: [string, string][] = [
  ['created', '처리를 시작하는 중'], ['documents', '문서 읽는 중'], ['pairs', '원본·정정본 찾는 중'], ['risks', '위험 조건 찾는 중'],
  ['judge', '제품과 비교해 판정하는 중'], ['check', '공학 규칙 검산 중'], ['warranty', '보증값 후보 만드는 중'], ['loss', '손실 환산 중'],
  ['outputs', '일탈·질의 목록 만드는 중'], ['proposals', '제안 포인트 만드는 중'], ['assign', '담당자에게 나누는 중'],
]

/** 지금 단계까지 끝난 비율 (0~99). 마지막 단계가 끝나면 화면이 판정 탭으로 바뀐다 */
export function progress(step: string | null): number {
  const at = Math.max(0, STEPS.findIndex(([k]) => k === step))
  return Math.min(99, Math.round((at / STEPS.length) * 100))
}
