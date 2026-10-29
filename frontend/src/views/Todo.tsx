import { useEffect, useState } from 'react'
import { api, type Assignment, type User } from '../api'
import { Pager } from '../components/Pager'
import { stamp } from '../components/format'
import { locShort } from '../components/judgment'
import { POINT_KIND_NAMES } from '../components/labels'
import { useLoad } from '../components/useLoad'
import { href } from '../shell/router'
import { usePageCss } from '../shell/pageCss'
import { useSession } from '../shell/useSession'
import { ExampleBand } from './detail/ExampleTab'
import './detail.css'

// SCR-13 협조 요청 현황 (목업 v4.57 Todo). docs/screens/SCR-13-협조요청.md
// 요청 항목은 FR-11이 유형별로 보낸 할 일이다. 재요청·회신·내보내기는 API가 없어 잠기고, 요청하기는 예시 창이다 (SCR-13_공유.md).

const DEPTS = [['COST', '견적 담당'], ['QUALITY', '품질 담당'], ['SALES', '영업 담당'], ['NONE', '미분류']] as const
type Dept = typeof DEPTS[number][0]
type St = 'new' | 'late' | 'seen'
const ST: Record<St, [string, string]> = { new: ['미확인', 'c-blue'], seen: ['확인', 'c-grey'], late: ['24시간 넘게 미확인', 'c-ora'] }
const DAY = 86_400_000
const NO_API = '재요청 기능은 아직 없습니다'

/** 할 일 상태 → 화면 상태. 담당자가 하는 중·끝으로 바꾸면 "확인", 보낸 지 24시간이 넘도록 그대로면 "24시간 넘게 미확인" */
function stOf(a: Assignment, now: number): St {
  if (a.status !== 'TODO') return 'seen'
  return now - new Date(a.sent_at).getTime() > DAY ? 'late' : 'new'
}

