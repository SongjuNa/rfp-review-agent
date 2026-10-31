// 만든 파일: 고치지 마세요. `npm run gen:api`로 다시 만듭니다 (scripts/gen-api-types.mjs).
// 출처: 백엔드 응답 모델 → frontend/openapi.json (RFP 기술 검토 지원 API 0.2.0)

export type Action = {
  target: string
  target_id: number
  action: string
  value?: Record<string, unknown> | null
  reason?: string | null
  actor_id?: number | null
}

/** 확정·수정·반려 하나. 바뀌기 전·후 줄은 대상 표마다 칸이 달라 자유 형식이다. */
export type ActionResult = {
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  submission_check: SubmissionCheck | null
}

export type Actor = {
  actor_id?: number | null
}

export type Approval = {
  approval_id: number
  decision: 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | null
  comment: string | null
  requested_at: string
  decided_at: string | null
  approver_id: number | null
  approver: string | null
  requested_by_id: number | null
  requested_by: string | null
  request_comment: string | null
}

export type ApprovalScreen = {
  stage: 'PROCESSING' | 'ENGINEER_REVIEW' | 'APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED'
  approval: Approval | null
  reasons: Criterion[]
  preview: Criterion[] | null
  review_ratio: ReviewRatio
  submission_check: SubmissionCheck | null
  read_unchecked: number
}

export type Assignment = {
  assignment_id: number
  run_id: number
  assignee_role: 'ENGINEER' | 'COST' | 'QUALITY' | 'SALES'
  status: 'TODO' | 'DOING' | 'DONE'
  repeat_count: number
  sent_at: string
  updated_at: string | null
  requirement_id: number | null
  requirement_ids: number[]
  point_id: number | null
  point_kind: string | null
  point_requirement_id: number | null
  type_code: string | null
  type_name: string | null
  assignee: string | null
  text: string
  is_assumed: boolean | null
  stage: 'PROCESSING' | 'ENGINEER_REVIEW' | 'APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED'
  review_no: string
  project_name: string | null
  review_name: string | null
  customer_name: string | null
  country: string | null
  due_date: string | null
  engineer_id: number | null
  engineer_name: string | null
  business_id: number | null
  business_no: string | null
  locations: Location[]
  file_name: string | null
  mail_sent_at: string | null
  mail_to: string | null
  mail_error: string | null
  sent_by_name: string | null
  dept_address: string | null
  replied_at: string | null
  replied_by_name: string | null
  reply_note: string | null
}

export type AssignmentStatus = {
  assignment_id: number
  status: 'TODO' | 'DOING' | 'DONE'
}

export type Body_run_upload_api_runs_post = {
  files: string[]
  project_name?: string | null
  review_name?: string | null
  customer_name?: string | null
  country?: string | null
  due_date?: string | null
  engineer_id?: number | null
  actor_id?: number | null
  choices?: string | null
  business_id?: number | null
  new_business_name?: string | null
}

export type Body_upload_preview_api_runs_preview_post = {
  files: string[]
}

export type BulkAction = {
  target?: string
  ids: number[]
  action?: string
  actor_id?: number | null
}

export type BulkResult = {
  confirmed: number
  submission_check: SubmissionCheck | null
}

export type BusinessDetail = {
  business_id: number
  business_no: string
  business_name: string
  customer_name: string | null
  country: string | null
  tender_no: string | null
  order_mode: string | null
  business_due_date: string | null
  due_date: string | null
  days_left: number | null
  sales_id: number | null
  sales_name: string | null
  created_by: number
  created_by_name: string
  created_at: string
  submitted_at: string | null
  my_role: 'ENGINEER' | 'APPROVER' | 'HELPER' | 'SALES' | 'CREATOR' | null
  ranges: BusinessRange[]
  people: BusinessPerson[]
  schedule: BusinessEvent[]
  documents: BusinessDocument[]
}

export type BusinessDocument = {
  run_id: number
  review_no: string
  review_name: string | null
  file_name: string
  doc_kind: string
  bundle: 'A' | 'B' | 'C' | 'D'
}

export type BusinessEvent = {
  day: string
  kind: 'START' | 'REQUEST' | 'APPROVED' | 'REJECTED' | 'RUN_DUE' | 'DUE' | 'SUBMITTED'
  run_id: number | null
  review_no: string | null
}

