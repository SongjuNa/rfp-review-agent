"""API 응답 모델 (change update-api-contract, 명세 api-contract).

조회 함수(`pipeline/queries.py` 등)는 dict를 돌려주고, FastAPI가 이 모델로 검사해 내보낸다.
- 모르는 칸은 받지 않는다(extra="forbid"). 조회가 칸을 더하면 여기에도 더해야 테스트가 통과한다.
- 빈 값은 None 그대로 보낸다. 기본값으로 채우지 않는다 (CR-04).
- DB에서 NULL이 될 수 있는 칸은 `| None`. DB CHECK로 정해진 값은 Literal.
- 근거 응답(판정·보증값·손실·검산·일탈·질의·제안 포인트)의 원문 위치는 하나 이상 (CR-02·03).
- NUMERIC 칸은 JSON 숫자(float)로 보낸다.
모델 이름은 화면 타입 이름과 같다 (frontend/src/api.gen.ts로 만들어짐).
"""

from datetime import date, datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class Out(BaseModel):
    model_config = ConfigDict(extra="forbid")


Stage = Literal["PROCESSING", "ENGINEER_REVIEW", "APPROVAL", "APPROVED", "REJECTED", "FAILED"]
Role = Literal["ENGINEER", "COST", "QUALITY", "SALES", "APPROVER"]
JudgmentResult = Literal["COMPLY", "DEVIATION_CANDIDATE", "QUERY_CANDIDATE", "NEEDS_REVIEW",
                         "WARRANTY_TO_FILL"]
NumberCheck = Literal["OK", "MISMATCH"]
DraftedBy = Literal["CODE", "AI", "ENGINEER"]
TaskState = Literal["TODO", "DOING", "DONE"]


class Location(Out):
    """원문 위치: 파일 번호 + 절 또는 표 + 행 (CR-02). 절·표·항목·행은 있는 것만 있다."""
    file_no: int
    section_no: str | None
    section_title: str | None
    table_name: str | None
    item_no: str | None
    line_start: int | None
    line_end: int | None


# 근거 응답의 원문 위치: 하나 이상
Locations = Annotated[list[Location], Field(min_length=1)]


# ── 사용자·검토 실행 ─────────────────────────────────────────

class User(Out):
    user_id: int
    user_name: str
    role: Role


class ReviewFields(Out):
    """사람이 넣는 검토 정보 (add-review-info). 비어 있으면 null."""
    project_name: str | None
    review_name: str | None
    customer_name: str | None
    country: str | None
    due_date: date | None
    engineer_id: int | None


class StepDetail(Out):
    """문서 읽기 단계 안의 세부 진행 (처리 상태 화면). AI 일만 줄 수가 있다."""
    part: Literal["classify", "structure", "extract", "label", "save", "type"]
    done: int | None
    total: int | None
    file_index: int
    file_count: int


class RunSummary(ReviewFields):
    run_id: int
    review_no: str
    engineer_name: str | None
    stage: Stage
    dict_version: str
    llm_model: str | None
    step: str | None
    step_detail: StepDetail | None
    step_updated_at: datetime
    failed_step: str | None
    error_message: str | None
    started_at: datetime
    finished_at: datetime | None
    documents: int
    requirements: int
    risks: int
    judgments: int
    deviation_candidates: int
    output_items: int
    check_violations: int
    proposals: int


class RunListItem(ReviewFields):
    run_id: int
    review_no: str
    engineer_name: str | None
    stage: Stage
    step: str | None
    step_detail: StepDetail | None
    step_updated_at: datetime
    failed_step: str | None
    error_message: str | None
    started_at: datetime
    finished_at: datetime | None
    files: str | None
    requirements: int
    risks: int
    deviation_candidates: int
    proposals: int


class RunDocument(Out):
    document_id: int
    file_no: int
    file_name: str
    bundle: Literal["A", "B", "C", "D"]
    doc_kind: str
    language: str
    standard_system: str | None
    judge_target: bool
    readable: bool
    classify_by: str | None
    needs_review: bool
    line_basis: str | None
    requirements: int


class DocumentPair(Out):
    pair_id: int
    file_no_a: int
    file_no_b: int
    relation: str
    status: str
    evidence: str | None


# ── 요구사항·위험 조건 ──────────────────────────────────────

class TypeTag(Out):
    type_code: str
    is_primary: bool
    decided_by: Literal["RULE", "AI", "HUMAN"]
    rule_code: str | None


class ReqValue(Out):
    value_seq: int
    raw_text: str | None
    cell_form: str
    num_value: float | None
    operator: str | None
    unit_raw: str | None
    cond_time_s: float | None
    cond_raw: str | None
    item_key: str | None
    target_object: str | None
    basis_standard: str | None
    delegated_std: str | None
    equipment_key: str | None
    flag: str | None


