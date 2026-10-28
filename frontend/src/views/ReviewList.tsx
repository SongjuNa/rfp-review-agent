import { useState } from 'react'
import { api, type RunListItem } from '../api'
import { dday, dueText, filesText, isoDay, num, scopeName, stamp } from '../components/format'
import { STAGE_NAMES, STAGE_TONES, STEP_NAMES } from '../components/labels'
import { Pager } from '../components/Pager'
import { useLoad } from '../components/useLoad'
import { href } from '../shell/router'
import { useSession } from '../shell/useSession'

// SCR-06 검토 목록 (목업 v4.57 Main). docs/screens/SCR-06-검토목록.md

type Period = '1w' | '1m' | 'all'
type Has = '' | 'requirements' | 'risks' | 'deviation_candidates' | 'proposals'
type Field = 'all' | 'name' | 'id' | 'file'
type SortKey = 'started' | 'requirements' | 'dev'
type Search = { stage: string; has: Has; field: Field; q: string }

const PERIODS: [Period, string][] = [['1w', '1주'], ['1m', '1개월'], ['all', '전체']]
const HAS: [Has, string][] = [['', '전체'], ['requirements', '요구사항'], ['risks', '위험'], ['deviation_candidates', '일탈'],
  ['proposals', '제안']]
const STAGES = ['PROCESSING', 'ENGINEER_REVIEW', 'APPROVAL', 'APPROVED', 'REJECTED', 'FAILED']
const PLACEHOLDER: Record<Field, string> = {
  all: '사업명, 검토명, 번호, 고객사, 파일명', name: '사업명·검토명 (예: Thai Binh)', id: '번호 (예: RV-2026-025)', file: '파일명',
}
const EMPTY: Search = { stage: 'all', has: '', field: 'all', q: '' }

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

const FROM: Record<Period, Date | null> = { '1w': daysAgo(6), '1m': daysAgo(30), all: null }

function rangeText(period: Period): string {
  const from = FROM[period]
  return from ? `${isoDay(from).slice(5)}–${isoDay(new Date()).slice(5)}` : '전체 기간'
}

function matches(r: RunListItem, field: Field, q: string): boolean {
  if (!q) return true
  const name = [r.project_name, r.review_name].join(' ')
  const text = { all: [name, r.review_no, r.files, r.customer_name].join(' '), name, id: r.review_no, file: r.files ?? '' }[field]
  return text.toLowerCase().includes(q.toLowerCase())
}

function Count({ v, hot, processing }: { v: number; hot?: string; processing: boolean }) {
  if (processing) return <span className="dimv">—</span>
  return <span className={v === 0 ? 'dimv' : hot ?? ''}>{num(v)}</span>
}

function Row({ r, seq, me }: { r: RunListItem; seq: number; me: number | null }) {
  const scope = scopeName(r)
  const detail = href(`/reviews/${r.run_id}`)
  const processing = r.stage === 'PROCESSING'
  const failed = r.stage === 'FAILED'
  const step = STEP_NAMES[(failed ? r.failed_step : r.step) ?? ''] ?? (failed ? r.failed_step : r.step)
  const due = r.due_date ? dday(r.due_date) : null
  return (
    <tr className={r.stage === 'APPROVED' || r.stage === 'REJECTED' ? 'dis' : ''}>
      <td className="num mono" style={{ color: '#667085' }}>{seq}</td>
      <td><span className={`st ${STAGE_TONES[r.stage]}`}>{STAGE_NAMES[r.stage]}</span></td>
      <td>{r.project_name && <span className="pjn">{r.project_name}</span>}</td>
      <td>
        {failed || r.stage === 'APPROVAL'
          ? <a className="failnm" href={detail}>{scope}</a>
          : <a href={detail} style={{ color: '#1F2937', fontWeight: 600 }}>{scope}</a>}
        {failed && step && <a className="tag failtag" href={detail}>{step}에서 멈춤<span className="ms" aria-hidden="true">chevron_right</span></a>}
        {processing && step && <span className="tag">{step} 중</span>}
        <div className="cond meta">
          <span>{r.review_no}</span>
          {r.customer_name && <span>{r.customer_name}</span>}
          {r.files && <span className="ell" style={{ maxWidth: 150 }} title={r.files}>{filesText(r.files)}</span>}
          {r.engineer_name && <span>{r.engineer_name}</span>}
          {r.engineer_id !== null && r.engineer_id !== me && (
            <span className="rotag"><span className="ms" aria-hidden="true">visibility</span>열람</span>
          )}
        </div>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {r.stage === 'APPROVED' ? <span className="dd dimv">완료</span>
          : r.stage === 'REJECTED' ? <span className="dd">—</span>
            : due && <span className={`dd ${due.cls}`}>{due.text}</span>}
        {r.due_date && <div className="cond" style={{ marginTop: 1 }}>{dueText(r.due_date)}</div>}
      </td>
      <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{stamp(r.started_at)}</td>
      <td className="num"><Count v={r.requirements} processing={processing} /></td>
      <td className="num"><Count v={r.risks} processing={processing || failed} /></td>
      <td className="num"><Count v={r.deviation_candidates} hot="neg" processing={processing || failed} /></td>
      <td className="num"><Count v={r.proposals} processing={processing || failed} /></td>
      <td><a className="dots" href={detail} aria-label={`${r.review_no} 열기`}><span className="ms" aria-hidden="true">more_horiz</span></a></td>
    </tr>
  )
}

