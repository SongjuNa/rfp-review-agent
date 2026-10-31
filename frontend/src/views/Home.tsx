import { useState, type MouseEvent } from 'react'
import { api, type Assignment, type RunListItem, type User } from '../api'
import { daysLeft, dday, dueText, reviewTitle, stamp } from '../components/format'
import { progress } from '../components/progress'
import { ROLE_NAMES, STAGE_NAMES, STAGE_TONES, STEP_NAMES } from '../components/labels'
import { useLoad, useRepeat } from '../components/useLoad'
import { EVENTS, FILES, NOTICES, SYS_NOTICES } from '../examples/SCR-03'
import { href } from '../shell/router'
import { usePageCss } from '../shell/pageCss'
import { useSession } from '../shell/useSession'
import { ExampleBand } from './detail/ExampleTab'
import './detail.css'

// SCR-03 홈 (목업 v4.57 Home). docs/screens/SCR-03-홈.md
// 내 업무 수, 단계별·사업별 카드, 분석 실패 알림, 팀 업무는 실제 데이터. 공지·시스템 공지·자료실·행사는 게시판 API가 없어 예시 (SCR-03_공유.md).

type Col = 'an' | 'chk' | 'co' | 'ap' | 'sub'
type Filter = 'mine' | 'wait' | 'soon' | 'over'
const COLS: [Col, string, string][] = [['an', '분석 중', 'bd-dot'], ['chk', '판정 확인', 'bd-dot b'], ['co', '협조 대기', 'bd-dot o'], ['ap', '결재 대기', 'bd-dot n'], ['sub', '제출 준비', 'bd-dot g']]
const COL_CHIPS: Record<Col, string> = { an: 'st c-grey', chk: 'st c-blue', co: 'st c-ora', ap: 'st c-grey', sub: 'st c-green' }
const METRICS: [Filter, string, string, string, string][] = [
  ['mine', '내가 처리할 건', 'person', 'm-info', '내가 판정을 확인하거나 실패를 살펴야 하는 검토'],
  ['wait', '결재 대기', 'hourglass_top', 'm-wait', '결재자 확인을 기다리는 내 검토'],
  ['soon', '3일 내 마감', 'alarm', 'm-high', '오늘부터 3일 안에 마감되는 내 검토'],
  ['over', '마감 경과', 'event_busy', 'm-crit', '마감일이 지난 내 검토'],
]
const DAY = 86_400_000
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/** 협조 요청: 검토마다 아직 확인하지 않은 요청 수와 24시간 넘은 수 */
type Pending = { n: number; late: number }

function pendingByRun(lists: Assignment[][], now: number): Map<number, Pending> {
  const out = new Map<number, Pending>()
  for (const a of lists.flat()) {
    if (a.status === 'DONE') continue           // 회신 받지 않은 요청 (안 보냄·메일 보냄)
    const p = out.get(a.run_id) ?? { n: 0, late: 0 }
    p.n += 1
    if (now - new Date(a.sent_at).getTime() > DAY) p.late += 1
    out.set(a.run_id, p)
  }
  return out
}

/** 검토 단계 → 카드 열. 협조 요청이 남은 담당자 확인 검토는 "협조 대기" */
function colOf(r: RunListItem, pending: Map<number, Pending>): Col {
  if (r.stage === 'PROCESSING' || r.stage === 'FAILED') return 'an'
  if (r.stage === 'APPROVAL') return 'ap'
  if (r.stage === 'APPROVED') return 'sub'
  if (r.stage === 'ENGINEER_REVIEW' && pending.get(r.run_id)?.n) return 'co'
  return 'chk'
}

function left(r: RunListItem): number | null {
  if (!r.due_date || r.stage === 'APPROVED') return null
  return daysLeft(r.due_date)
}

const FILTERS: Record<Filter, (r: RunListItem) => boolean> = {
  mine: (r) => r.stage === 'ENGINEER_REVIEW' || r.stage === 'REJECTED' || r.stage === 'FAILED',
  wait: (r) => r.stage === 'APPROVAL',
  soon: (r) => { const n = left(r); return n !== null && n >= 0 && n <= 3 },
  over: (r) => { const n = left(r); return n !== null && n < 0 },
}

