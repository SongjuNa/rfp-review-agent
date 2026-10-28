import type { Location } from '../api'

// 사람이 읽는 이름 (코드 값 → 화면 문구)
export const RESULT_NAMES: Record<string, string> = {
  COMPLY: '준수',
  DEVIATION_CANDIDATE: '일탈 후보',
  QUERY_CANDIDATE: '질의 후보',
  NEEDS_REVIEW: '확인 필요',
  WARRANTY_TO_FILL: '보증값 작성',
}
/** 판정 배지 색과 칩 점 색 (목업 K) */
export const RESULT_TONES: Record<string, string> = {
  DEVIATION_CANDIDATE: 'c-red', QUERY_CANDIDATE: 'c-ora', NEEDS_REVIEW: 'c-ora', WARRANTY_TO_FILL: 'c-blue', COMPLY: 'c-green',
}
export const RESULT_DOTS: Record<string, string> = {
  DEVIATION_CANDIDATE: '#B42318', QUERY_CANDIDATE: '#B54708', NEEDS_REVIEW: '#FDB022', WARRANTY_TO_FILL: '#0569A0', COMPLY: '#067647',
}
/** 판정 순서: 일탈 → 질의 → 확인 필요 → 보증값 작성 → 준수 */
export const RESULT_ORDER = ['DEVIATION_CANDIDATE', 'QUERY_CANDIDATE', 'NEEDS_REVIEW', 'WARRANTY_TO_FILL', 'COMPLY']
export const STAGE_NAMES: Record<string, string> = {
  PROCESSING: '처리 중',
  ENGINEER_REVIEW: '담당자 확인',
  APPROVAL: '승인 대기',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
  FAILED: '처리 실패',
}
/** 단계 배지 색 (목업 .st.c-*) */
export const STAGE_TONES: Record<string, string> = {
  PROCESSING: 'c-grey', ENGINEER_REVIEW: 'c-blue', APPROVAL: 'c-grey', APPROVED: 'c-green', REJECTED: 'c-grey',
  FAILED: 'c-red',
}
export const STEP_NAMES: Record<string, string> = {
  created: '시작', documents: '문서 읽기', pairs: '같은 문서 찾기', risks: '위험 조건 찾기',
  judge: '제품 비교 판정', check: '공학 규칙 검산', warranty: '보증값 후보', loss: '손실 환산', outputs: '일탈·질의 목록',
  proposals: '제안 포인트', assign: '담당자 전달', done: '처리 끝', engineer_review: '담당자 확인', approval: '승인 대기',
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
export const CHECK_NAMES: Record<string, string> = {
  PASS: '통과', VIOLATION: '위반', NEEDS_REVIEW: '확인 필요',
}
export const CHECK_REASONS: Record<string, string> = {
  NO_FREQUENCY: '같은 표에 주파수가 없음', MULTI_FREQUENCY: '주파수가 여럿이거나 50·60 Hz가 아님',
  MULTI_IK: '같은 부위에 단시간 전류 값이 여럿', UNIT_DIFF: '단위가 kA가 아님 (환산하지 않음)',
}
export const ROLE_NAMES: Record<string, string> = {
  ENGINEER: '기술 검토 엔지니어', APPROVER: '승인자', COST: '견적 담당', QUALITY: '품질 담당', SALES: '영업 담당',
}
export const TASK_STATUS_NAMES: Record<string, string> = {
  TODO: '할 일', DOING: '하는 중', DONE: '끝',
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
export const DOC_KIND_NAMES: Record<string, string> = {
  BID_FORM: '입찰 양식', REQUIREMENT_SPEC: '요구 사양서', PURCHASE_SPEC: '구매 사양서', TEST_SPEC: '시험 사양서',
  SUPPLIER_SPEC: '공급사 사양', UNKNOWN: '종류 모름',
}
