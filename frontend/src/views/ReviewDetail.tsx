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

// SCR-08 검토 상세 (목업 v4.57 Detail). 이번에는 머리글(검토 정보)만 목업대로 만들고,
// 탭 내용은 예전 화면을 그대로 둔다. 탭은 update-review-screens에서 목업대로 바꾼다.

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

/** 머리글: 검토 번호·단계·마감, 제목(사업명 · 검토명), 사업·문서·고객사·담당 줄, 검토 정보 고치기 */
function ReviewHeader({ run, onEdit }: { run: RunSummary; onEdit: () => void }) {
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
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="bo" onClick={onEdit}>
            <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>edit</span>검토 정보 고치기</button>
        </div>
      </div>
    </>
  )
}

export function ReviewDetail({ runId }: { runId: number }) {
  usePageCss('Detail')
  const { user } = useSession()
  const { data: run, error, reload } = useLoad(() => api.run(runId), [runId])
  const [editing, setEditing] = useState(false)
  useCrumbTail(run?.review_no)
  useEffect(() => {
    if (run?.stage !== 'PROCESSING') return
    const timer = setTimeout(reload, 2000)           // 처리 중이면 단계를 다시 본다
    return () => clearTimeout(timer)
  }, [run, reload])
  if (!run) return <main className="main"><ErrorText error={error} /></main>
  return (
    <main className="main">
      <ReviewHeader run={run} onEdit={() => setEditing(true)} />
      {editing && <ReviewInfoDialog run={run} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload() }} />}
      <div className="legacy" style={{ marginTop: 20 }}>
        <RunView key={run.stage} run={run} user={user} onChanged={reload}
          initialTab={user?.role === 'APPROVER' ? 'approval' : 'judgments'} />
      </div>
    </main>
  )
}