/** 목업 마감 칩: 지났거나 오늘이면 진한 빨강, 3일 이하 빨강, 7일 이하 주황 */
function ddCls(n: number | null): string {
  if (n === null) return 'dd neu'
  return 'dd ' + (n <= 0 ? 'neg hard pill-n' : n <= 3 ? 'neg pill-n' : n <= 7 ? 'crit pill-c' : 'neu')
}

function card(r: RunListItem, col: Col, pending: Map<number, Pending>): { lines: string[]; note: string; tone: string } {
  const p = pending.get(r.run_id)
  const found = `일탈 후보 ${r.deviation_candidates}건 · 위험 조건 ${r.risks}건`
  switch (r.stage) {
    case 'PROCESSING': return { lines: [`${STEP_NAMES[r.step ?? ''] ?? '처리'} ${progress(r)} %`, '처리 중'], note: '', tone: '' }
    case 'FAILED': return { lines: [`${STEP_NAMES[r.failed_step ?? ''] ?? '처리'}에서 멈춤`], note: '분석 실패', tone: 'red' }
    case 'REJECTED': return { lines: [`요구사항 ${r.requirements}줄`, found], note: '반려됨 · 다시 확인', tone: 'red' }
    case 'APPROVAL': return { lines: [found, '결재자 확인 중'], note: '', tone: '' }
    case 'APPROVED': return { lines: ['제출본 v1 확정', r.finished_at ? `처리 ${stamp(r.finished_at)}` : ''].filter(Boolean), note: '', tone: '' }
  }
  if (col === 'co' && p) {
    return { lines: [`요구사항 ${r.requirements}줄`, `협조 미확인 ${p.n}건`], note: p.late ? '24시간 넘게 미확인' : '', tone: 'ora' }
  }
  return { lines: [`요구사항 ${r.requirements}줄`, found], note: '', tone: '' }
}

const stop = (e: MouseEvent) => e.preventDefault()

