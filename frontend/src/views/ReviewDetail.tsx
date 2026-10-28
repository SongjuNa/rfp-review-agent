import { useEffect, useState } from 'react'
import { api, type RunSummary, type User } from '../api'
import { Badge, ErrorText } from '../components/common'
import { dday, dueText, reviewTitle } from '../components/format'
import { STAGE_NAMES, STAGE_TONES, STEP_NAMES } from '../components/labels'
import { useLoad } from '../components/useLoad'
import { useCrumbTail } from '../shell/crumb'
import { usePageCss } from '../shell/pageCss'
import { useSession } from '../shell/useSession'
import { Approval, History } from './Approval'
import { Checks, Judgments, Losses, WarrantyView } from './Compliance'
import { Requirements, Risks } from './Findings'
import { Outputs, Proposals } from './Outputs'
import { ReviewInfoDialog } from './ReviewInfoDialog'
import { SubmitDialog } from './SubmitDialog'
import { WaitView } from './WaitView'

// SCR-08 검토 상세 (목업 v4.57 Detail). 머리글(검토 정보)과 결재 상신 창(SCR-08-10)은 목업대로 만들고,
// 탭 내용은 예전 화면을 그대로 둔다. 탭은 update-review-screens에서 목업대로 바꾼다.
// 승인 대기인 검토는 SCR-12 결재 대기 화면(WaitView)으로 보인다.

const TABS = [
  ['requirements', '요구사항'], ['risks', '위험 조건'], ['judgments', '적합성 판정'], ['checks', '공학 검산'], ['warranty', '보증값'],
  ['losses', '손실 환산'], ['outputs', '일탈·질의 목록'], ['proposals', '제안 포인트'], ['approval', '승인'],
  ['history', '이력'],
] as const
type Tab = (typeof TABS)[number][0]

function RunStatus({ run }: { run: RunSummary }) {
  return (
    <div className="status" role="status">
      <strong>검토 #{run.run_id}</strong>
      <Badge tone={run.stage === 'FAILED' ? 'bad' : run.stage === 'APPROVED' ? 'ok' : ''}>{STAGE_NAMES[run.stage]}</Badge>
      {run.stage === 'PROCESSING' && <span>현재 단계: {STEP_NAMES[run.step ?? ''] ?? run.step}</span>}
      {run.stage === 'FAILED' && <span className="error">{run.error_message} (실패 단계: {STEP_NAMES[run.failed_step ?? ''] ?? run.failed_step})</span>}
      <span className="sub">문서 {run.documents} · 요구사항 {run.requirements} · 위험 조건 {run.risks} · 판정 {run.judgments}
        · 일탈 후보 {run.deviation_candidates} · 검산 위반 {run.check_violations} · 목록 {run.output_items} · 제안 {run.proposals}</span>
    </div>
  )
}

function RunView({ run, user, onChanged, initialTab }: {
  run: RunSummary; user: User | null; onChanged: () => void; initialTab: Tab
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const runId = run.run_id
  const changed = onChanged
  const props = { runId, actorId: user?.user_id ?? null, editable: run.stage === 'ENGINEER_REVIEW', onChanged: changed }
  const ready = !['PROCESSING', 'FAILED'].includes(run.stage)
  return (
    <div>
      <RunStatus run={run} />
      {ready && (
        <>
          <nav className="tabs" role="tablist">
            {TABS.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key}
                className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
            ))}
          </nav>
          <div key={`${tab}-${run.stage}`}>
            {tab === 'requirements' && <Requirements {...props} />}
            {tab === 'risks' && <Risks {...props} />}
            {tab === 'judgments' && <Judgments {...props} />}
            {tab === 'checks' && <Checks {...props} />}
            {tab === 'warranty' && <WarrantyView {...props} />}
            {tab === 'losses' && <Losses {...props} />}
            {tab === 'outputs' && <Outputs {...props} />}
            {tab === 'proposals' && <Proposals {...props} />}
            {tab === 'approval' && <Approval runId={runId} user={user} onChanged={changed} />}
            {tab === 'history' && <History runId={runId} />}
          </div>
        </>
      )}
    </div>
  )
}