class Requirement(Out):
    """요구사항. 목록(문서 읽기 점검)은 원문 위치가 없는 줄도 보여 준다."""
    requirement_id: int
    file_no: int
    file_name: str
    source_kind: str
    req_kind: str
    text_raw: str
    extracted_by: Literal["RULE", "AI"]
    confidence: float | None
    is_assumed: bool
    rule_id: str | None
    supplier_mark: str | None
    dedup_of: int | None
    locations: list[Location]
    types: list[TypeTag]
    values: list[ReqValue]


class RiskMember(Out):
    requirement_id: int
    text_raw: str
    value_raw: str | None
    locations: list[Location]


class Risk(Out):
    risk_id: int
    risk_kind: str
    status: str
    item_key: str | None
    item_name: str | None
    facts: str | None
    explanation_ai: str | None
    expression: str | None
    members: list[RiskMember]


# ── 판정 ────────────────────────────────────────────────────

class Judgment(Out):
    judgment_id: int
    requirement_id: int
    equipment_group: str
    result: JudgmentResult
    reason_code: str | None
    reason_text: str | None
    product_code: str | None
    product_selected_by: Literal["AUTO", "ENGINEER"] | None
    product_value_raw: str | None
    product_value_unit: str | None
    margin_value: float | None
    margin_kind: Literal["DIFF", "RATIO", "TIME_RATIO"] | None
    margin_direction: Literal["STRENGTH", "NOT_STRENGTH", "NOT_CALC"]
    is_assumed: bool
    review_status: Literal["CANDIDATE", "CONFIRMED", "EDITED", "REJECTED"]
    req_value_raw: str | None
    req_num: float | None
    unit_raw: str | None
    cond_time_s: float | None
    item_key: str | None
    item_name: str | None
    item_name_raw: str | None
    type_code: str | None
    type_name: str | None
    locations: Locations


class JudgmentCounts(Out):
    by_result: dict[JudgmentResult, int]
    total: int
    unconfirmed: int
    unconfirmed_comply: int


class Equipment(Out):
    equipment_group: str
    label: str | None
    family: str | None
    products: list[str] | None
    selected_by: str | None
    chosen_product: str | None
    candidates: list[str]
    judgments: int
    deviations: int
    ambiguous: int


class ProductSwitch(Out):
    """비교 제품 바꾸기 뒤 다시 만든 줄 수."""
    judgment_count: int
    check_count: int
    warranty_count: int
    loss_count: int
    output_count: int
    proposal_count: int
    assignment_count: int


# ── 보증값·손실·검산·산출물·제안 포인트 ──────────────────────

class Warranty(Out):
    candidate_id: int
    judgment_id: int
    requirement_id: int
    equipment_group: str
    item_key: str | None
    item_name: str | None
    item_name_raw: str | None
    candidate_value: str | None
    candidate_unit: str | None
    source_kind: Literal["PM", "FIXED", "ENGINEER"] | None
    product_code: str | None
    pm_column: str | None
    fixed_key: str | None
    status: Literal["CANDIDATE", "EMPTY_REVIEW", "CONFIRMED", "REJECTED"]
    reason_code: str | None
    is_assumed: bool
    locations: Locations


class LossAmounts(Out):
    """종류별 가산액 (단가 × 손실값). 손실값이 없으면 null."""
    noload: float | None
    load: float | None
    aux: float | None


class Loss(Out):
    loss_calc_id: int
    requirement_id: int
    product_code: str | None
    price_noload: float
    price_load: float
    price_aux: float
    price_unit: str | None
    loss_noload_kw: float | None
    loss_load_kw: float | None
    loss_aux_kw: float | None
    total_usd: float | None
    formula: str | None
    status: Literal["CALCULATED", "NEEDS_REVIEW"]
    reason_code: str | None
    is_assumed: bool
    price_requirement_ids: list[int] | None
    amounts: LossAmounts
    locations: Locations
    price_locations: list[Location]


class LossResult(Out):
    """손실값을 넣고 다시 계산한 결과. 사람이 넣은 값이라 항상 팀 가정 (CR-06)."""
    total_usd: float | None
    formula: str | None
    status: Literal["CALCULATED", "NEEDS_REVIEW"]
    is_assumed: Literal[True]


class EngineeringCheck(Out):
    check_id: int
    rule_code: str
    result: Literal["PASS", "VIOLATION", "NEEDS_REVIEW"]
    reason_code: str | None
    expected_ka: float | None
    factor: float | None
    requirement_id: int
    ik_requirement_id: int
    peak_item_key: str
    peak_ka: float
    peak_raw: str | None
    ik_item_key: str
    ik_ka: float
    ik_raw: str | None
    frequency_hz: float | None
    locations: Locations
    ik_locations: list[Location]


