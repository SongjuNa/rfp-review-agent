// 백엔드 API (/api, Vite 프록시). 응답 타입은 백엔드 응답 모델에서 만든다 (api.gen.ts, `npm run gen:api`).
import type {
  ActionResult, ApprovalScreen, AssignmentStatus, BulkResult, DecisionResult, DocumentChoice, DocumentPreview,
  LossResult, ProductSwitch,
  RunSummary, StageResult, SubmitResult,
} from './api.gen'

export type {
  ApprovalScreen, Assignment, CompareRule, Criterion, Datasheet, DatasheetInfo, DatasheetRow, DocKindRule,
  DocumentChoice, DocumentPreview, EngineeringCheck,
  Equipment, Health, ItemKey, Judgment, JudgmentCounts, Location, LogEntry, Loss, MyTasks, OutputItem, Product,
  ProductDetail, ProductFamily, Proposal, ReadCheck, Requirement, ReviewCard, Risk, RiskExpression, RunDocument,
  RunListItem, RunSummary, SubmissionCheck, Tbe, TbeRow, User, Warranty,
} from './api.gen'
import type {
  CompareRule, DatasheetInfo, Datasheet, DocKindRule, EngineeringCheck, Equipment, Health, ItemKey, Judgment, JudgmentCounts,
  LogEntry, Loss, MyTasks, OutputItem, Product, ProductDetail, ProductFamily, Proposal, ReadCheck, Requirement,
  Risk, RiskExpression, RunDocument, RunListItem, SubmissionCheck, Tbe, User, Warranty, Assignment,
} from './api.gen'

export type Stage = RunSummary['stage']

/** 사람이 넣는 검토 정보 (add-review-info). 비어 있으면 null */
export type ReviewInfo = Pick<RunSummary, 'project_name' | 'review_name' | 'customer_name' | 'country' | 'due_date'
  | 'engineer_id'>

export type JudgmentQuery = {
  result?: string; group?: string; type_code?: string; q?: string; unconfirmed?: boolean; order?: 'priority'
  offset?: number; limit?: number
}

