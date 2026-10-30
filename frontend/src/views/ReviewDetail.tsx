import { useEffect, useState } from 'react'
import { api, type RunSummary } from '../api'
import { ErrorText } from '../components/common'
import { judgedBundles } from '../components/documents'
import { dday, dueText, reviewTitle } from '../components/format'
import { STAGE_NAMES, STAGE_TONES } from '../components/labels'
import { useLoad } from '../components/useLoad'
import { useCrumbTail } from '../shell/crumb'
import { usePageCss } from '../shell/pageCss'
import { href } from '../shell/router'
import { DocumentsDialog } from './DocumentsDialog'
import { DetailBody, DetailTabs, type DetailTab } from './detail/DetailBody'
import { ProductSeg } from './detail/ProductSeg'
import { FailView } from './FailView'
import { ProcessingView } from './ProcessingView'
import { ReviewInfoDialog } from './ReviewInfoDialog'
import { SubmitDialog } from './SubmitDialog'
import { WaitView } from './WaitView'

// SCR-08 검토 상세 (목업 v4.57 Detail). 탭 줄, 머리글, 요약 칸과 탭 본문(detail/DetailBody), 결재 상신 창(SCR-08-10).
// 승인 대기인 검토는 SCR-12 결재 대기 화면(WaitView)으로 보인다.

/** 머리글: 검토 번호·단계·마감, 제목(사업명 · 검토명), 사업·문서(누르면 문서 표)·판정 묶음·고객사·담당 줄, 검토 정보 고치기 */
function ReviewHeader({ run, approver, onEdit, onSwitched }: {
  run: RunSummary; approver: string | null; onEdit: () => void; onSwitched?: () => void
}) {
  const due = run.due_date ? dday(run.due_date) : null
  const docs = useLoad(() => api.documents(run.run_id), [run.run_id, run.stage])
  const [docsOpen, setDocsOpen] = useState(false)
  const bundles = docs.data ? judgedBundles(docs.data) : null
  const ready = run.stage !== 'PROCESSING'
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
            {run.project_name && <>{run.business_no
              ? <a className="lnk" href={href(`/projects/${run.business_no}`)} title="사업 상세 보기">사업 {run.project_name}</a>
              : <span>사업 {run.project_name}</span>}·</>}
            {docs.data
              ? <button type="button" className="lnk hdoc" onClick={() => setDocsOpen(true)} title="문서 종류·묶음 보기">문서 {run.documents}개</button>
              : <span>문서 {run.documents}개</span>}
            {ready && bundles && <>·{bundles.length
              ? <span className="hbun">묶음 {bundles.join('·')}</span>
              : <span className="hbun warn" title="묶음 A·B 문서가 없어 판정하지 않았습니다">판정 문서 없음</span>}</>}
            {place && <>·<span>{place}</span></>}
            ·<span>담당 {run.engineer_name ?? '없음'}</span>
            {approver && <>·<span>결재자 {approver}</span></>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="bo" onClick={onEdit}>
            <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>edit</span>검토 정보 고치기</button>
        </div>
      </div>
      {onSwitched && <ProductSeg run={run} onSwitched={onSwitched} />}
      {docsOpen && docs.data && <DocumentsDialog run={run} docs={docs.data} onClose={() => setDocsOpen(false)} />}
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
  usePageCss(run?.stage === 'APPROVAL' ? 'Wait' : run?.stage === 'FAILED' ? 'Fail' : 'Detail')
  useCrumbTail(run?.review_no)
  useEffect(() => {
    if (run?.stage !== 'PROCESSING') return
    const timer = setTimeout(reload, 2000)           // 처리 중이면 단계를 다시 본다
    return () => clearTimeout(timer)
  }, [run, reload])
  if (!run) return <main className="main"><ErrorText error={error} /></main>
  if (run.stage === 'APPROVAL') return <WaitView key={run.run_id} run={run} onChanged={reload} />
  const latest = approval.data?.approval
  if (run.stage === 'FAILED') return <main className="main"><FailView run={run} approver={latest?.approver ?? null} /></main>
  const ready = run.stage !== 'PROCESSING'
  return (
    <main className="main">
      {ready && <DetailTabs run={run} tab={tab} onTab={setTab} />}
      <ReviewHeader run={run} approver={latest && latest.decision !== null ? latest.approver : null} onEdit={() => setEditing(true)}
        onSwitched={ready ? () => { setVersion((v) => v + 1); reload() } : undefined} />
      {editing && <ReviewInfoDialog run={run} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload() }} />}
      {submitting && <SubmitDialog run={run} onClose={() => setSubmitting(false)} onDone={() => { setSubmitting(false); reload() }} />}
      {ready
        ? <DetailBody key={`${run.stage}-${version}`} run={run} tab={tab} onChanged={reload} onSubmit={() => setSubmitting(true)} />
        : <ProcessingView run={run} />}
    </main>
  )
}