class OutputSource(Out):
    source_seq: int
    judgment_id: int | None
    risk_id: int | None
    check_id: int | None
    requirement_id: int | None


class OutputItem(Out):
    item_id: int
    list_kind: Literal["DEVIATION", "QUERY"]
    list_name: str | None
    text_draft: str
    number_check: NumberCheck
    number_detail: str | None
    drafted_by: DraftedBy
    status: Literal["DRAFT", "CONFIRMED", "REMOVED"]
    is_assumed: bool
    basis_requirement_id: int | None
    sources: list[OutputSource]
    locations: Locations
    linked_items: list[int]


class Proposal(Out):
    point_id: int
    point_kind: Literal["MARGIN", "LOSS", "FIELD"]
    requirement_id: int
    product_code: str | None        # 현장 이력(FIELD)은 제품 행 대신 연결표 줄이 근거
    judgment_id: int | None
    loss_calc_id: int | None
    fault_link_id: int | None
    text_draft: str
    basis: str | None
    number_check: NumberCheck
    number_detail: str | None
    drafted_by: DraftedBy
    is_assumed: bool
    status: Literal["CANDIDATE", "ADOPTED", "DISCARDED", "EDITED"]
    locations: Locations


class SubmissionCheck(Out):
    deviation_candidates: int
    deviation_listed: int
    missing_judgment_ids: list[int]
    open_queries: int
    ar_codes: list[str]
    checked_at: datetime | None = None      # 저장된 확인 결과에만 있음


# ── TBE·데이터시트 ──────────────────────────────────────────

class TbeRow(Out):
    no: int
    judgment_id: int
    result: JudgmentResult
    item: str
    item_ko: str | None
    requirement: str
    verdict: str
    offered: str
    confirmed: bool
    assumed: bool
    status: str
    file_name: str
    where: str
    source: str


class TbeCounts(Out):
    rows: int
    comply: int
    deviation: int
    query: int
    review: int
    candidates: int
    no_location: int


class Tbe(Out):
    file_name: str
    review_no: str
    project_name: str | None
    review_name: str | None
    rows: list[TbeRow]
    counts: TbeCounts


class DatasheetInfo(Out):
    table_id: int
    table_name: str
    file_name: str
    rows: int
    empty: int


class DatasheetRow(Out):
    judgment_id: int
    candidate_id: int | None
    target: Literal["judgment", "warranty"]
    no: str
    item: str
    item_en: str
    unit: str
    requirement: str
    value: str | None
    basis: str
    why: str
    state: Literal["ok", "cand", "empty"]
    status: str
    assumed: bool


class DatasheetCounts(Out):
    rows: int
    ok: int
    cand: int
    empty: int


class Datasheet(Out):
    file_name: str
    review_no: str
    table_id: int
    table_name: str
    source_file: str
    rows: list[DatasheetRow]
    counts: DatasheetCounts


# ── 확인·결재 ───────────────────────────────────────────────

class ActionResult(Out):
    """확정·수정·반려 하나. 바뀌기 전·후 줄은 대상 표마다 칸이 달라 자유 형식이다."""
    before: dict[str, Any] | None
    after: dict[str, Any] | None
    submission_check: SubmissionCheck | None


class BulkResult(Out):
    confirmed: int
    submission_check: SubmissionCheck | None


class LogEntry(Out):
    log_id: int
    target_table: str
    target_id: int
    action: str
    before_value: dict[str, Any] | None
    after_value: dict[str, Any] | None
    reason: str | None
    actor: str | None
    acted_at: datetime
    target_label: str | None   # 바뀐 대상의 이름. 검토 실행·비교 제품은 null


class Criterion(Out):
    ar_code: str
    detail: str
    description: str | None = None      # 결재 화면의 사유에만 있음


class Approval(Out):
    approval_id: int
    decision: Literal["APPROVED", "REJECTED", "WITHDRAWN"] | None
    comment: str | None
    requested_at: datetime
    decided_at: datetime | None
    approver_id: int | None
    approver: str | None
    requested_by_id: int | None
    requested_by: str | None
    request_comment: str | None


class ReviewRatio(Out):
    review: int
    total: int
    threshold: float


class ApprovalScreen(Out):
    stage: Stage
    approval: Approval | None
    reasons: list[Criterion]
    preview: list[Criterion] | None
    review_ratio: ReviewRatio
    submission_check: SubmissionCheck | None
    read_unchecked: int     # 문서 읽기 점검 미확인 수


class DecisionResult(ApprovalScreen):
    approval_id: int


class SubmitResult(Out):
    stage: Stage
    approval_id: int
    criteria: list[Criterion]