/** 사업 정보. 보낸 칸만 바꾸고 빈 문자열은 비우기로 본다. 사업명은 비울 수 없다. */
export type BusinessInfo = {
  business_name?: string | null
  customer_name?: string | null
  country?: string | null
  tender_no?: string | null
  order_mode?: string | null
  due_date?: string | null
  sales_id?: number | null
  actor_id?: number | null
}

export type BusinessList = {
  summary: BusinessSummary
  items: BusinessListItem[]
}

export type BusinessListItem = {
  business_id: number
  business_no: string
  business_name: string
  customer_name: string | null
  country: string | null
  tender_no: string | null
  order_mode: string | null
  business_due_date: string | null
  due_date: string | null
  days_left: number | null
  sales_id: number | null
  sales_name: string | null
  created_by: number
  created_by_name: string
  created_at: string
  submitted_at: string | null
  my_role: 'ENGINEER' | 'APPROVER' | 'HELPER' | 'SALES' | 'CREATOR' | null
  ranges: BusinessRange[]
}

export type BusinessLog = {
  log_id: number
  field: string
  before_value: unknown
  after_value: unknown
  actor_id: number
  actor_name: string
  acted_at: string
}

export type BusinessPerson = {
  user_id: number
  user_name: string
  role: 'ENGINEER' | 'COST' | 'QUALITY' | 'SALES' | 'APPROVER'
  part: 'ENGINEER' | 'APPROVER' | 'HELPER' | 'SALES'
  run_ids: number[]
  scope: string | null
}

/** 사업에 연결된 검토 하나 (설비 범위). 상태는 저장하지 않고 계산한다. */
export type BusinessRange = {
  run_id: number
  review_no: string
  review_name: string | null
  stage: 'PROCESSING' | 'ENGINEER_REVIEW' | 'APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED'
  due_date: string | null
  started_at: string
  engineer_id: number | null
  engineer_name: string | null
  open_requests: number
  state: 'an' | 'fail' | 'chk' | 'co' | 'ap' | 'rej' | 'sub' | 'done'
}

export type BusinessSummary = {
  open: number
  due3: number
  overdue: number
}

/** 기술 판단에서 생긴 상업 영향: 손실 환산 가산액(LOSS), 일탈 후보 가격 영향 확인(DEVIATION). */
export type CommercialImpact = {
  kind: 'LOSS' | 'DEVIATION'
  loss_calc_id: number | null
  item_id: number | null
  judgment_id: number | null
  product_code: string | null
  total_usd: number | null
  is_assumed: boolean
  text: string | null
  locations: Location[]
}

export type CompareRule = {
  compare_rule_id: number
  table_name: string | null
  item_no: string | null
  item_key: string | null
  name_ko: string | null
  direction: string
  time_condition: boolean
  strength_direction: string | null
  own_strength_direction: string | null
  process_note: string | null
  used: number
}

/** 비용 조건 한 줄 (FR-16). 같은 조건이 반복되면 한 줄로 묶는다. 모든 줄은 후보다 (CR-08). */
export type CostCondition = {
  requirement_id: number
  requirement_ids: number[]
  kind: string
  text: string
  values: string[]
  burden: string | null
  risk: string | null
  primary_type: string | null
  primary_type_name: string | null
  repeat_count: number
  role: 'COST'
  assignment_id: number | null
  request_status: 'TODO' | 'DOING' | 'DONE' | null
  mail_error: string | null
  file_name: string | null
  locations: Location[]
}

export type CostSummary = {
  conditions: CostCondition[]
  impacts: CommercialImpact[]
}

export type Criterion = {
  ar_code: string
  detail: string
  description?: string | null
}

export type Datasheet = {
  file_name: string
  review_no: string
  table_id: number
  table_name: string
  source_file: string
  rows: DatasheetRow[]
  counts: DatasheetCounts
}

export type DatasheetCounts = {
  rows: number
  ok: number
  cand: number
  empty: number
}

export type DatasheetInfo = {
  table_id: number
  table_name: string
  file_name: string
  rows: number
  empty: number
}

export type DatasheetRow = {
  judgment_id: number
  candidate_id: number | null
  target: 'judgment' | 'warranty'
  no: string
  item: string
  item_en: string
  unit: string
  requirement: string
  value: string | null
  basis: string
  why: string
  state: 'ok' | 'cand' | 'empty'
  status: string
  assumed: boolean
}