export function Home() {
  usePageCss('Home')
  const { user, users } = useSession()
  const [now] = useState(() => Date.now())
  const runs = useLoad(() => api.runs(), [])
  useRepeat(!!runs.data?.some((r) => r.stage === 'PROCESSING'), runs.reload)   // 처리 중이면 5초마다 다시 본다
  const asg = useLoad(() => Promise.all(['COST', 'QUALITY', 'SALES'].map((r) => api.assignments(r))), [])
  const [filter, setFilter] = useState<Filter | null>(null)
  const [view, setView] = useState<'stage' | 'pj'>('stage')
  const [closedFail, setClosedFail] = useState<number | null>(null)

  const pending = pendingByRun(asg.data ?? [], now)
  const engineer = user?.role === 'ENGINEER'
  const all = runs.data ?? []
  const board = engineer ? all.filter((r) => r.engineer_id === user!.user_id) : all
  const failed = board.find((r) => r.stage === 'FAILED')
  const today = new Date(now)
  const dim = (r: RunListItem) => (filter && !FILTERS[filter](r) ? ' dim' : '')
  const sorted = [...board].sort((a, b) => (left(a) ?? 999) - (left(b) ?? 999))

  const cardEl = (r: RunListItem, col: Col, byProject = false) => {
    const c = card(r, col, pending)
    const n = left(r)
    const fail = r.stage === 'FAILED' || r.stage === 'REJECTED'
    return (
      <a key={r.run_id} className={`bd-card${byProject ? ' bpc' : ''}${fail ? ' fail' : ''}${dim(r)}`} href={href(`/reviews/${r.run_id}`)}>
        <span className="bd-top"><span className="mono">{r.review_no}</span>
          {byProject ? <span className={COL_CHIPS[col]}>{COLS.find(([k]) => k === col)![1]}</span>
            : <span className={ddCls(n)}>{n === null ? (r.stage === 'APPROVED' ? '' : '마감 없음') : dday(r.due_date!).text}</span>}</span>
        <b className="bd-name">{byProject ? (r.review_name ?? reviewTitle(r)) : reviewTitle(r)}</b>
        {c.lines.map((l) => <span key={l} className="bd-line">{l}</span>)}
        {c.note && <span className={`bd-note ${c.tone}`}>{c.note}</span>}
      </a>
    )
  }

  const groups = [...new Map(sorted.map((r) => [r.project_name ?? '', [] as RunListItem[]])).entries()]
  for (const r of sorted) groups.find(([k]) => k === (r.project_name ?? ''))![1].push(r)

  return (
    <main className="main">
      {failed && closedFail !== failed.run_id && (
        <div className="banner" role="alert">
          <span className="ms neg" aria-hidden="true" style={{ marginTop: 2 }}>error</span>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}><b>{failed.review_no} {reviewTitle(failed)} 분석이 멈췄습니다</b>{failed.error_message ?? '처리 중 오류가 났습니다.'}
            <dl className="fmeta">
              <div><dt>멈춘 단계</dt><dd>{STEP_NAMES[failed.failed_step ?? ''] ?? failed.failed_step ?? '—'}</dd></div>
              {failed.finished_at && <div><dt>발생</dt><dd>{stamp(failed.finished_at)}</dd></div>}
              <div><dt>자동 재시도</dt><dd>정해진 횟수 모두 실패</dd></div>
            </dl>
            <div className="facts">
              <span title="다시 시도 기능은 아직 없습니다"><button type="button" className="bp sm" disabled>재시도</button></span>
              <a className="bo sm" href={href(`/reviews/${failed.run_id}`)}>오류 내용 보기</a>
              <span title="다시 시도 기능은 아직 없습니다"><button type="button" className="bo sm" disabled>코드 규칙만으로 계속</button></span>
            </div>
          </div>
          <button type="button" className="bx" aria-label="알림 닫기" title="닫기" onClick={() => setClosedFail(failed.run_id)}><span className="ms" aria-hidden="true">close</span></button>
        </div>
      )}

      <div className="ttl">
        <h1 className="hero">홈</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="range">오늘 {dueText(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)} ({WEEK[today.getDay()]})</span>
          <a className="bp" href={href('/register')}><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>add</span>검토 등록</a>
        </div>
      </div>

      <div className="hm-sh"><h2>내 업무</h2><span>{engineer ? `${user!.user_name}이(가) 맡은 검토와 처리할 일` : '모든 검토와 처리할 일'}</span></div>
      <div className="metrics">
        {METRICS.map(([k, label, icon, level, title]) => {
          const l = sorted.filter(FILTERS[k])
          const on = filter === k
          return (
            <a key={k} className={`metric ${l.length ? level : 'm-none'}${on ? ' on' : ''}`} href="#dueTitle" aria-pressed={on}
              title={`${title}${on ? ' · 다시 누르면 필터 해제' : ' · 누르면 아래 카드를 이 조건으로 강조'}`}
              onClick={(e) => { stop(e); setFilter(on ? null : k) }}>
              <span className="ml"><span className="ms" aria-hidden="true">{icon}</span>{label}</span>
              <b>{runs.data ? l.length : '—'}</b>
              <span className="msub">{l.length ? reviewTitle(l[0]) + (l.length > 1 ? ` 외 ${l.length - 1}건` : '') : '없음'}</span>
            </a>
          )
        })}
      </div>

      <section className="sec" aria-labelledby="dueTitle">
        <div className="sech">
          <h2 id="dueTitle">{engineer ? '내 검토' : '검토'} {view === 'stage' ? '단계별' : '사업별'} <span style={{ fontWeight: 400, color: '#667085' }}>{board.length}건</span>
            {filter && <button type="button" className="fchip" onClick={() => setFilter(null)} aria-label="필터 해제">{METRICS.find(([k]) => k === filter)![1]}<span className="ms" aria-hidden="true">close</span></button>}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="seg" role="group" aria-label="보기 방식">
              <button type="button" className={view === 'stage' ? 'on' : ''} aria-pressed={view === 'stage'} onClick={() => setView('stage')}>단계별</button>
              <button type="button" className={view === 'pj' ? 'on' : ''} aria-pressed={view === 'pj'} onClick={() => setView('pj')}>사업별</button>
            </div>
            <a className="ib" href={href('/reviews')} aria-label="검토 목록에서 모두 보기" title="검토 목록에서 모두 보기"><span className="ms" aria-hidden="true">more_horiz</span></a>
          </div>
        </div>
        {runs.error && <p role="alert">{runs.error} <button type="button" className="lnk" onClick={runs.reload}>다시 불러오기</button></p>}
        {view === 'stage' ? (
          <div className="bd">
            {COLS.map(([key, label, dot]) => {
              const cards = sorted.filter((r) => colOf(r, pending) === key)
              return (
                <div key={key} className="bd-col" aria-label={label}>
                  <div className="bd-ch"><span className={dot} /><b>{label}</b><span className="bd-n">{cards.length}</span></div>
                  {cards.slice(0, 8).map((r) => cardEl(r, key))}
                  {cards.length > 8 && <a className="bd-empty" href={href('/reviews')}>{cards.length - 8}건 더 · 검토 목록에서 보기</a>}
                  {!cards.length && <div className="bd-empty">없음</div>}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bpl">
            {groups.map(([name, rs]) => {
              const first = rs[0]
              const n = left(first)
              return (
                <div key={name || '-'} className="bpg">
                  <div className="bpg-h"><span className="bpg-n">{name || '사업 미지정'}</span>
                    {first.business_no && <a className="hm-mut" href={href(`/projects/${first.business_no}`)}>{first.business_no} · 사업 상세</a>}
                    <span className="hm-mut ell">{[first.customer_name, first.country].filter(Boolean).join(' · ')}</span>
                    {first.due_date && <><span className={ddCls(n)}>{dday(first.due_date).text}</span><span className="hm-mut">제출 마감 {dueText(first.due_date)}</span></>}</div>
                  <div className="bpg-c">{rs.map((r) => cardEl(r, colOf(r, pending), true))}</div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <TeamShare runs={all} users={users} pending={asg.data ?? []} />
      <Events />
    </main>
  )
}

const HTABS = [['team', '팀 업무'], ['notice', '공지사항'], ['sys', '시스템 공지'], ['file', '자료실']] as const
type HTab = typeof HTABS[number][0]

/** 팀원마다 지금 하는 일: 엔지니어는 마감이 가장 가까운 진행 중 검토, 승인자는 결재 대기, 담당자는 미확인 협조 요청 */
function teamRows(runs: RunListItem[], users: User[], asg: Assignment[][]) {
  const open = runs.filter((r) => r.stage !== 'APPROVED')
  const waiting = runs.filter((r) => r.stage === 'APPROVAL')
  const depts: Record<string, Assignment[]> = { COST: asg[0] ?? [], QUALITY: asg[1] ?? [], SALES: asg[2] ?? [] }
  return users.map((u) => {
    const base = { id: u.user_id, ini: u.user_name.slice(0, 1), name: u.user_name, role: ROLE_NAMES[u.role] ?? u.role }
    if (u.role === 'ENGINEER') {
      const mine = open.filter((r) => r.engineer_id === u.user_id).sort((a, b) => (left(a) ?? 999) - (left(b) ?? 999))
      const r = mine[0]
      if (!r) return { ...base, job: '맡은 검토 없음', ref: '', stage: '', tone: '', due: '', late: false, upd: '', to: '/reviews' }
      const n = left(r)
      return { ...base, job: reviewTitle(r), ref: [r.review_no, r.customer_name].filter(Boolean).join(' · ') + (mine.length > 1 ? ` 외 ${mine.length - 1}건` : ''),
        stage: STAGE_NAMES[r.stage], tone: `st ${STAGE_TONES[r.stage]}`, due: r.due_date ? `${dueText(r.due_date)} · ${dday(r.due_date).text}` : '',
        late: n !== null && n <= 4, upd: stamp(r.started_at), to: `/reviews/${r.run_id}` }
    }
    if (u.role === 'APPROVER') {
      return { ...base, job: waiting.length ? `결재 ${waiting.length}건 확인` : '결재 대기 없음', ref: waiting.map((r) => r.review_no).join(' · '),
        stage: waiting.length ? '결재 처리 중' : '', tone: 'st c-blue', due: '', late: false, upd: '', to: '/reviews' }
    }
    const todo = (depts[u.role] ?? []).filter((a) => a.status !== 'DONE')
    return { ...base, job: todo.length ? `협조 요청 ${todo.length}건 미확인` : '미확인 협조 요청 없음', ref: ROLE_NAMES[u.role] ?? '',
      stage: todo.length ? '협조 처리 중' : '', tone: 'st c-ora', due: '', late: false, upd: '', to: '/todo' }
  })
}

function TeamShare({ runs, users, pending }: { runs: RunListItem[]; users: User[]; pending: Assignment[][] }) {
  const [tab, setTab] = useState<HTab>('team')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [got, setGot] = useState<Record<number, boolean>>({})
  const rows = teamRows(runs, users, pending)
  const toggle = (k: string) => setOpen({ ...open, [k]: !open[k] })
  const all = { team: ['/team', '팀 현황 전체 보기'], notice: ['/notice', '공지사항 전체 보기'], sys: ['/sysnotice', '시스템 공지 전체 보기'], file: ['/files', '자료실 전체 보기'] }[tab]
  return (
    <section className="sec" aria-labelledby="teamTitle">
      <div className="sech"><h2 id="teamTitle">엔지니어링팀 공유</h2><span className="hm-team">사용자 {users.length}명</span></div>
      <div className="pgtabs hm-tabs" role="tablist" aria-label="팀 공유">
        {HTABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" className={tab === k ? 'on' : ''} aria-selected={tab === k} onClick={() => setTab(k)}>{label}
            {((k === 'notice' && NOTICES.some((n) => n.isNew)) || (k === 'sys' && SYS_NOTICES.some((n) => n.isNew))) && <i className="hm-new" title="새 글" />}</button>
        ))}
        <a className="hm-all" href={href(all[0])}>{all[1]}<span className="ms" aria-hidden="true">chevron_right</span></a>
      </div>
      {tab === 'team' && (
        <div className="hm-box">
          <div className="hm-th hm-tr"><span>담당자</span><span>지금 하는 일</span><span>단계</span><span>마감</span><span>최근 갱신</span><span /></div>
          {rows.map((m) => (
            <a key={m.id} className="hm-tr hm-row" href={href(m.to)}>
              <span className="hm-who"><span className="hm-av" aria-hidden="true">{m.ini}<i /></span><span className="hm-nm"><b>{m.name}</b><span>{m.role}</span></span></span>
              <span className="hm-job"><b className="ell">{m.job}</b><span className="mono ell">{m.ref}</span></span>
              <span>{m.stage && <span className={m.tone}>{m.stage}</span>}</span>
              <span className={`mono${m.late ? ' c-red' : ''}`}>{m.due}</span>
              <span className="mono hm-mut">{m.upd}</span>
              <span className="ms" aria-hidden="true" style={{ color: '#98A2B3' }}>chevron_right</span>
            </a>
          ))}
        </div>
      )}
      {tab === 'notice' && (
        <div className="hm-box">
          <ExampleBand />
          {NOTICES.map((n, i) => (
            <div key={n.title} className="hm-post">
              <button type="button" className="hm-ph" onClick={() => toggle(`n${i}`)} aria-expanded={!!open[`n${i}`]}>
                <span className="hm-pt">{n.must && <span className="st c-red">필독</span>}<b className="ell">{n.title}</b>{n.isNew && !open[`n${i}`] && <i className="hm-new" title="읽지 않음" />}</span>
                <span className="hm-mut">{n.by}</span><span className="mono hm-mut">{n.date}</span>
                <span className="ms" aria-hidden="true" style={{ color: '#98A2B3' }}>{open[`n${i}`] ? 'expand_less' : 'expand_more'}</span>
              </button>
              {open[`n${i}`] && <div className="hm-pb">{n.body}</div>}
            </div>
          ))}
        </div>
      )}
      {tab === 'sys' && (
        <div className="hm-box">
          <ExampleBand />
          {SYS_NOTICES.map((n, i) => (
            <div key={n.title} className="hm-post">
              <button type="button" className="hm-ph" onClick={() => toggle(`s${i}`)} aria-expanded={!!open[`s${i}`]}>
                <span className="hm-pt"><span className={n.tone}>{n.kind}</span><b className="ell">{n.title}</b>{n.isNew && !open[`s${i}`] && <i className="hm-new" title="읽지 않음" />}</span>
                <span className="hm-mut">{n.when}</span><span className="mono hm-mut">{n.date}</span>
                <span className="ms" aria-hidden="true" style={{ color: '#98A2B3' }}>{open[`s${i}`] ? 'expand_less' : 'expand_more'}</span>
              </button>
              {open[`s${i}`] && <div className="hm-pb">{n.body}</div>}
            </div>
          ))}
        </div>
      )}
      {tab === 'file' && (
        <div className="hm-box">
          <ExampleBand />
          {FILES.map((f, i) => (
            <div key={f.name} className="hm-file">
              <span className={`hm-ext${f.ext === 'XLSX' ? ' x' : ''}`}>{f.ext}</span>
              <span className="hm-fn"><b className="ell">{f.name}</b><span>{f.desc}</span></span>
              <span className="hm-mut">{f.by}</span><span className="mono hm-mut">{f.date} · {f.size}</span>
              <button type="button" className="bo" onClick={() => setGot({ ...got, [i]: true })} aria-label={`${f.name} 내려받기`}>
                <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>{got[i] ? 'check' : 'download'}</span>{got[i] ? '받음' : '내려받기'}</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** 교육·봉사·행사 예시: 세 장씩 넘겨 본다. 신청해도 저장하지 않는다 */
function Events() {
  const [at, setAt] = useState(0)
  const [done, setDone] = useState<Record<number, boolean>>({})
  const vis = 3
  const max = EVENTS.length - vis
  return (
    <section className="sec" aria-labelledby="evTitle">
      <div className="sech">
        <h2 id="evTitle">교육 · 봉사 · 행사</h2>
        <div className="hm-evc">
          <span className="mono hm-mut">{at + 1}–{at + vis} / {EVENTS.length}</span>
          <button type="button" className="hm-nav" onClick={() => setAt(Math.max(0, at - 1))} disabled={at === 0} aria-label="이전 행사"><span className="ms" aria-hidden="true">chevron_left</span></button>
          <button type="button" className="hm-nav" onClick={() => setAt(Math.min(max, at + 1))} disabled={at >= max} aria-label="다음 행사"><span className="ms" aria-hidden="true">chevron_right</span></button>
        </div>
      </div>
      <ExampleBand />
      <div className="hm-vp" aria-roledescription="carousel">
        <div className="hm-track" style={{ transform: `translateX(calc(${-at} * (100% + 16px) / ${vis}))` }}>
          {EVENTS.map((e, i) => {
            const closed = e.state === 'closed'
            const must = e.state === 'must'
            const tag = e.state.startsWith('open:') ? e.state.slice(5) : ''
            const on = !!done[i]
            return (
              <article key={e.title} className="hm-ev" aria-label={e.title}>
                <div className="hm-evh"><span className="hm-evi" aria-hidden="true"><span className="ms">{e.icon}</span></span><span className="hm-cat">{e.cat}</span>
                  <span className={closed ? 'st c-grey' : must ? 'st c-ora' : on ? 'st c-green' : 'st c-blue'}>{closed ? '마감' : must ? '필수' : on ? '신청함' : tag === '참석 표시' ? '자유 참석' : `신청 중 · ${tag}`}</span></div>
                <h3>{e.title}</h3>
                <dl>
                  <div><dt><span className="ms" aria-hidden="true">event</span><span className="sr">일시</span></dt><dd>{e.when}</dd></div>
                  <div><dt><span className="ms" aria-hidden="true">location_on</span><span className="sr">장소</span></dt><dd>{e.where}</dd></div>
                  <div><dt><span className="ms" aria-hidden="true">group</span><span className="sr">인원</span></dt><dd>{e.cap}</dd></div>
                </dl>
                <div className="hm-evf"><span className="hm-mut">{e.host}</span>
                  <button type="button" className={closed || on ? 'bo' : 'bp'} disabled={closed} onClick={() => setDone({ ...done, [i]: !on })}>
                    {closed ? '마감됨' : must ? (on ? '수강 확인됨' : '수강 확인') : on ? '신청 취소' : tag === '참석 표시' ? '참석 표시' : '신청하기'}</button></div>
              </article>
            )
          })}
        </div>
      </div>
      <div className="hm-dots" role="group" aria-label="행사 위치">
        {Array.from({ length: max + 1 }, (_, k) => <button key={k} type="button" className={k === at ? 'on' : ''} onClick={() => setAt(k)} aria-label={`${k + 1}번째 묶음`} aria-current={k === at} />)}
      </div>
    </section>
  )
}