export type TbeQuery = { include: 'all' | 'confirmed'; lang: 'en' | 'ko' | 'both'; base: 'now' | 'v1' }

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
  /** 사람이 정한 문서 분류(choices)는 파일 이름마다 */
  startLibrary: (files: string[], info: StartInfo = {}, choices: Record<string, DocumentChoice> = {}) =>
    call<RunSummary>('/runs/library', json('POST', { files, ...filled(info), choices })),
  upload: (files: File[], info: StartInfo = {}, choices: Record<string, DocumentChoice> = {}) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    Object.entries(filled(info)).forEach(([k, v]) => form.append(k, String(v)))
    if (Object.keys(choices).length) form.append('choices', JSON.stringify(choices))
    return call<RunSummary>('/runs', { method: 'POST', body: form })
  },
  /** 분석 전 분류 추천 (규칙만, 저장 안 함) */
  previewLibrary: (files: string[]) => call<DocumentPreview[]>('/runs/library/preview', json('POST', { files })),
  previewUpload: (files: File[]) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    return call<DocumentPreview[]>('/runs/preview', { method: 'POST', body: form })
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
    call<ProductSwitch>(`/runs/${id}/equipment/${encodeURIComponent(group)}/product`,
      json('PUT', { product_code })),
  warranty: (id: number, params: { status?: string; offset?: number; limit?: number }) =>
    call<Warranty[]>(`/runs/${id}/warranty?${query(params)}`),
  warrantyPage: (id: number, params: { status?: string; offset?: number; limit?: number }) =>
    page<Warranty>(`/runs/${id}/warranty?${query(params)}`),
  losses: (id: number) => call<Loss[]>(`/runs/${id}/losses`),
  checks: (id: number) => call<EngineeringCheck[]>(`/runs/${id}/checks`),
  updateLoss: (id: number, lossId: number, values: Record<string, number | null>) =>
    call<LossResult>(`/runs/${id}/losses/${lossId}`, json('PUT', values)),
  outputs: (id: number) => call<OutputItem[]>(`/runs/${id}/outputs`),
  submissionCheck: (id: number) => call<SubmissionCheck>(`/runs/${id}/submission-check`),
  proposals: (id: number) => call<Proposal[]>(`/runs/${id}/proposals`),
  datasheets: (id: number) => call<DatasheetInfo[]>(`/runs/${id}/datasheets`),
  datasheet: (id: number, tableId: number) => call<Datasheet>(`/runs/${id}/datasheet?table_id=${tableId}`),
  exportDatasheet: (id: number, tableId: number) => file(`/runs/${id}/datasheet/export?table_id=${tableId}`),
  tbe: (id: number, q: TbeQuery) => call<Tbe>(`/runs/${id}/tbe?${query(q)}`),
  exportTbe: (id: number, q: TbeQuery) => file(`/runs/${id}/tbe/export?${query(q)}`),
  exportOutputs: (id: number, list_kind: 'DEVIATION' | 'QUERY') => file(`/runs/${id}/outputs/export?list_kind=${list_kind}`),
  bulkConfirm: (id: number, ids: number[], actor_id: number) =>
    call<BulkResult>(`/runs/${id}/actions/bulk`, json('POST', { target: 'judgment', ids, action: 'CONFIRM', actor_id })),
  act: (id: number, body: ActionBody) =>
    call<ActionResult>(`/runs/${id}/actions`, json('POST', body)),
  history: (id: number) => call<LogEntry[]>(`/runs/${id}/history`),
  approval: (id: number) => call<ApprovalScreen>(`/runs/${id}/approval`),
  readChecks: (id: number) => call<ReadCheck[]>(`/runs/${id}/read-checks`),
  checkRead: (id: number, key: string, actor_id: number) =>
    call<ReadCheck>(`/runs/${id}/read-checks/${encodeURIComponent(key)}`, json('POST', { actor_id })),
  uncheckRead: (id: number, key: string, actor_id: number) =>
    call<ReadCheck>(`/runs/${id}/read-checks/${encodeURIComponent(key)}?actor_id=${actor_id}`, { method: 'DELETE' }),
  /** 결재 상신: 결재자와 상신 의견은 필수 */
  submit: (id: number, approver_id: number, comment: string, actor_id: number) =>
    call<SubmitResult>(`/runs/${id}/finish-review`, json('POST', { approver_id, comment, actor_id })),
  withdraw: (id: number, actor_id: number) => call<StageResult>(`/runs/${id}/withdraw`, json('POST', { actor_id })),
  decide: (id: number, decision: string, comment: string, actor_id: number) =>
    call<DecisionResult>(`/runs/${id}/approval`, json('POST', { decision, comment, actor_id })),
  tasks: (user_id: number) => call<MyTasks>(`/tasks?user_id=${user_id}`),
  products: (params: { family?: string; q?: string; offset?: number; limit?: number; cards?: 'false' }) => page<Product>(`/products?${query(params)}`),
  productFamilies: () => call<ProductFamily[]>('/products/families'),
  product: (code: string) => call<ProductDetail>(`/products/${encodeURIComponent(code)}`),
  compareRules: () => call<CompareRule[]>('/rules/compare'),
  ruleItems: () => call<ItemKey[]>('/rules/items'),
  riskExpressions: () => call<RiskExpression[]>('/rules/risk-expressions'),
  docKindRules: () => call<DocKindRule[]>('/rules/doc-kinds'),
  assignments: (role: string) => call<Assignment[]>(`/assignments?role=${role}`),
  setTaskStatus: (assignmentId: number, status: string, actor_id: number) =>
    call<AssignmentStatus>(`/assignments/${assignmentId}`, json('PUT', { status, actor_id })),
  reopen: (id: number, actor_id: number) => call<StageResult>(`/runs/${id}/reopen`, json('POST', { actor_id })),
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== false) q.set(k, String(v))
  })
  return q.toString()
}