class StageResult(Out):
    stage: Stage
    approval_id: int | None = None


class ReadCheck(Out):
    """문서 읽기 점검 줄 (SCR-08-2). kind: 표·그림·단위·위치."""
    key: str
    kind: str
    what: str
    document_id: int
    file_name: str
    loc: str
    line: int | None
    problem: str
    todo: str
    checked_by: str | None
    checked_at: datetime | None


class DeliverableProposal(Out):
    point_id: int
    point_kind: str
    text_draft: str
    basis: str | None
    is_assumed: bool
    status: str


class DeliverableOutput(Out):
    item_id: int
    list_kind: Literal["DEVIATION", "QUERY"]
    list_name: str | None
    text_draft: str
    status: str
    is_assumed: bool


class DeliverableWarranty(Out):
    candidate_id: int
    judgment_id: int
    candidate_value: str | None
    candidate_unit: str | None
    source_kind: str | None


class Deliverables(Out):
    proposals: list[DeliverableProposal]
    outputs: list[DeliverableOutput]
    warranty: list[DeliverableWarranty]


# ── 할 일 ───────────────────────────────────────────────────

class Assignment(Out):
    assignment_id: int
    run_id: int
    assignee_role: Literal["ENGINEER", "COST", "QUALITY", "SALES"]
    status: TaskState
    repeat_count: int
    sent_at: datetime
    updated_at: datetime | None
    requirement_id: int | None
    requirement_ids: list[int]
    point_id: int | None
    point_kind: str | None
    point_requirement_id: int | None
    type_code: str | None
    type_name: str | None
    assignee: str | None
    text: str
    is_assumed: bool | None
    stage: Stage
    review_no: str
    project_name: str | None
    review_name: str | None
    customer_name: str | None
    country: str | None
    due_date: date | None
    engineer_id: int | None
    engineer_name: str | None
    locations: list[Location]
    file_name: str | None


class ReviewCard(RunListItem):
    summary: RunSummary
    criteria: list[Criterion]
    approval: Approval | None = None


class MyTasks(Out):
    role: Role
    reviews: list[ReviewCard]
    assignments: list[Assignment]


class AssignmentStatus(Out):
    assignment_id: int
    status: TaskState


# ── 기준 데이터 (제품표·규칙 사전) ──────────────────────────

class Product(Out):
    """제품표 한 줄 (add-reference-views). 빈 칸은 null 그대로 (CR-04)."""
    product_code: str
    product_name: str
    family: str
    rated_voltage_kv: float | None
    rated_current_a: float | None
    short_circuit_ka: float | None
    rated_frequency: str | None
    rated_capacity: float | None
    rated_capacity_unit: str | None
    weight_kg: float | None
    noload_loss_kw: float | None
    load_loss_kw: float | None
    aux_loss_kw: float | None
    loss_is_assumed: bool | None
    is_assumed: bool
    is_design_card: bool
    source_doc: str | None
    lifecycle_status: str | None
    used: int
    value_columns: list[str]        # 이 제품군에서 판정에 쓰는 칸
    empty_columns: list[str]
    empty_count: int


class ProductUse(Out):
    run_id: int
    review_no: str
    project_name: str | None
    review_name: str | None
    judgment_id: int
    equipment_group: str
    item_name: str | None
    result: JudgmentResult
    product_selected_by: str | None


class ProductProposal(Out):
    point_id: int
    run_id: int
    point_kind: str
    status: str
    text_draft: str | None
    is_assumed: bool


class FieldHistory(Out):
    fault_link_id: int
    item_key: str
    item_name: str
    fault_id: str
    symptom: str | None
    root_cause: str | None
    action: str | None
    confirmed_by: str | None
    cases: int


class ProductDetail(Product):
    """제품 하나. 제품표의 모든 칸이 함께 오고, 칸 이름은 제품표 CSV를 따른다."""
    model_config = ConfigDict(extra="allow")
    used_runs: int
    used_in: list[ProductUse]
    proposals: list[ProductProposal]
    field_history: list[FieldHistory]


class ProductFamily(Out):
    family: str
    products: int
    with_empty: int
    empty_cells: int
    assumed: int
    design_cards: int


class CompareRule(Out):
    compare_rule_id: int
    table_name: str | None
    item_no: str | None
    item_key: str | None
    name_ko: str | None
    direction: str
    time_condition: bool
    strength_direction: str | None
    process_note: str | None
    used: int


class ItemKey(Out):
    item_key: str
    name_ko: str
    default_direction: str
    strength_direction: str
    note: str | None
    pm_column: str | None
    fixed_key: str | None
    aliases: list[str]
    used: int


class RiskExpression(Out):
    expr_id: int
    expression: str
    language: str
    risk_kind: str
    context_rule: str
    used: int
