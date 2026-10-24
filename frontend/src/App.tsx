import { useEffect, useState } from 'react'
import { api, type Health, type RunSummary, type User } from './api'
import { Badge, ErrorText } from './components/common'
import { STAGE_NAMES, STEP_NAMES } from './components/labels'
import { useLoad } from './components/useLoad'
import { Approval, History } from './views/Approval'
import { Checks, Judgments, Losses, WarrantyView } from './views/Compliance'
import { Requirements, Risks } from './views/Findings'
import { Outputs, Proposals } from './views/Outputs'
import { MyTasks } from './views/Tasks'

const TABS = [
  ['requirements', '요구사항'], ['risks', '위험 조건'], ['judgments', '적합성 판정'], ['checks', '공학 검산'], ['warranty', '보증값'],
  ['losses', '손실 환산'], ['outputs', '일탈·질의 목록'], ['proposals', '제안 포인트'], ['approval', '승인'],
  ['history', '이력'],
] as const
type Tab = (typeof TABS)[number][0]

function HealthLine({ health }: { health: Health | null }) {
  if (!health) return null
  return (
    <span className="sub">
      DB {health.database === 'ok' ? '정상' : '연결 안 됨'} · 언어 모델 키 {health.llm_configured ? '있음' : '없음 (코드 규칙만)'}
    </span>
  )
}

function StartRun({ onStarted }: { onStarted: (id: number) => void }) {
  const library = useLoad(() => api.library(), [])
  const [files, setFiles] = useState<File[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const start = (p: Promise<RunSummary>) => {
    setBusy(true)
    setError(null)
    p.then((r) => { setFiles([]); setPicked([]); onStarted(r.run_id) }, (e: Error) => setError(e.message))
      .finally(() => setBusy(false))
  }
  return (
    <section className="start">
      <h2>검토 시작</h2>
      <form onSubmit={(e) => { e.preventDefault(); start(api.upload(files)) }}>
        <label>docx 올리기 <input type="file" accept=".docx" multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /></label>
        <button type="submit" disabled={busy || files.length === 0}>올려서 시작</button>
      </form>
      {(library.data?.length ?? 0) > 0 && (
        <form onSubmit={(e) => { e.preventDefault(); start(api.startLibrary(picked)) }}>
          <label>서버에 둔 RFP
            <select multiple size={6} value={picked} aria-label="서버에 둔 RFP"
              onChange={(e) => setPicked(Array.from(e.target.selectedOptions, (o) => o.value))}>
              {library.data!.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy || picked.length === 0}>골라서 시작</button>
        </form>
      )}
      <ErrorText error={error} />
    </section>
  )
}

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

function RunView({ runId, user, onChanged, initialTab }: {
  runId: number; user: User | null; onChanged: () => void; initialTab: Tab
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const { data: run, error, reload } = useLoad(() => api.run(runId), [runId])
  const stage = run?.stage
  useEffect(() => {
    if (stage && stage !== 'PROCESSING') onChanged()   // 처리가 끝나면 왼쪽 목록의 단계도 바꾼다
  }, [stage, onChanged])
  useEffect(() => {
    if (run?.stage !== 'PROCESSING') return
    const timer = setTimeout(reload, 2000)           // 처리 중이면 단계를 다시 본다
    return () => clearTimeout(timer)
  }, [run, reload])
  if (!run) return <ErrorText error={error} />
  const changed = () => { reload(); onChanged() }
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

export default function App() {
  const health = useLoad(() => api.health(), [])
  const users = useLoad(() => api.users(), [])
  const runs = useLoad(() => api.runs(), [])
  const [userId, setUserId] = useState<number | null>(null)
  const [runId, setRunId] = useState<number | null>(null)
  const [mode, setMode] = useState<'review' | 'tasks'>('review')
  const user = users.data?.find((u) => u.user_id === userId) ?? users.data?.[0] ?? null
  return (
    <div className="app">
      <header className="top">
        <h1>RFP 기술 검토 지원</h1>
        <span className="tagline">지킬 조건은 빠짐없이, 내세울 강점은 근거와 함께.</span>
        <HealthLine health={health.data} />
        <label className="user">사용자
          <select value={user?.user_id ?? ''} onChange={(e) => setUserId(Number(e.target.value))}>
            {users.data?.map((u) => <option key={u.user_id} value={u.user_id}>{u.user_name} ({u.role})</option>)}
          </select>
        </label>
        <nav className="tabs" aria-label="화면">
          <button type="button" className={mode === 'review' ? 'active' : ''} aria-pressed={mode === 'review'}
            onClick={() => setMode('review')}>검토</button>
          <button type="button" className={mode === 'tasks' ? 'active' : ''} aria-pressed={mode === 'tasks'}
            onClick={() => setMode('tasks')}>내 할 일</button>
        </nav>
      </header>
      <ErrorText error={health.error && `백엔드에 연결할 수 없습니다 (${health.error})`} />
      <div className="layout">
        <aside>
          <StartRun onStarted={(id) => { setRunId(id); runs.reload() }} />
          <h2>검토 목록</h2>
          <ul className="runs">
            {runs.data?.map((r) => (
              <li key={r.run_id}>
                <button type="button" className={r.run_id === runId ? 'active' : ''}
                  onClick={() => { setRunId(r.run_id); setMode('review') }}>
                  #{r.run_id} <Badge>{STAGE_NAMES[r.stage]}</Badge>
                  <span className="sub">{r.files}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main>
          {mode === 'tasks' ? (
            <MyTasks user={user} onOpen={(id) => { setRunId(id); setMode('review') }} />
          ) : runId === null ? <p>왼쪽에서 검토를 고르거나 새로 시작하세요.</p> : (
            <RunView key={runId} runId={runId} user={user} onChanged={runs.reload}
              initialTab={user?.role === 'APPROVER' ? 'approval' : 'judgments'} />
          )}
        </main>
      </div>
    </div>
  )
}
