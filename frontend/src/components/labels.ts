import type { Location } from '../api'

// 사람이 읽는 이름 (코드 값 → 화면 문구)
export const RESULT_NAMES: Record<string, string> = {
  COMPLY: '준수',
  DEVIATION_CANDIDATE: '일탈 후보',
  QUERY_CANDIDATE: '질의 후보',
  NEEDS_REVIEW: '확인 필요',
  WARRANTY_TO_FILL: '보증값 작성',
}
export const STAGE_NAMES: Record<string, string> = {
  PROCESSING: '처리 중',
  ENGINEER_REVIEW: '담당자 확인',
  APPROVAL: '승인 대기',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
  FAILED: '처리 실패',
}
export const STEP_NAMES: Record<string, string> = {
  created: '시작', documents: '문서 읽기', pairs: '같은 문서 찾기', risks: '위험 조건 찾기',
  judge: '제품 비교 판정', warranty: '보증값 후보', loss: '손실 환산', outputs: '일탈·질의 목록',
  proposals: '제안 포인트', done: '처리 끝', engineer_review: '담당자 확인', approval: '승인 대기',
  approved: '승인됨', rejected: '반려됨',
}
export const STATUS_NAMES: Record<string, string> = {
  CANDIDATE: '후보', CONFIRMED: '확정', EDITED: '수정함', REJECTED: '반려', EMPTY_REVIEW: '확인 필요',
  DRAFT: '초안', REMOVED: '뺌', ADOPTED: '채택', DISCARDED: '버림', CLOSED_OK: '문제 없음',
}
export const MARGIN_NAMES: Record<string, string> = {
  STRENGTH: '강점', NOT_STRENGTH: '강점 아님', NOT_CALC: '—',
}
export const POINT_KIND_NAMES: Record<string, string> = {
  MARGIN: '여유', LOSS: '손실 환산', FIELD: '현장 이력',
}
export const RISK_NAMES: Record<string, string> = {
  BLANKET: '포괄 조항', VALUE_MISMATCH: '값 불일치', OPEN_SCOPE: '범위 모호',
}

export function locationText(loc: Location): string {
  const where = loc.table_name
    ? `${loc.table_name}${loc.item_no ? ` ${loc.item_no}번` : ''}`
    : `${loc.section_no ?? ''} ${loc.section_title ?? ''}`.trim()
  const line = loc.line_start ? ` · ${loc.line_start}행` : ''
  return `파일 ${loc.file_no}${where ? ` · ${where}` : ''}${line}`
}