function md(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 회신 기한: 보낸 날 + 3일 (목업 규칙) */
const dueOf = (a: Assignment) => new Date(new Date(a.sent_at).getTime() + 3 * DAY)

function title(a: Assignment): string {
  const t = a.text.replace(/\s+/g, ' ').trim()
  return t.length > 80 ? `${t.slice(0, 80)}…` : t
}

function desc(a: Assignment): string {
  if (a.point_kind) return `${POINT_KIND_NAMES[a.point_kind] ?? a.point_kind} 제안 포인트 · 채택한 문장`
  if (a.repeat_count > 1) return `같은 조건 ${a.repeat_count}곳을 한 건으로 묶음`
  return a.type_name ?? ''
}

/** 원문 위치: 파일 번호 대신 파일 이름 */
const where = (a: Assignment) => (a.file_name ? locShort(a).replace(/^파일 \d+/, a.file_name) : locShort(a))

const tag = (a: Assignment) => (a.point_kind ? '제안 포인트' : a.repeat_count > 1 ? a.type_name : null)

function receiver(a: Assignment, users: User[]): string {
  return a.assignee ?? (users.filter((u) => u.role === a.assignee_role).map((u) => u.user_name).join(', ') || '미지정')
}

function defaultDept(user: User | null): Dept {
  return user && (user.role === 'COST' || user.role === 'QUALITY' || user.role === 'SALES') ? user.role : 'COST'
}

export function Todo() {
  usePageCss('Todo')
  const { user, users } = useSession()
  const [chosen, setDept] = useState<Dept | null>(null)
  const dept = chosen ?? defaultDept(user)          // 고르기 전에는 담당자 자기 부서, 그 밖에는 견적 담당
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [open, setOpen] = useState<number | null>(null)
  const [writing, setWriting] = useState(false)
  const [toast, setToast] = useState('')
  const list = useLoad(() => (dept === 'NONE' ? Promise.resolve([]) : api.assignments(dept)), [dept])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const [now] = useState(() => Date.now())          // 화면을 연 시각 기준으로 24시간을 센다
  const rows = list.data ?? []
  const count = (k: St) => rows.filter((a) => stOf(a, now) === k).length
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const cur = Math.min(page, pages)
  const shown = rows.slice((cur - 1) * size, cur * size)
  const label = DEPTS.find(([k]) => k === dept)![1]
  const picked = rows.find((a) => a.assignment_id === open) ?? null

  return (
    <main className="main">
      <nav className="pgtabs" aria-label="수신 부서">
        {DEPTS.map(([k, l]) => (
          <button key={k} type="button" className={dept === k ? 'on' : ''} aria-current={dept === k ? 'page' : 'false'}
            onClick={() => { setDept(k); setPage(1) }}><span>{l}</span></button>
        ))}
      </nav>
      <div className="ttl">
        <h1>{label}</h1>
        <span title="내보내기는 내보내기 change에서 만듭니다"><button type="button" className="bo" disabled>
          <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>download</span>내보내기</button></span>
      </div>

      <div className="sumline"><span>미확인<b className="c-blue">{count('new')}</b></span><span>24시간 넘게 미확인<b className="c-ora">{count('late')}</b></span><span>확인<b>{count('seen')}</b></span></div>

      <section className="sec">
        <div className="sech"><h2>요청 항목 <span style={{ fontWeight: 400, color: '#667085' }}>{rows.length}</span></h2>
          <button type="button" className="bp" onClick={() => setWriting(true)}>
            <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>add</span>요청하기</button></div>
        {list.error && <p role="alert">{list.error} <button type="button" className="lnk" onClick={list.reload}>다시 불러오기</button></p>}
        <div className="tw">
          <table className="tbl">
            <thead><tr><th style={{ width: 150 }}>상태</th><th style={{ width: '46%' }}>요구사항</th><th>수신자</th><th>요청 일시</th><th /></tr></thead>
            <tbody>
              {list.data === null && !list.error && <tr><td colSpan={5} className="dimv">불러오는 중…</td></tr>}
              {shown.map((a) => {
                const st = stOf(a, now)
                const t = tag(a)
                return (
                  <tr key={a.assignment_id} className={st === 'seen' ? 'dis' : undefined} onClick={() => setOpen(a.assignment_id)} style={{ cursor: 'pointer' }}>
                    <td><span className={`st ${ST[st][1]}`}>{ST[st][0]}</span></td>
                    <td>{t && <span className="tag" style={{ margin: '0 6px 0 0' }}>{t}</span>}<span style={{ fontWeight: 600 }}>{title(a)}</span>
                      {a.is_assumed && <span className="tag">팀 가정</span>}
                      <div style={{ fontSize: 'var(--fs-sm)', color: '#475467', marginTop: 4 }}>{desc(a)}</div>
                      <div className="cond meta"><a href={href(`/reviews/${a.run_id}`)} onClick={(e) => e.stopPropagation()}>{a.review_no}</a>
                        <span>{where(a)}</span></div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{receiver(a, users)}</td>
                    <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{stamp(a.sent_at)}</td>
                    <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      {st !== 'seen' && <span title={NO_API}><button type="button" className="lnk" disabled style={{ color: '#98A2B3', cursor: 'default' }}>재요청</button></span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length > 0 && <Pager total={rows.length} page={cur} size={size} shown={shown.length} onPage={setPage}
            onSize={(n) => { setSize(n); setPage(1) }} />}
        </div>
        {list.data !== null && rows.length === 0 && <p style={{ margin: 0, padding: '16px 12px', color: '#667085' }}>이 담당에게 요청 항목이 없습니다.</p>}
      </section>
      {picked && <Detail a={picked} now={now} dept={label} users={users} user={user} onClose={() => setOpen(null)}
        onChanged={(msg) => { setToast(msg); list.reload() }} />}
      {writing && <NewRequest dept={dept} rows={rows} users={users} onClose={() => setWriting(false)}
        onSent={() => { setWriting(false); setToast('예시 화면이라 보내지 않았습니다.') }} />}
      {toast && <div className="toast" role="status"><span className="ms" aria-hidden="true">check_circle</span>{toast}</div>}
    </main>
  )
}

function useEsc(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

/** 요청 상세 창: 요청 내용, 원문, 회신, 근거, 진행. 받는 역할 사용자는 여기서 확인·처리 끝을 표시한다 */
function Detail({ a, now, dept, users, user, onClose, onChanged }: {
  a: Assignment; now: number; dept: string; users: User[]; user: User | null; onClose: () => void; onChanged: (msg: string) => void
}) {
  useEsc(onClose)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const st = stOf(a, now)
  const to = receiver(a, users)
  const due = dueOf(a)
  const done = a.status === 'DONE'
  const sender = a.engineer_name ?? '검토 담당'
  const mine = user?.role === a.assignee_role
  const steps: { k: string; t: string; cls: string }[] = [{ k: '요청 보냄', t: `${stamp(a.sent_at)} · ${sender}`, cls: 'done' }]
  if (st === 'seen') steps.push({ k: '확인', t: `${a.updated_at ? `${stamp(a.updated_at)} · ` : ''}${to}`, cls: 'done' })
  if (st === 'late') steps.push({ k: '24시간 넘게 미확인', t: '재요청 필요', cls: 'warn' })
  steps.push(done ? { k: '처리 끝', t: to, cls: 'done' } : { k: '회신 대기', t: `기한 ${md(due)}`, cls: 'wait' })

  const set = (status: 'DOING' | 'DONE') => {
    setBusy(true)
    setError(null)
    api.setTaskStatus(a.assignment_id, status, user!.user_id)
      .then(() => onChanged(status === 'DOING' ? '확인으로 표시했습니다' : '처리 끝으로 표시했습니다'), (e: Error) => setError(e.message))
      .finally(() => setBusy(false))
  }

  return (
    <div className="pmo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pmw cw" role="dialog" aria-modal="true" aria-labelledby="dmTitle">
        <div className="pmh">
          <span className={`st ${ST[st][1]}`}>{ST[st][0]}</span>
          <h2 id="dmTitle">{title(a)}</h2>
          <span className="pmsrc">{dept} · {to}</span>
          <button type="button" className="ib" onClick={onClose} aria-label="닫기" title="닫기 (Esc)" autoFocus><span className="ms" aria-hidden="true">close</span></button>
        </div>
        <div className="cwb">
          <section className="cwl">
            <div className="lbl">요청 내용</div>
            <p className="req">{[desc(a), `${dept}에서 원문을 확인하고 회신해 주세요.`].filter(Boolean).join(' · ')}</p>
            {a.is_assumed && <p className="cwn"><span className="tag" style={{ margin: '0 6px 0 0' }}>팀 가정</span>팀 가정 값으로 계산했습니다. 확정 값으로 바꿔 회신해 주세요.</p>}
            <div className="lbl">{a.point_kind ? '제안 포인트 문장' : 'RFP 원문'}</div>
            <div className="orig"><div className="ol">{where(a)}</div><span>{a.text}</span></div>
            <div className="lbl">회신</div>
            {done
              ? <p className="cwn">{to}이(가) 처리 끝으로 표시했습니다{a.updated_at ? ` (${stamp(a.updated_at)})` : ''}. 회신 글은 받지 않습니다.</p>
              : <p className="cwn">아직 회신이 없습니다. 회신 기한 {md(due)}</p>}
          </section>
          <aside className="cwr">
            <dl className="basis">
              <div><dt>관련 검토</dt><dd><a href={href(`/reviews/${a.run_id}`)}>{a.review_no}</a></dd></div>
              <div><dt>수신 부서</dt><dd>{dept}</dd></div>
              <div><dt>수신자</dt><dd>{to}</dd></div>
              <div><dt>보낸 사람</dt><dd>{sender}</dd></div>
              <div><dt>회신 기한</dt><dd><span className={!done && due.getTime() < now ? 'c-red' : ''}>{md(due)}</span></dd></div>
            </dl>
            <div className="lbl" style={{ marginTop: 18 }}>진행</div>
            <ol className="tl2">{steps.map((sp) => <li key={sp.k} className={sp.cls}><b>{sp.k}</b><span>{sp.t}</span></li>)}</ol>
          </aside>
        </div>
        <div className="pmf">
          {error && <span className="aphint" role="alert" style={{ marginRight: 'auto' }}>{error}</span>}
          <span className="mdf-n">Esc로 닫기</span>
          <a className="bo" href={href(`/reviews/${a.run_id}`)}>검토 상세 열기</a>
          {mine && a.status === 'TODO' && <button type="button" className="bp" disabled={busy} onClick={() => set('DOING')}>
            <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>check</span>확인함</button>}
          {mine && a.status === 'DOING' && <button type="button" className="bp" disabled={busy} onClick={() => set('DONE')}>
            <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>task_alt</span>처리 끝</button>}
          {!mine && st !== 'seen' && <span title={NO_API}><button type="button" className="bp" disabled>
            <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>notifications_active</span>재요청</button></span>}
        </div>
      </div>
    </div>
  )
}

/** 협조 요청하기: 직접 요청을 만드는 API가 없어 예시 창이다. 보내도 저장하지 않는다 (_공통규칙.md 6장) */
function NewRequest({ dept, rows, users, onClose, onSent }: {
  dept: Dept; rows: Assignment[]; users: User[]; onClose: () => void; onSent: () => void
}) {
  useEsc(onClose)
  const [to, setTo] = useState<string>(dept === 'NONE' ? 'COST' : dept)
  const [what, setWhat] = useState('')
  const [body, setBody] = useState('')
  const [tried, setTried] = useState(false)
  const [due] = useState(() => new Date(Date.now() + 3 * DAY).toISOString().slice(0, 10))
  const runs = [...new Map(rows.map((a) => [a.run_id, a.review_no])).entries()]
  const people = users.filter((u) => u.role === to)
  const send = () => {
    setTried(true)
    if (what.trim() && body.trim()) onSent()
  }
  return (
    <div className="pmo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pmw nwd" role="dialog" aria-modal="true" aria-labelledby="nwTitle">
        <div className="pmh"><h2 id="nwTitle">협조 요청하기</h2><button type="button" className="ib" onClick={onClose} aria-label="닫기" title="닫기 (Esc)"><span className="ms" aria-hidden="true">close</span></button></div>
        <div className="nwb">
          <ExampleBand />
          <div className="g2">
            <label className="fl">관련 검토<select className="fi">{runs.length ? runs.map(([id, no]) => <option key={id} value={id}>{no}</option>) : <option>예시 검토</option>}</select></label>
            <label className="fl">원문 위치<input className="fi" placeholder="예: TS-115-GIS 19, 8.7절" /></label>
          </div>
          <label className="fl">요구사항<input className={`fi${tried && !what.trim() ? ' bad' : ''}`} value={what} onChange={(e) => setWhat(e.target.value)} placeholder="예: SF6 가스 누설률 카탈로그 값" /></label>
          {tried && !what.trim() && <div className="ferr2">요구사항을 입력해 주세요.</div>}
          <div className="g2">
            <label className="fl">수신 부서<select className="fi" value={to} onChange={(e) => setTo(e.target.value)}>
              {DEPTS.filter(([k]) => k !== 'NONE').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="fl">수신자<select className="fi">{people.length ? people.map((u) => <option key={u.user_id}>{u.user_name}</option>) : <option>미지정</option>}</select></label>
          </div>
          <label className="fl">요청 내용<textarea className={`fi${tried && !body.trim() ? ' bad' : ''}`} rows={4} value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="무엇을, 왜, 어떤 형식으로 회신받을지 적어 주세요." /></label>
          {tried && !body.trim() && <div className="ferr2">요청 내용을 입력해 주세요.</div>}
          <div className="g2">
            <label className="fl">회신 기한<input className="fi" type="date" defaultValue={due} /></label>
            <label className="ck2"><input type="checkbox" defaultChecked />원문 발췌를 함께 보냄</label>
          </div>
        </div>
        <div className="pmf">
          <button type="button" className="bo" onClick={onClose}>취소</button>
          <button type="button" className="bp" onClick={send}><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>send</span>요청 보내기</button>
        </div>
      </div>
    </div>
  )
}