function SortHead({ k, label, sort, onSort, num: isNum }: {
  k: SortKey; label: string; sort: { key: SortKey; dir: 'asc' | 'desc' }; onSort: (k: SortKey) => void; num?: boolean
}) {
  const on = sort.key === k
  return (
    <th className={isNum ? 'num' : undefined} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={'sort' + (on ? ' on' : '')} onClick={() => onSort(k)}>
        {label}<span className="ms" aria-hidden="true">{on ? (sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}</span>
      </button>
    </th>
  )
}

export function ReviewList() {
  const { user, users } = useSession()
  const runs = useLoad(() => api.runs(), [])
  const [period, setPeriod] = useState<Period>('all')
  const [scope, setScope] = useState<'mine' | 'all' | number>('mine')
  const [draft, setDraft] = useState<Search>(EMPTY)
  const [search, setSearch] = useState<Search>(EMPTY)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'started', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const me = user?.user_id ?? null
  const all = runs.data ?? []
  const owned = all.filter((r) => scope === 'all' || r.engineer_id === (scope === 'mine' ? me : scope))
  const from = FROM[period]
  const key = { started: (r: RunListItem) => r.started_at, requirements: (r: RunListItem) => r.requirements,
    dev: (r: RunListItem) => r.deviation_candidates }[sort.key]
  const dir = sort.dir === 'asc' ? 1 : -1
  const rows = owned
    .filter((r) => !from || r.started_at.slice(0, 10) >= isoDay(from))
    .filter((r) => search.stage === 'all' || r.stage === search.stage)
    .filter((r) => !search.has || r[search.has] > 0)
    .filter((r) => matches(r, search.field, search.q.trim()))
    .sort((a, b) => (key(a) > key(b) ? dir : key(a) < key(b) ? -dir : 0))
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const cur = Math.min(page, pages)
  const shown = rows.slice((cur - 1) * size, cur * size)
  const count = (stage: string, mineOnly = false) =>
    owned.filter((r) => r.stage === stage && (!mineOnly || r.engineer_id === me)).length
  const engineers = users.filter((u) => u.role === 'ENGINEER' && u.user_id !== me)
  const other = typeof scope === 'number' ? users.find((u) => u.user_id === scope) : null
  const apply = (s: Search) => { setSearch(s); setPage(1) }
  const onSort = (k: SortKey) => setSort({ key: k, dir: sort.key === k && sort.dir === 'desc' ? 'asc' : 'desc' })
  return (
    <main className="main">
      <div className="ttl">
        <h1>검토 목록</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="seg" role="group" aria-label="기간">
            {PERIODS.map(([k, l]) => (
              <button key={k} type="button" className={period === k ? 'on' : ''} aria-pressed={period === k}
                onClick={() => { setPeriod(k); setPage(1) }}>{l}</button>
            ))}
          </div>
          <span className="range">{rangeText(period)}</span>
          <a className="bp" href={href('/register')}><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>add</span>검토 등록</a>
        </div>
      </div>

      <div className="sumline">
        <span>내가 처리할 건<b className="c-blue">{count('ENGINEER_REVIEW', true)}</b></span>
        <span>결재 대기<b>{count('APPROVAL')}</b></span>
        <span>분석 실패<b className="c-red">{count('FAILED')}</b></span>
      </div>

      <section className="sec">
        <div className="sech">
          <h2>검토 <span style={{ fontWeight: 400, color: '#667085' }}>{rows.length}</span></h2>
          <div className="own">
            <div className="seg" role="group" aria-label="담당 범위">
              {([['mine', '내 검토'], ['all', '팀 전체']] as const).map(([k, l]) => (
                <button key={k} type="button" className={scope === k ? 'on' : ''} aria-pressed={scope === k}
                  onClick={() => { setScope(k); setPage(1) }}>{l}</button>
              ))}
            </div>
            <label className="ownl"><span>담당자</span>
              <select className="fi" aria-label="담당자 고르기" value={typeof scope === 'number' ? scope : ''}
                onChange={(e) => { setScope(e.target.value ? Number(e.target.value) : 'mine'); setPage(1) }}>
                <option value="">선택</option>
                {engineers.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.user_name} ({all.filter((r) => r.engineer_id === u.user_id).length})</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {other && (
          <div className="ronote"><span className="ms" aria-hidden="true">visibility</span>
            <span><b>{other.user_name}</b>의 검토를 보고 있습니다.</span></div>
        )}
        <div className="sp" role="search" aria-label="검토 찾기">
          <div className="sp-r1">
            <label className="sp-f"><span className="sp-l">단계</span>
              <select className="fi" value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value })}>
                <option value="all">모든 단계</option>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_NAMES[s]}</option>)}
              </select>
            </label>
            <div className="sp-f" role="radiogroup" aria-label="있는 항목"><span className="sp-l">있는 항목</span>
              {HAS.map(([k, l]) => (
                <label key={k} className="sp-rd">
                  <input type="radio" name="has" checked={draft.has === k} onChange={() => setDraft({ ...draft, has: k })} />{l}
                </label>
              ))}
            </div>
          </div>
          <div className="sp-r2">
            <select className="fi sp-qf" aria-label="검색 대상" value={draft.field}
              onChange={(e) => setDraft({ ...draft, field: e.target.value as Field })}>
              <option value="all">-전체-</option><option value="name">검토명</option><option value="id">번호</option>
              <option value="file">파일명</option>
            </select>
            <input className="fi sp-q" aria-label="검색어" placeholder={PLACEHOLDER[draft.field]} value={draft.q}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') apply(draft) }} />
            <button type="button" className="bo" onClick={() => { setDraft(EMPTY); apply(EMPTY) }}>초기화</button>
            <button type="button" className="bp" onClick={() => apply(draft)}>
              <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>search</span>검색</button>
          </div>
        </div>
        {runs.error && (
          <p className="neg" role="alert" style={{ margin: '16px 0 0' }}>{runs.error}{' '}
            <button type="button" className="bo" onClick={runs.reload}>다시 불러오기</button></p>
        )}
        <div className="tw">
          <table className="tbl">
            <thead><tr>
              <th className="num" style={{ width: 44 }}>순번</th>
              <th style={{ width: 110 }}>단계</th>
              <th style={{ width: 120 }}>사업명</th>
              <th style={{ width: '30%' }}>설비 범위</th>
              <th>마감</th>
              <SortHead k="started" label="시작" sort={sort} onSort={onSort} />
              <SortHead k="requirements" label="요구사항" sort={sort} onSort={onSort} num />
              <th className="num">위험</th>
              <SortHead k="dev" label="일탈" sort={sort} onSort={onSort} num />
              <th className="num">제안</th>
              <th style={{ width: 28 }} />
            </tr></thead>
            <tbody>
              {runs.data === null && !runs.error && (
                <tr><td colSpan={11} className="dimv">불러오는 중…</td></tr>
              )}
              {shown.map((r, i) => <Row key={r.run_id} r={r} seq={(cur - 1) * size + i + 1} me={me} />)}
            </tbody>
          </table>
          <Pager total={rows.length} page={cur} size={size} shown={shown.length} onPage={setPage}
            onSize={(n) => { setSize(n); setPage(1) }} />
        </div>
        {runs.data !== null && rows.length === 0 && (
          <p style={{ margin: 0, padding: '16px 12px', color: '#667085' }}>조건에 맞는 검토가 없습니다.</p>
        )}
      </section>
    </main>
  )
}
