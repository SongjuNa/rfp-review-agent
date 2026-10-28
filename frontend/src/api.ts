// 백엔드 API (/api, Vite 프록시). 응답 모양은 백엔드 queries·review 모듈과 같다.

export type Health = {
  status: 'ok' | 'degraded'
  database: 'ok' | 'down'
  schema_version: string | null
  llm_configured: boolean
}

export type User = { user_id: number; user_name: string; role: string }

export type Stage = 'PROCESSING' | 'ENGINEER_REVIEW' | 'APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED'

/** 사람이 넣는 검토 정보 (add-review-info). 비어 있으면 null */
export type ReviewInfo = {
  project_name: string | null
  review_name: string | null
  customer_name: string | null
  country: string | null
  due_date: string | null      // YYYY-MM-DD
  engineer_id: number | null
}

export type RunSummary = ReviewInfo & {
  run_id: number
  review_no: string            // RV-<시작 연도>-<실행 번호 세 자리>
  engineer_name: string | null
  stage: Stage
  step: string | null
  failed_step: string | null
  error_message: string | null
  started_at: string
  finished_at: string | null
  documents: number
  requirements: number
  risks: number
  judgments: number
  deviation_candidates: number
  output_items: number
  check_violations: number
  proposals: number
  llm_model: string | null
}

export type RunListItem = ReviewInfo & Pick<RunSummary, 'run_id' | 'review_no' | 'engineer_name' | 'stage'
  | 'step' | 'failed_step' | 'started_at' | 'finished_at' | 'error_message' | 'requirements' | 'risks'
  | 'deviation_candidates' | 'proposals'> & {
  files: string | null
}

export type Location = {
  file_no: number
  section_no: string | null
  section_title: string | null
  table_name: string | null
  item_no: string | null
  line_start: number | null
  line_end: number | null
}

export type Requirement = {
  requirement_id: number
  file_no: number
  file_name: string
  text_raw: string
  source_kind: string
  extracted_by: string
  confidence: number | null
  is_assumed: boolean
  locations: Location[]
  types: { type_code: string; is_primary: boolean; decided_by: string; rule_code: string | null }[]
  values: {
    value_seq: number
    raw_text: string | null
    num_value: number | null
    unit_raw: string | null
    cond_time_s: number | null
    item_key: string | null
    flag: string | null
  }[]
}

export type RunDocument = {
  document_id: number
  file_no: number
  file_name: string
  bundle: string
  doc_kind: string
  language: string
  standard_system: string | null
  judge_target: boolean
  readable: boolean
  needs_review: boolean
  requirements: number
}

export type Risk = {
  risk_id: number
  risk_kind: string
  status: string
  item_key: string | null
  item_name: string | null
  facts: string | null
  explanation_ai: string | null
  expression: string | null
  members: { requirement_id: number; text_raw: string; value_raw: string | null; locations: Location[] }[]
}

export type Judgment = {
  judgment_id: number
  requirement_id: number
  equipment_group: string
  result: string
  reason_code: string | null
  reason_text: string | null
  product_code: string | null
  product_selected_by: string | null
  product_value_raw: string | null
  product_value_unit: string | null
  margin_value: number | null
  margin_kind: string | null
  margin_direction: string
  is_assumed: boolean
  review_status: string
  req_value_raw: string | null
  unit_raw: string | null
  cond_time_s: number | null
  item_key: string | null
  item_name: string | null
  item_name_raw: string | null
  type_code: string | null
  type_name: string | null
  locations: Location[]
}

/** 판정 칩 건수 (GET /judgment-counts) */
export type JudgmentCounts = { by_result: Record<string, number>; total: number; unconfirmed: number; unconfirmed_comply: number }

export type JudgmentQuery = {
  result?: string; group?: string; type_code?: string; q?: string; unconfirmed?: boolean; order?: 'priority'
  offset?: number; limit?: number
}

export type Equipment = {
  equipment_group: string
  label: string | null
  family: string | null
  products: string[] | null
  selected_by: string | null
  chosen_product: string | null
  candidates: string[]
  judgments: number
  deviations: number
  ambiguous: number
}

export type Warranty = {
  candidate_id: number
  judgment_id: number
  requirement_id: number
  equipment_group: string
  item_key: string | null
  item_name: string | null
  item_name_raw: string | null
  candidate_value: string | null
  candidate_unit: string | null
  source_kind: string | null
  product_code: string | null
  pm_column: string | null
  fixed_key: string | null
  status: string
  reason_code: string | null
  is_assumed: boolean
  locations: Location[]
}

export type EngineeringCheck = {
  check_id: number
  rule_code: string
  result: 'PASS' | 'VIOLATION' | 'NEEDS_REVIEW'
  reason_code: string | null
  expected_ka: number | null
  factor: number | null
  requirement_id: number
  peak_item_key: string
  peak_ka: number
  ik_item_key: string
  ik_ka: number
  frequency_hz: number | null
  locations: Location[]
  ik_locations: Location[]
}

