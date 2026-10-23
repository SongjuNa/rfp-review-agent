// 백엔드 API (/api, Vite 프록시). 응답 모양은 백엔드 queries·review 모듈과 같다.

export type Health = {
  status: 'ok' | 'degraded'
  database: 'ok' | 'down'
  schema_version: string | null
  llm_configured: boolean
}

export type User = { user_id: number; user_name: string; role: string }

export type Stage = 'PROCESSING' | 'ENGINEER_REVIEW' | 'APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED'

export type RunSummary = {
  run_id: number
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
  proposals: number
  llm_model: string | null
}

export type RunListItem = Pick<RunSummary, 'run_id' | 'stage' | 'step' | 'started_at' | 'error_message'> & {
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
  locations: Location[]
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
  product_code: string
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

export type ApprovalScreen = {
  stage: Stage
  approval: {
    approval_id: number
    decision: string | null
    comment: string | null
    requested_at: string
    decided_at: string | null
    approver: string | null
  } | null
  reasons: Criterion[]
  preview: Criterion[] | null
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
}

export type ActionBody = {
  target: string
  target_id: number
  action: string
  value?: Record<string, unknown>
  reason?: string
  actor_id?: number
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
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
  return res.json()
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  health: () => call<Health>('/health'),
  users: () => call<User[]>('/users'),
  runs: () => call<RunListItem[]>('/runs'),
  library: () => call<string[]>('/library'),
  startLibrary: (files: string[]) => call<RunSummary>('/runs/library', json('POST', { files })),
  upload: (files: File[]) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    return call<RunSummary>('/runs', { method: 'POST', body: form })
  },
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
  losses: (id: number) => call<Loss[]>(`/runs/${id}/losses`),
  updateLoss: (id: number, lossId: number, values: Record<string, number | null>) =>
    call<{ total_usd: number | null; formula: string }>(`/runs/${id}/losses/${lossId}`, json('PUT', values)),
  outputs: (id: number) => call<OutputItem[]>(`/runs/${id}/outputs`),
  submissionCheck: (id: number) => call<SubmissionCheck>(`/runs/${id}/submission-check`),
  proposals: (id: number) => call<Proposal[]>(`/runs/${id}/proposals`),
  act: (id: number, body: ActionBody) =>
    call<{ submission_check: SubmissionCheck | null }>(`/runs/${id}/actions`, json('POST', body)),
  history: (id: number) => call<LogEntry[]>(`/runs/${id}/history`),
  approval: (id: number) => call<ApprovalScreen>(`/runs/${id}/approval`),
  finishReview: (id: number, actor_id: number) =>
    call<{ stage: Stage; criteria: Criterion[] }>(`/runs/${id}/finish-review`, json('POST', { actor_id })),
  decide: (id: number, decision: string, comment: string, actor_id: number) =>
    call<ApprovalScreen>(`/runs/${id}/approval`, json('POST', { decision, comment, actor_id })),
  reopen: (id: number, actor_id: number) => call<{ stage: Stage }>(`/runs/${id}/reopen`, json('POST', { actor_id })),
}

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v))
  })
  return q.toString()
}