// 결재 상신 버튼 문구 (목업 apBtnLabel). 승인됨은 제출본이 없어 "결재 완료"로 쓴다
const SUBMIT_LABELS: Record<string, string> = { ENGINEER_REVIEW: '결재 상신', APPROVAL: '결재 대기 중', APPROVED: '결재 완료' }

/** 머리글: 검토 번호·단계·마감, 제목(사업명 · 검토명), 사업·문서·고객사·담당 줄, 검토 정보 고치기 */
function ReviewHeader({ run, approver, onEdit, onSubmit }: {
  run: RunSummary; approver: string | null; onEdit: () => void; onSubmit: () => void
}) {
  const due = run.due_date ? dday(run.due_date) : null
  const place = [run.customer_name, run.country].filter(Boolean).join(' · ')
  return (
    <>
      <div className="idl">
        <span>{run.review_no}</span>
        <span className={`st ${STAGE_TONES[run.stage]}`}>{STAGE_NAMES[run.stage]}</span>
        {run.due_date && due && <span>마감 {dueText(run.due_date)} <b className={due.cls}>{due.text}</b></span>}
      </div>
      <div className="ttl">
        <div style={{ minWidth: 0 }}>
          <h1>{reviewTitle(run)}</h1>
          <div className="idl" style={{ marginTop: 4 }}>
            {run.project_name && <><span>사업 {run.project_name}</span>·</>}
            <span>문서 {run.documents}개</span>
            {place && <>·<span>{place}</span></>}
            ·<span>담당 {run.engineer_name ?? '없음'}</span>
            {approver && <>·<span>결재자 {approver}</span></>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="bo" onClick={onEdit}>
            <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>edit</span>검토 정보 고치기</button>
          {SUBMIT_LABELS[run.stage] && (
            <button type="button" className={run.stage === 'ENGINEER_REVIEW' ? 'bp' : 'bo'} disabled={run.stage !== 'ENGINEER_REVIEW'}
              onClick={onSubmit}>{SUBMIT_LABELS[run.stage]}</button>
          )}
        </div>
      </div>
    </>
  )
}

export function ReviewDetail({ runId }: { runId: number }) {
  const { user } = useSession()
  const { data: run, error, reload } = useLoad(() => api.run(runId), [runId])
  const approval = useLoad(() => api.approval(runId), [runId, run?.stage])
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  usePageCss(run?.stage === 'APPROVAL' ? 'Wait' : 'Detail')
  useCrumbTail(run?.review_no)
  useEffect(() => {
    if (run?.stage !== 'PROCESSING') return
    const timer = setTimeout(reload, 2000)           // 처리 중이면 단계를 다시 본다
    return () => clearTimeout(timer)
  }, [run, reload])
  if (!run) return <main className="main"><ErrorText error={error} /></main>
  if (run.stage === 'APPROVAL') return <WaitView key={run.run_id} run={run} onChanged={reload} />
  const latest = approval.data?.approval
  return (
    <main className="main">
      <ReviewHeader run={run} approver={latest && latest.decision !== null ? latest.approver : null}
        onEdit={() => setEditing(true)} onSubmit={() => setSubmitting(true)} />
      {editing && <ReviewInfoDialog run={run} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload() }} />}
      {submitting && <SubmitDialog run={run} onClose={() => setSubmitting(false)} onDone={() => { setSubmitting(false); reload() }} />}
      <div className="legacy" style={{ marginTop: 20 }}>
        <RunView key={run.stage} run={run} user={user} onChanged={reload}
          initialTab={user?.role === 'APPROVER' ? 'approval' : 'judgments'} />
      </div>
    </main>
  )
}
