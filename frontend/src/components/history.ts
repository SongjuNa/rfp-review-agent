import type { LogEntry } from '../api'
import { RESULT_NAMES, STATUS_NAMES } from './labels'

// SCR-08-9 이력 탭의 한 줄 문장 (목업 v4.57 Detail logs: '위험 조건 "주위 온도"를 정상으로 닫음').
// 기록(before/after) 그대로 문장으로만 바꾼다. 값을 계산하거나 고치지 않는다.

const INFO_NAMES: Record<string, string> = {
  project_name: '사업명', review_name: '설비 범위', customer_name: '고객사', country: '국가',
  due_date: '제출 마감일', engineer_id: '담당 엔지니어',
}
const LIST_NAMES: Record<string, string> = { DEVIATION: '일탈 목록', QUERY: '질의 목록' }

const q = (label: string | null | undefined) => (label ? `"${label}"` : '')
const v = (x: unknown) => (x === null || x === undefined || x === '' ? '비어 있음' : String(x))
const kw = (x: unknown) => (x === null || x === undefined ? '—' : String(x))

export function historyText(l: LogEntry): string {
  const b = l.before_value ?? {}
  const a = l.after_value ?? {}
  const name = q(l.target_label)
  switch (l.target_table) {
    case 'judgment':
      if (l.action === 'EDIT' && a.result !== undefined) {
        return `판정 ${name} ${RESULT_NAMES[String(b.result)] ?? v(b.result)} → ${RESULT_NAMES[String(a.result)] ?? v(a.result)}`
      }
      return l.action === 'CONFIRM' ? `판정 ${name} 제안대로 확정` : `판정 ${name} ${STATUS_NAMES[String(a.review_status)] ?? l.action}`
    case 'warranty_candidate':
      return l.action === 'CONFIRM' ? `보증값 ${name} 확정` : `보증값 ${name}에 ${v(a.candidate_value)}${a.candidate_unit ? ` ${a.candidate_unit}` : ''} 입력`
    case 'risk_flag':
      return l.action === 'CONFIRM' ? `위험 조건 ${name} 위험으로 확정` : `위험 조건 ${name} 문제 없음으로 닫음`
    case 'output_item': {
      const list = LIST_NAMES[String(a.list_kind ?? b.list_kind)] ?? '목록'
      return l.action === 'CONFIRM' ? `${list} 문장 ${name} 확정` : l.action === 'REJECT' ? `${list}에서 ${name} 뺌` : `${list} 문장 ${name} 고침`
    }
    case 'proposal_point':
      return l.action === 'ADOPT' ? `제안 포인트 ${name} 채택` : l.action === 'DISCARD' ? `제안 포인트 ${name} 버림` : `제안 포인트 ${name} 문장 고침`
    case 'loss_calc':
      return `손실값 고침 (무부하 ${kw(a.loss_noload_kw)} · 부하 ${kw(a.loss_load_kw)} · 보조 ${kw(a.loss_aux_kw)} kW)`
    case 'run_product_choice':
      return `비교 제품 바꿈: ${v(b.product_code === null ? '자동' : b.product_code)} → ${v(a.product_code === null ? '자동' : a.product_code)}`
    case 'review_run': {
      if (a.stage === 'APPROVAL') return '결재 상신'
      if (a.stage === 'APPROVED') return '승인'
      if (a.stage === 'REJECTED') return '반려'
      if (b.stage === 'APPROVAL' && a.stage === 'ENGINEER_REVIEW') return '결재 상신 취소'
      if (b.stage === 'REJECTED' && a.stage === 'ENGINEER_REVIEW') return '반려 뒤 다시 확인 시작'
      const fields = Object.keys(a).filter((k) => INFO_NAMES[k])
      if (fields.length) return `검토 정보 고침: ${fields.map((k) => `${INFO_NAMES[k]} ${v(b[k])} → ${v(a[k])}`).join(', ')}`
      return '검토 실행 바뀜'
    }
    default:
      return `${l.target_table} ${l.action}`
  }
}

/** 사유 줄의 이름: 결재·상신은 "의견", 나머지는 "사유" */
export function reasonLabel(l: LogEntry): string {
  return l.target_table === 'review_run' && l.action !== 'EDIT' ? '의견' : '사유'
}