export type Loss = {
  loss_calc_id: number
  requirement_id: number
  product_code: string | null
  price_noload: number
  price_load: number
  price_aux: number
  price_unit: string | null
  loss_noload_kw: number | null
  loss_load_kw: number | null
  loss_aux_kw: number | null
  total_usd: number | null
  formula: string | null
  status: string
  reason_code: string | null
  is_assumed: boolean
  locations: Location[]
  /** 종류별 가산액 (단가 × 손실값). 손실값이 없으면 null */
  amounts: { noload: number | null; load: number | null; aux: number | null }
  price_locations: Location[]
}

export type OutputItem = {
  item_id: number
  list_kind: 'DEVIATION' | 'QUERY'
  list_name: string
  text_draft: string
  number_check: 'OK' | 'MISMATCH'
  number_detail: string | null
  drafted_by: string
  status: string
  is_assumed: boolean
  sources: { judgment_id: number | null; risk_id: number | null; requirement_id: number }[]
  locations: Location[]
  linked_items: number[]
}

export type SubmissionCheck = {
  deviation_candidates: number
  deviation_listed: number
  missing_judgment_ids: number[]
  open_queries: number
  ar_codes: string[]
}

export type Proposal = {
  point_id: number
  point_kind: string
  requirement_id: number
  product_code: string | null   // 현장 이력(FIELD)은 제품 행 대신 연결표 줄이 근거
  text_draft: string
  basis: string
  number_check: string
  number_detail: string | null
  drafted_by: string
  is_assumed: boolean
  status: string
  locations: Location[]
}

export type Criterion = { ar_code: string; detail: string; description?: string }

/** 문서 읽기 점검 줄 (SCR-08-2). kind: 표·그림·단위·위치 */
export type ReadCheck = {
  key: string; kind: string; what: string; document_id: number; file_name: string; loc: string
  line: number | null; problem: string; todo: string; checked_by: string | null; checked_at: string | null
}

export type ApprovalScreen = {
  stage: Stage
  approval: {
    approval_id: number
    decision: string | null
    comment: string | null
    requested_at: string
    decided_at: string | null
    approver_id: number | null
    approver: string | null
    requested_by_id: number | null
    requested_by: string | null
    request_comment: string | null
  } | null
  reasons: Criterion[]
  read_unchecked?: number           // 문서 읽기 점검 미확인 수
  preview: Criterion[] | null
  review_ratio: { review: number; total: number; threshold: number }
  submission_check: SubmissionCheck | null
}

export type LogEntry = {
  log_id: number
  target_table: string
  target_id: number
  action: string
  before_value: Record<string, unknown> | null
  after_value: Record<string, unknown> | null
  reason: string | null
  actor: string
  acted_at: string
  /** 바뀐 대상의 이름 (항목 이름, 위험 표현, 근거 등). 검토 실행·비교 제품은 null */
  target_label?: string | null
}

export type Assignment = {
  assignment_id: number
  run_id: number
  assignee_role: string
  status: 'TODO' | 'DOING' | 'DONE'
  repeat_count: number
  sent_at: string
  updated_at: string | null
  requirement_id: number
  requirement_ids: number[]
  point_id: number | null
  point_kind: string | null
  type_code: string | null
  type_name: string | null
  assignee: string | null
  text: string
  is_assumed: boolean | null
  stage: Stage
  locations: Location[]
}

export type ReviewCard = RunListItem & { summary: RunSummary; criteria: Criterion[]; approval?: ApprovalScreen['approval'] }

export type MyTasks = { role: string; reviews: ReviewCard[]; assignments: Assignment[] }

export type ActionBody = {
  target: string
  target_id: number
  action: string
  value?: Record<string, unknown>
  reason?: string
  actor_id?: number
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`/api${path}`, init)
  if (!res.ok) {
    let message = `API ${res.status}`
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') message = body.detail
    } catch {
      // 본문이 JSON이 아니면 상태 코드만 보여 준다
    }
    throw new Error(message)
  }
  return res
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  return (await send(path, init)).json()
}

/** 내려받을 파일: 이름(Content-Disposition filename*)과 내용 */
async function file(path: string): Promise<{ name: string; blob: Blob }> {
  const res = await send(path)
  const m = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get('Content-Disposition') ?? '')
  return { name: m ? decodeURIComponent(m[1]) : 'download', blob: await res.blob() }
}

/** 나눠 받는 목록과 거른 전체 개수(X-Total-Count 머리글). */
export type Page<T> = { items: T[]; total: number }

async function page<T>(path: string): Promise<Page<T>> {
  const res = await send(path)
  const items: T[] = await res.json()
  return { items, total: Number(res.headers.get('X-Total-Count') ?? items.length) }
}

/** 검토 시작 때 함께 보내는 검토 정보. 빈 칸은 보내지 않는다 */
export type StartInfo = Partial<Omit<ReviewInfo, 'engineer_id'>> & { engineer_id?: number | null; actor_id?: number | null }