export type Decision = {
  decision: string
  comment?: string | null
  actor_id?: number | null
}

export type DecisionResult = {
  stage: 'PROCESSING' | 'ENGINEER_REVIEW' | 'APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED'
  approval: Approval | null
  reasons: Criterion[]
  preview: Criterion[] | null
  review_ratio: ReviewRatio
  submission_check: SubmissionCheck | null
  read_unchecked: number
  approval_id: number
}

export type DeliverableOutput = {
  item_id: number
  list_kind: 'DEVIATION' | 'QUERY'
  list_name: string | null
  text_draft: string
  status: string
  is_assumed: boolean
}

export type DeliverableProposal = {
  point_id: number
  point_kind: string
  text_draft: string
  basis: string | null
  is_assumed: boolean
  status: string
}

export type Deliverables = {
  proposals: DeliverableProposal[]
  outputs: DeliverableOutput[]
  warranty: DeliverableWarranty[]
}

export type DeliverableWarranty = {
  candidate_id: number
  judgment_id: number
  candidate_value: string | null
  candidate_unit: string | null
  source_kind: string | null
}

/** 문서 종류 규칙 한 줄. used는 그 종류로 규칙이 분류한 문서 수. */
export type DocKindRule = {
  doc_kind_rule_id: number
  priority: number
  doc_kind: 'BID_FORM' | 'REQUIREMENT_SPEC' | 'PURCHASE_SPEC' | 'TEST_SPEC' | 'SUPPLIER_SPEC' | 'UNKNOWN'
  name_pattern: string
  page_pattern: string | null
  note: string | null
  used: number
}

/** 등록 화면에서 사람이 정한 문서 분류. 비운 칸은 규칙 결과를 쓴다. */
export type DocumentChoice = {
  bundle?: 'A' | 'B' | 'C' | 'D' | null
  doc_kind?: 'BID_FORM' | 'REQUIREMENT_SPEC' | 'PURCHASE_SPEC' | 'TEST_SPEC' | 'SUPPLIER_SPEC' | 'UNKNOWN' | null
}

export type DocumentPair = {
  pair_id: number
  file_no_a: number
  file_no_b: number
  relation: string
  status: string
  evidence: string | null
}

/** 분석 전 분류 추천 (저장하지 않음). 묶음·판정 대상은 코드 규칙의 추천이다. */
export type DocumentPreview = {
  file_name: string
  in_catalog: boolean
  file_no: number | null
  doc_kind: 'BID_FORM' | 'REQUIREMENT_SPEC' | 'PURCHASE_SPEC' | 'TEST_SPEC' | 'SUPPLIER_SPEC' | 'UNKNOWN'
  bundle: 'A' | 'B' | 'C' | 'D'
  language: string
  standard_system: string | null
  readable: boolean
  judge_target: boolean
  needs_review: boolean
  reason: string
}

