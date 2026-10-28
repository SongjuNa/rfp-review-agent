import { useEffect, useState, type ReactNode } from 'react'
import { api, type Health, type RunSummary, type User } from './api'
import { Badge, ErrorText } from './components/common'
import { STAGE_NAMES, STEP_NAMES } from './components/labels'
import { useLoad } from './components/useLoad'
import { Approval, History } from './views/Approval'
import { Checks, Judgments, Losses, WarrantyView } from './views/Compliance'
import { Requirements, Risks } from './views/Findings'
import { Outputs, Proposals } from './views/Outputs'
import { MyTasks } from './views/Tasks'
import { ALL_ITEMS, itemOf, type MenuKey } from './shell/menu'
import { href, navigate, useHashPath } from './shell/router'
import { useSession } from './shell/useSession'
import { Shell, type Crumb } from './shell/Shell'

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

/** RFP 검토: 예전 탭 화면을 새 틀 안에 그대로 둔다. SCR-06·SCR-08을 목업대로 만들 때 바꾼다. */
function Reviews({ runId }: { runId: number | null }) {
  const health = useLoad(() => api.health(), [])
  const runs = useLoad(() => api.runs(), [])
  const { user } = useSession()
  return (
    <div className="legacy">
      <div className="ttl"><h1>{runId === null ? '검토 목록' : `검토 #${runId}`}</h1><HealthLine health={health.data} /></div>
      <ErrorText error={health.error && `백엔드에 연결할 수 없습니다 (${health.error})`} />
      <div className="lgrid">
        <aside>
          <StartRun onStarted={(id) => { runs.reload(); navigate(`/reviews/${id}`) }} />
          <h2>검토 목록</h2>
          <ul className="runs">
            {runs.data?.map((r) => (
              <li key={r.run_id}>
                <a className={'run' + (r.run_id === runId ? ' active' : '')} href={href(`/reviews/${r.run_id}`)}>
                  #{r.run_id} <Badge>{STAGE_NAMES[r.stage]}</Badge>
                  <span className="sub">{r.files}</span>
                </a>
              </li>
            ))}
          </ul>
        </aside>
        <main>
          {runId === null ? <p>왼쪽에서 검토를 고르거나 새로 시작하세요.</p> : (
            <RunView key={runId} runId={runId} user={user} onChanged={runs.reload}
              initialTab={user?.role === 'APPROVER' ? 'approval' : 'judgments'} />
          )}
        </main>
      </div>
    </div>
  )
}

/** 협조 요청(내 할 일): 예전 화면을 새 틀 안에 그대로 둔다. SCR-13을 목업대로 만들 때 바꾼다. */
function Todo() {
  const { user } = useSession()
  return (
    <div className="legacy">
      <div className="ttl"><h1>협조 요청</h1></div>
      <main><MyTasks user={user} onOpen={(id) => navigate(`/reviews/${id}`)} /></main>
    </div>
  )
}

/** 아직 만들지 않은 화면 자리. 목업 순서대로 하나씩 채운다 (docs/screens/README.md 1장). */
function NotYet({ menu }: { menu: MenuKey }) {
  const item = itemOf(menu)
  return (
    <main className="main">
      <div className="ttl"><h1>{item.label}</h1></div>
      <div className="ronote todo-scr" role="note">
        <span className="ms" aria-hidden="true">construction</span>
        <span><b>{item.scr} {item.label}</b> 화면은 아직 만들지 않았습니다. 목업 v4.57 순서대로 만들 예정입니다.</span>
      </div>
    </main>
  )
}

type Route = { menu: MenuKey; crumbs: Crumb[]; body: ReactNode }

/** 화면 주소 → 화면 (docs/screens/SCR-00-앱틀.md 2장). */
function route(path: string): Route {
  const home: Crumb = { label: '홈', path: '/' }
  const review = path.match(/^\/reviews\/(\d+)/)
  if (review) {
    const id = Number(review[1])
    return { menu: 'reviews', crumbs: [home, { label: 'RFP 검토', path: '/reviews' }, { label: `검토 #${id}` }], body: <Reviews runId={id} /> }
  }
  if (path === '/reviews') {
    return { menu: 'reviews', crumbs: [home, { label: 'RFP 검토', path: '/reviews' }, { label: '검토 목록' }], body: <Reviews runId={null} /> }
  }
  if (path === '/todo') {
    return { menu: 'todo', crumbs: [home, { label: '협조 요청' }], body: <Todo /> }
  }
  const item = ALL_ITEMS.find((i) => i.path === path) ?? itemOf('home')
  const crumbs = item.key === 'home' ? [{ label: '홈' }] : [home, { label: item.label }]
  return { menu: item.key, crumbs, body: <NotYet menu={item.key} /> }
}

export default function App() {
  const path = useHashPath()
  const { menu, crumbs, body } = route(path)
  return <Shell active={menu} crumbs={crumbs}>{body}</Shell>
}