function filled(info: StartInfo): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  Object.entries(info).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') out[k] = v
  })
  return out
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  health: () => call<Health>('/health'),
  users: () => call<User[]>('/users'),
  runs: (limit = 200) => call<RunListItem[]>(`/runs?limit=${limit}`),
  library: () => call<string[]>('/library'),
  startLibrary: (files: string[], info: StartInfo = {}) =>
    call<RunSummary>('/runs/library', json('POST', { files, ...filled(info) })),
  upload: (files: File[], info: StartInfo = {}) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    Object.entries(filled(info)).forEach(([k, v]) => form.append(k, String(v)))
    return call<RunSummary>('/runs', { method: 'POST', body: form })
  },
  /** 보낸 칸만 바꾼다. 빈 문자열은 비우기 */
  updateInfo: (id: number, info: Partial<Record<keyof ReviewInfo, string | number | null>>, actor_id: number | null) =>
    call<RunSummary>(`/runs/${id}/info`, json('PUT', { ...info, actor_id })),
  judgmentPage: (id: number, params: JudgmentQuery) => page<Judgment>(`/runs/${id}/judgments?${query(params)}`),
  judgmentCounts: (id: number) => call<JudgmentCounts>(`/runs/${id}/judgment-counts`),
  run: (id: number) => call<RunSummary>(`/runs/${id}`),
  documents: (id: number) => call<RunDocument[]>(`/runs/${id}/documents`),
  requirements: (id: number, params: { type_code?: string; offset?: number; limit?: number }) =>
    call<Requirement[]>(`/runs/${id}/requirements?${query(params)}`),
  requirement: (reqId: number, runId: number) => call<Requirement>(`/requirements/${reqId}?run_id=${runId}`),
  risks: (id: number) => call<Risk[]>(`/runs/${id}/risks`),
  judgments: (id: number, params: { result?: string; group?: string; offset?: number; limit?: number }) =>
    call<Judgment[]>(`/runs/${id}/judgments?${query(params)}`),
  equipment: (id: number) => call<Equipment[]>(`/runs/${id}/equipment`),
  chooseProduct: (id: number, group: string, product_code: string | null) =>
    call<Record<string, number>>(`/runs/${id}/equipment/${encodeURIComponent(group)}/product`,
      json('PUT', { product_code })),
  warranty: (id: number, params: { status?: string; offset?: number; limit?: number }) =>
    call<Warranty[]>(`/runs/${id}/warranty?${query(params)}`),
  warrantyPage: (id: number, params: { status?: string; offset?: number; limit?: number }) =>
    page<Warranty>(`/runs/${id}/warranty?${query(params)}`),
  losses: (id: number) => call<Loss[]>(`/runs/${id}/losses`),
  checks: (id: number) => call<EngineeringCheck[]>(`/runs/${id}/checks`),
  updateLoss: (id: number, lossId: number, values: Record<string, number | null>) =>
    call<{ total_usd: number | null; formula: string }>(`/runs/${id}/losses/${lossId}`, json('PUT', values)),
  outputs: (id: number) => call<OutputItem[]>(`/runs/${id}/outputs`),
  submissionCheck: (id: number) => call<SubmissionCheck>(`/runs/${id}/submission-check`),
  proposals: (id: number) => call<Proposal[]>(`/runs/${id}/proposals`),
  exportOutputs: (id: number, list_kind: 'DEVIATION' | 'QUERY') => file(`/runs/${id}/outputs/export?list_kind=${list_kind}`),
  act: (id: number, body: ActionBody) =>
    call<{ submission_check: SubmissionCheck | null }>(`/runs/${id}/actions`, json('POST', body)),
  history: (id: number) => call<LogEntry[]>(`/runs/${id}/history`),
  approval: (id: number) => call<ApprovalScreen>(`/runs/${id}/approval`),
  readChecks: (id: number) => call<ReadCheck[]>(`/runs/${id}/read-checks`),
  checkRead: (id: number, key: string, actor_id: number) =>
    call<ReadCheck>(`/runs/${id}/read-checks/${encodeURIComponent(key)}`, json('POST', { actor_id })),
  uncheckRead: (id: number, key: string, actor_id: number) =>
    call<ReadCheck>(`/runs/${id}/read-checks/${encodeURIComponent(key)}?actor_id=${actor_id}`, { method: 'DELETE' }),
  /** 결재 상신: 결재자와 상신 의견은 필수 */
  submit: (id: number, approver_id: number, comment: string, actor_id: number) =>
    call<{ stage: Stage; criteria: Criterion[] }>(`/runs/${id}/finish-review`, json('POST', { approver_id, comment, actor_id })),
  withdraw: (id: number, actor_id: number) => call<{ stage: Stage }>(`/runs/${id}/withdraw`, json('POST', { actor_id })),
  decide: (id: number, decision: string, comment: string, actor_id: number) =>
    call<ApprovalScreen>(`/runs/${id}/approval`, json('POST', { decision, comment, actor_id })),
  tasks: (user_id: number) => call<MyTasks>(`/tasks?user_id=${user_id}`),
  setTaskStatus: (assignmentId: number, status: string, actor_id: number) =>
    call<{ status: string }>(`/assignments/${assignmentId}`, json('PUT', { status, actor_id })),
  reopen: (id: number, actor_id: number) => call<{ stage: Stage }>(`/runs/${id}/reopen`, json('POST', { actor_id })),
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== false) q.set(k, String(v))
  })
  return q.toString()
}