export type EngineeringCheck = {
  check_id: number
  rule_code: string
  result: 'PASS' | 'VIOLATION' | 'NEEDS_REVIEW'
  reason_code: string | null
  expected_ka: number | null
  factor: number | null
  requirement_id: number
  ik_requirement_id: number
  peak_item_key: string
  peak_ka: number
  peak_raw: string | null
  ik_item_key: string
  ik_ka: number
  ik_raw: string | null
  frequency_hz: number | null
  locations: Location[]
  ik_locations: Location[]
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

export type FieldHistory = {
  fault_link_id: number
  item_key: string
  item_name: string
  fault_id: string
  symptom: string | null
  root_cause: string | null
  action: string | null
  confirmed_by: string | null
  cases: number
}

export type Health = {
  status: string
  database: string
  schema_version: string | null
  llm_configured: boolean
}

export type HTTPValidationError = {
  detail?: ValidationError[]
}

export type ItemKey = {
  item_key: string
  name_ko: string
  default_direction: string
  strength_direction: string
  note: string | null
  pm_column: string | null
  fixed_key: string | null
  aliases: string[]
  used: number
}

export type Judgment = {
  judgment_id: number
  requirement_id: number
  equipment_group: string
  result: 'COMPLY' | 'DEVIATION_CANDIDATE' | 'QUERY_CANDIDATE' | 'NEEDS_REVIEW' | 'WARRANTY_TO_FILL'
  reason_code: string | null
  reason_text: string | null
  product_code: string | null
  product_selected_by: 'AUTO' | 'ENGINEER' | null
  product_value_raw: string | null
  product_value_unit: string | null
  margin_value: number | null
  margin_kind: 'DIFF' | 'RATIO' | 'TIME_RATIO' | null
  margin_direction: 'STRENGTH' | 'NOT_STRENGTH' | 'NOT_CALC'
  is_assumed: boolean
  review_status: 'CANDIDATE' | 'CONFIRMED' | 'EDITED' | 'REJECTED'
  req_value_raw: string | null
  req_num: number | null
  unit_raw: string | null
  cond_time_s: number | null
  item_key: string | null
  item_name: string | null
  item_name_raw: string | null
  type_code: string | null
  type_name: string | null
  locations: Location[]
}

export type JudgmentCounts = {
  by_result: Record<string, number>
  total: number
  unconfirmed: number
  unconfirmed_comply: number
}

export type LibraryFiles = {
  files: string[]
}

export type LibraryRun = {
  project_name?: string | null
  review_name?: string | null
  customer_name?: string | null
  country?: string | null
  due_date?: string | null
  engineer_id?: number | null
  actor_id?: number | null
  files: string[]
  choices?: Record<string, DocumentChoice>
  business_id?: number | null
  new_business_name?: string | null
}

/** 원문 위치: 파일 번호 + 절 또는 표 + 행 (CR-02). 절·표·항목·행은 있는 것만 있다. */
export type Location = {
  file_no: number
  section_no: string | null
  section_title: string | null
  table_name: string | null
  item_no: string | null
  line_start: number | null
  line_end: number | null
}

export type LogEntry = {
  log_id: number
  target_table: string
  target_id: number
  action: string
  before_value: Record<string, unknown> | null
  after_value: Record<string, unknown> | null
  reason: string | null
  actor: string | null
  acted_at: string
  target_label: string | null
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
  status: 'CALCULATED' | 'NEEDS_REVIEW'
  reason_code: string | null
  is_assumed: boolean
  price_requirement_ids: number[] | null
  amounts: LossAmounts
  locations: Location[]
  price_locations: Location[]
}

/** 종류별 가산액 (단가 × 손실값). 손실값이 없으면 null. */
export type LossAmounts = {
  noload: number | null
  load: number | null
  aux: number | null
}

/** 손실값을 넣고 다시 계산한 결과. 사람이 넣은 값이라 항상 팀 가정 (CR-06). */
export type LossResult = {
  total_usd: number | null
  formula: string | null
  status: 'CALCULATED' | 'NEEDS_REVIEW'
  is_assumed: true
}

export type LossValues = {
  loss_noload_kw?: number | null
  loss_load_kw?: number | null
  loss_aux_kw?: number | null
}

export type MyTasks = {
  role: 'ENGINEER' | 'COST' | 'QUALITY' | 'SALES' | 'APPROVER'
  reviews: ReviewCard[]
  assignments: Assignment[]
}

export type OutputItem = {
  item_id: number
  list_kind: 'DEVIATION' | 'QUERY'
  list_name: string | null
  text_draft: string
  number_check: 'OK' | 'MISMATCH'
  number_detail: string | null
  drafted_by: 'CODE' | 'AI' | 'ENGINEER'
  status: 'DRAFT' | 'CONFIRMED' | 'REMOVED'
  is_assumed: boolean
  basis_requirement_id: number | null
  sources: OutputSource[]
  locations: Location[]
  linked_items: number[]
}

export type OutputSource = {
  source_seq: number
  judgment_id: number | null
  risk_id: number | null
  check_id: number | null
  requirement_id: number | null
}

/** 제품표 한 줄 (add-reference-views). 빈 칸은 null 그대로 (CR-04). */
export type Product = {
  product_code: string
  product_name: string
  family: string
  rated_voltage_kv: number | null
  rated_current_a: number | null
  short_circuit_ka: number | null
  rated_frequency: string | null
  rated_capacity: number | null
  rated_capacity_unit: string | null
  weight_kg: number | null
  noload_loss_kw: number | null
  load_loss_kw: number | null
  aux_loss_kw: number | null
  loss_is_assumed: boolean | null
  lightning_impulse_kv: number | null
  power_freq_withstand_kv: number | null
  switching_impulse_kv: number | null
  peak_current_ka: number | null
  making_current_ka: number | null
  breaking_time_ms: number | null
  closing_time_ms: number | null
  gas_leakage_percent: number | null
  partial_discharge_pc: number | null
  cooling_type: string | null
  insulation_medium: string | null
  maintenance_months: number | null
  service_life_years: number | null
  warranty_months: number | null
  comparison_values_assumed: boolean
  comparison_values_source: string | null
  is_assumed: boolean
  is_design_card: boolean
  source_doc: string | null
  lifecycle_status: string | null
  used: number
  value_columns: string[]
  empty_columns: string[]
  empty_count: number
}

export type ProductChoice = {
  product_code?: string | null
}

/** 제품 하나. 제품표의 모든 칸이 함께 오고, 칸 이름은 제품표 CSV를 따른다. */
export type ProductDetail = {
  product_code: string
  product_name: string
  family: string
  rated_voltage_kv: number | null
  rated_current_a: number | null
  short_circuit_ka: number | null
  rated_frequency: string | null
  rated_capacity: number | null
  rated_capacity_unit: string | null
  weight_kg: number | null
  noload_loss_kw: number | null
  load_loss_kw: number | null
  aux_loss_kw: number | null
  loss_is_assumed: boolean | null
  lightning_impulse_kv: number | null
  power_freq_withstand_kv: number | null
  switching_impulse_kv: number | null
  peak_current_ka: number | null
  making_current_ka: number | null
  breaking_time_ms: number | null
  closing_time_ms: number | null
  gas_leakage_percent: number | null
  partial_discharge_pc: number | null
  cooling_type: string | null
  insulation_medium: string | null
  maintenance_months: number | null
  service_life_years: number | null
  warranty_months: number | null
  comparison_values_assumed: boolean
  comparison_values_source: string | null
  is_assumed: boolean
  is_design_card: boolean
  source_doc: string | null
  lifecycle_status: string | null
  used: number
  value_columns: string[]
  empty_columns: string[]
  empty_count: number
  used_runs: number
  used_in: ProductUse[]
  proposals: ProductProposal[]
  field_history: FieldHistory[]
} & Record<string, unknown>

export type ProductFamily = {
  family: string
  products: number
  with_empty: number
  empty_cells: number
  assumed: number
  design_cards: number
}

export type ProductProposal = {
  point_id: number
  run_id: number
  point_kind: string
  status: string
  text_draft: string | null
  is_assumed: boolean
}

/** 비교 제품 바꾸기 뒤 다시 만든 줄 수. */
export type ProductSwitch = {
  judgment_count: number
  check_count: number
  warranty_count: number
  loss_count: number
  output_count: number
  proposal_count: number
  assignment_count: number
}

export type ProductUse = {
  run_id: number
  review_no: string
  project_name: string | null
  review_name: string | null
  judgment_id: number
  equipment_group: string
  item_name: string | null
  result: 'COMPLY' | 'DEVIATION_CANDIDATE' | 'QUERY_CANDIDATE' | 'NEEDS_REVIEW' | 'WARRANTY_TO_FILL'
  product_selected_by: string | null
}

export type Proposal = {
  point_id: number
  point_kind: 'MARGIN' | 'LOSS' | 'FIELD'
  requirement_id: number
  product_code: string | null
  judgment_id: number | null
  loss_calc_id: number | null
  fault_link_id: number | null
  text_draft: string
  basis: string | null
  number_check: 'OK' | 'MISMATCH'
  number_detail: string | null
  drafted_by: 'CODE' | 'AI' | 'ENGINEER'
  is_assumed: boolean
  status: 'CANDIDATE' | 'ADOPTED' | 'DISCARDED' | 'EDITED'
  locations: Location[]
}

/** 문서 읽기 점검 줄 (SCR-08-2). kind: 표·그림·단위·위치. */
export type ReadCheck = {
  key: string
  kind: string
  what: string
  document_id: number
  file_name: string
  loc: string
  line: number | null
  problem: string
  todo: string
  checked_by: string | null
  checked_at: string | null
}

/** 요구사항. 목록(문서 읽기 점검)은 원문 위치가 없는 줄도 보여 준다. */
export type Requirement = {
  requirement_id: number
  file_no: number
  file_name: string
  source_kind: string
  req_kind: string
  text_raw: string
  extracted_by: 'RULE' | 'AI'
  confidence: number | null
  is_assumed: boolean
  rule_id: string | null
  supplier_mark: string | null
  dedup_of: number | null
  locations: Location[]
  types: TypeTag[]
  values: ReqValue[]
}

export type ReqValue = {
  value_seq: number
  raw_text: string | null
  cell_form: string
  num_value: number | null
  operator: string | null
  unit_raw: string | null
  cond_time_s: number | null
  cond_raw: string | null
  item_key: string | null
  target_object: string | null
  basis_standard: string | null
  delegated_std: string | null
  equipment_key: string | null
  flag: string | null
}

export type ReviewCard = {
  project_name: string | null
  review_name: string | null
  customer_name: string | null
  country: string | null
  due_date: string | null
  engineer_id: number | null
  business_id: number | null
  business_no: string | null
  run_id: number
  review_no: string
  engineer_name: string | null
  stage: 'PROCESSING' | 'ENGINEER_REVIEW' | 'APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED'
  step: string | null
  step_detail: StepDetail | null
  step_updated_at: string
  failed_step: string | null
  error_message: string | null
  started_at: string
  finished_at: string | null
  files: string | null
  requirements: number
  risks: number
  deviation_candidates: number
  proposals: number
  summary: RunSummary
  criteria: Criterion[]
  approval?: Approval | null
}

/** 검토 정보. 보낸 칸만 바꾸고 빈 문자열은 비우기로 본다 (add-review-info). */
export type ReviewInfo = {
  project_name?: string | null
  review_name?: string | null
  customer_name?: string | null
  country?: string | null
  due_date?: string | null
  engineer_id?: number | null
  actor_id?: number | null
}

export type ReviewRatio = {
  review: number
  total: number
  threshold: number
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
  members: RiskMember[]
}

export type RiskExpression = {
  expr_id: number
  expression: string
  language: string
  risk_kind: string
  context_rule: string
  used: number
}

export type RiskMember = {
  requirement_id: number
  text_raw: string
  value_raw: string | null
  locations: Location[]
}

/** 규칙 추가·수정. value 칸은 사전마다 다르다 (pipeline/rule_edit.py). 사유는 꼭 적는다. */
export type RuleChange = {
  value: Record<string, unknown>
  reason?: string | null
  actor_id?: number | null
}

/** 규칙 고침 이력 한 줄 (add-rule-editing). row_key는 고치기 전(추가는 추가한) 줄 키, after_key는 고친 뒤 키. */
export type RuleEdit = {
  edit_id: number
  dictionary: 'compare' | 'risk-expressions' | 'items' | 'doc-kinds'
  row_key: Record<string, unknown>
  after_key: Record<string, unknown> | null
  action: 'ADD' | 'EDIT' | 'DELETE'
  before_value: Record<string, unknown> | null
  after_value: Record<string, unknown> | null
  reason: string
  actor_id: number
  actor_name: string
  edited_at: string
  discarded_at: string | null
}

export type RuleRemoval = {
  reason?: string | null
  actor_id?: number | null
}

export type RunBusiness = {
  business_id?: number | null
  actor_id?: number | null
}

export type RunDocument = {
  document_id: number
  file_no: number
  file_name: string
  bundle: 'A' | 'B' | 'C' | 'D'
  doc_kind: string
  language: string
  standard_system: string | null
  judge_target: boolean
  readable: boolean
  classify_by: string | null
  needs_review: boolean
  line_basis: string | null
  requirements: number
}

export type RunListItem = {
  project_name: string | null
  review_name: string | null
  customer_name: string | null
  country: string | null
  due_date: string | null
  engineer_id: number | null
  business_id: number | null
  business_no: string | null
  run_id: number
  review_no: string
  engineer_name: string | null
  stage: 'PROCESSING' | 'ENGINEER_REVIEW' | 'APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED'
  step: string | null
  step_detail: StepDetail | null
  step_updated_at: string
  failed_step: string | null
  error_message: string | null
  started_at: string
  finished_at: string | null
  files: string | null
  requirements: number
  risks: number
  deviation_candidates: number
  proposals: number
}

/** 실행 기록 한 줄 (add-run-log, NFR-09). 비용은 모델 단가(팀 가정)로 어림한 값. */
export type RunLogItem = {
  project_name: string | null
  review_name: string | null
  customer_name: string | null
  country: string | null
  due_date: string | null
  engineer_id: number | null
  business_id: number | null
  business_no: string | null
  run_id: number
  review_no: string
  engineer_name: string | null
  stage: 'PROCESSING' | 'ENGINEER_REVIEW' | 'APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED'
  failed_step: string | null
  cancelled: boolean
  started_at: string
  finished_at: string | null
  seconds: number | null
  llm_model: string | null
  dict_version: string
  llm_calls: number
  llm_retries: number
  llm_input_tokens: number
  llm_output_tokens: number
  llm_thinking_tokens: number
  estimated_cost_krw: number | null
  cost_assumed: boolean
  documents: number
  documents_reused: number
  requirements: number
  judgments: number
  retries: number
  steps: RunStepTime[]
}

/** 실행 기록의 단계 하나 (add-run-log). 끝나지 않은 단계는 seconds가 null. */
export type RunStepTime = {
  attempt: number
  step: string
  seconds: number | null
}

export type RunSummary = {
  project_name: string | null
  review_name: string | null
  customer_name: string | null
  country: string | null
  due_date: string | null
  engineer_id: number | null
  business_id: number | null
  business_no: string | null
  run_id: number
  review_no: string
  engineer_name: string | null
  stage: 'PROCESSING' | 'ENGINEER_REVIEW' | 'APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED'
  dict_version: string
  llm_model: string | null
  step: string | null
  step_detail: StepDetail | null
  step_updated_at: string
  failed_step: string | null
  error_message: string | null
  cancel_requested_at: string | null
  retries: number
  retryable: boolean
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
}

export type SendRequests = {
  assignment_ids: number[]
  actor_id?: number | null
}

export type SendResult = {
  sent: number
  failed: number
  no_address: number
  mails: number
}

export type StageResult = {
  stage: 'PROCESSING' | 'ENGINEER_REVIEW' | 'APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED'
  approval_id?: number | null
}

/** 문서 읽기 단계 안의 세부 진행 (처리 상태 화면). AI 일만 줄 수가 있다. */
export type StepDetail = {
  part: 'classify' | 'structure' | 'extract' | 'label' | 'save' | 'type'
  done: number | null
  total: number | null
  file_index: number
  file_count: number
}

export type SubmissionCheck = {
  deviation_candidates: number
  deviation_listed: number
  missing_judgment_ids: number[]
  open_queries: number
  ar_codes: string[]
  checked_at?: string | null
}

export type Submit = {
  actor_id?: number | null
  approver_id?: number | null
  comment?: string | null
}

export type SubmitResult = {
  stage: 'PROCESSING' | 'ENGINEER_REVIEW' | 'APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED'
  approval_id: number
  criteria: Criterion[]
}

export type TaskStatus = {
  status: string
  actor_id: number
  reply_note?: string | null
}

export type Tbe = {
  file_name: string
  review_no: string
  project_name: string | null
  review_name: string | null
  rows: TbeRow[]
  counts: TbeCounts
}

export type TbeCounts = {
  rows: number
  comply: number
  deviation: number
  query: number
  review: number
  candidates: number
  no_location: number
}

export type TbeRow = {
  no: number
  judgment_id: number
  result: 'COMPLY' | 'DEVIATION_CANDIDATE' | 'QUERY_CANDIDATE' | 'NEEDS_REVIEW' | 'WARRANTY_TO_FILL'
  item: string
  item_ko: string | null
  requirement: string
  verdict: string
  offered: string
  confirmed: boolean
  assumed: boolean
  status: string
  file_name: string
  where: string
  source: string
}

export type TypeTag = {
  type_code: string
  is_primary: boolean
  decided_by: 'RULE' | 'AI' | 'HUMAN'
  rule_code: string | null
}

export type User = {
  user_id: number
  user_name: string
  role: 'ENGINEER' | 'COST' | 'QUALITY' | 'SALES' | 'APPROVER'
}

export type ValidationError = {
  loc: (string | number)[]
  msg: string
  type: string
  input?: unknown
  ctx?: Record<string, unknown>
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
  source_kind: 'PM' | 'FIXED' | 'ENGINEER' | null
  product_code: string | null
  pm_column: string | null
  fixed_key: string | null
  status: 'CANDIDATE' | 'EMPTY_REVIEW' | 'CONFIRMED' | 'REJECTED'
  reason_code: string | null
  is_assumed: boolean
  locations: Location[]
}
