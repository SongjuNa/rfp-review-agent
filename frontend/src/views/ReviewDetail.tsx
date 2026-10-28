import { useEffect, useState } from 'react'
import { api, type RunSummary } from '../api'
import { Badge, ErrorText } from '../components/common'
import { dday, dueText, reviewTitle } from '../components/format'
import { STAGE_NAMES, STAGE_TONES, STEP_NAMES } from '../components/labels'
import { useLoad } from '../components/useLoad'
import { useCrumbTail } from '../shell/crumb'
import { usePageCss } from '../shell/pageCss'
import { DetailBody, DetailTabs, type DetailTab } from './detail/DetailBody'
import { ProductSeg } from './detail/ProductSeg'
import { ReviewInfoDialog } from './ReviewInfoDialog'
import { SubmitDialog } from './SubmitDialog'
import { WaitView } from './WaitView'

// SCR-08 검토 상세 (목업 v4.57 Detail). 탭 줄, 머리글, 요약 칸과 탭 본문(detail/DetailBody), 결재 상신 창(SCR-08-10).
// 승인 대기인 검토는 SCR-12 결재 대기 화면(WaitView)으로 보인다.

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

/** 머리글: 검토 번호·단계·마감, 제목(사업명 · 검토명), 사업·문서·고객사·담당 줄, 검토 정보 고치기 */
function ReviewHeader({ run, approver, onEdit, onSwitched }: {
  run: RunSummary; approver: string | null; onEdit: () => void; onSwitched?: () => void
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
          {onSwitched && <ProductSeg run={run} onSwitched={onSwitched} />}
        </div>
      </div>
    </>
  )
}

export function ReviewDetail({ runId }: { runId: number }) {
  const { data: run, error, reload } = useLoad(() => api.run(runId), [runId])
  const approval = useLoad(() => api.approval(runId), [runId, run?.stage])
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [tab, setTab] = useState<DetailTab>('judge')
  const [version, setVersion] = useState(0)          // 비교 제품을 바꾸면 탭 본문을 새로 불러온다
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
  const ready = !['PROCESSING', 'FAILED'].includes(run.stage)
  return (
    <main className="main">
      {ready && <DetailTabs tab={tab} onTab={setTab} />}
      <ReviewHeader run={run} approver={latest && latest.decision !== null ? latest.approver : null} onEdit={() => setEditing(true)}
        onSwitched={ready ? () => { setVersion((v) => v + 1); reload() } : undefined} />
      {editing && <ReviewInfoDialog run={run} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload() }} />}
      {submitting && <SubmitDialog run={run} onClose={() => setSubmitting(false)} onDone={() => { setSubmitting(false); reload() }} />}
      {ready
        ? <DetailBody key={`${run.stage}-${version}`} run={run} tab={tab} onChanged={reload} onSubmit={() => setSubmitting(true)} />
        : <div className="legacy" style={{ marginTop: 20 }}><RunStatus run={run} /></div>}
    </main>
  )
}
