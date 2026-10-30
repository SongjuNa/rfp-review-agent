import { useState } from 'react'
import { api, type BusinessListItem } from '../api'
import { BUSINESS_ROLE_NAMES, RANGE_CHIP, RANGE_NAMES, ddCls, ddText } from '../components/business'
import { dueText } from '../components/format'
import { useLoad, useRepeat } from '../components/useLoad'
import { usePageCss } from '../shell/pageCss'
import { href } from '../shell/router'
import { useSession } from '../shell/useSession'

// SCR-04 사업 현황 (목업 v4.57 Projects). docs/screens/SCR-04-사업현황.md
// 사업(입찰 한 건)에 연결된 검토들의 범위별 상태를 보여 준다 (add-project-status). 상태는 서버가 계산한다.
// "내 사업"은 머리글에서 고른 사용자 기준. "등록 전 범위" 칸은 만들지 않았다 (SCR-04_공유.md).

type Filter = { st: 'open' | 'done' | 'all'; cty: string; due: '' | '3' | '7'; qf: 'all' | 'name' | 'cust' | 'tender'; q: string }
const START: Filter = { st: 'open', cty: '', due: '', qf: 'all', q: '' }
const SCOPES: ['mine' | 'all', string][] = [['mine', '내 사업'], ['all', '팀 전체']]
const DUE: [Filter['due'], string][] = [['', '전체'], ['3', '3일 안'], ['7', '7일 안']]

function match(b: BusinessListItem, f: Filter) {
  const q = f.q.trim().toLowerCase()
  const name = b.business_name
  const cust = b.customer_name ?? ''
  const tender = b.tender_no ?? ''
  const text = { all: name + cust + tender, name, cust, tender }[f.qf]
  const done = b.submitted_at !== null
  return (f.st === 'all' || (f.st === 'done' ? done : !done)) && (!f.cty || b.country === f.cty)
    && (!f.due || (b.days_left !== null && b.days_left >= 0 && b.days_left <= Number(f.due))) && (!q || text.toLowerCase().includes(q))
}

// 마감 가까운 순, 마감이 없으면 뒤로
const dueOrder = (b: BusinessListItem) => b.days_left ?? Number.MAX_SAFE_INTEGER

export function Projects() {
  usePageCss('Projects')
  const { user } = useSession()
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  // 검색 칸은 고친 값(draft)과 적용한 값(applied)을 따로 둔다. 검색 단추나 Enter로 적용 (목업과 같음)
  const [draft, setDraft] = useState<Filter>(START)
  const [applied, setApplied] = useState<Filter>(START)
  const mine = scope === 'mine' && user !== null
  const list = useLoad(() => api.businesses(user?.user_id ?? null, mine ? 'mine' : 'all'), [user?.user_id, mine])
  // 처리 중인 검토가 있으면 5초마다 다시 본다
  useRepeat(!!list.data?.items.some((b) => b.ranges.some((r) => r.state === 'an')), list.reload)
  const base = list.data?.items ?? []
  const countries = [...new Set(base.map((b) => b.country).filter((c): c is string => !!c))]
  const rows = base.filter((b) => match(b, applied)).sort((a, b) => dueOrder(a) - dueOrder(b))
  const set = (part: Partial<Filter>) => setDraft({ ...draft, ...part })
  const sum = list.data?.summary

  return (
    <main className="main">
      <div className="ttl"><h1>사업 현황</h1><a className="bp" href={href('/register')}><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>add</span>RFP 등록</a></div>
      <div className="sh-sum">
        <span>진행 중 사업<b>{sum?.open ?? '—'}</b></span>
        <span>3일 내 제출 마감<b className="c-red">{sum?.due3 ?? '—'}</b></span>
        <span>마감 지남<b className="c-red">{sum?.overdue ?? '—'}</b></span>
      </div>
      <section className="sec">
        <div className="sech"><h2>사업 <span style={{ fontWeight: 400, color: '#667085' }}>{rows.length}</span></h2>
          <div className="seg" role="group" aria-label="범위">
            {SCOPES.map(([k, label]) => <button key={k} type="button" className={scope === k ? 'on' : ''} aria-pressed={scope === k} onClick={() => setScope(k)}>{label}</button>)}
          </div>
        </div>
        <div className="sp" role="search" aria-label="사업 찾기">
          <div className="sp-r1">
            <label className="sp-f"><span className="sp-l">상태</span>
              <select className="fi" value={draft.st} onChange={(e) => set({ st: e.target.value as Filter['st'] })}>
                <option value="open">진행 중</option><option value="done">제출 완료</option><option value="all">전체</option></select></label>
            <label className="sp-f"><span className="sp-l">국가</span>
              <select className="fi" value={draft.cty} onChange={(e) => set({ cty: e.target.value })}>
                <option value="">모든 국가</option>{countries.map((c) => <option key={c}>{c}</option>)}</select></label>
            <div className="sp-f" role="radiogroup" aria-label="제출 마감"><span className="sp-l">제출 마감</span>
              {DUE.map(([k, label]) => <label key={k} className="sp-rd"><input type="radio" name="due" checked={draft.due === k} onChange={() => set({ due: k })} />{label}</label>)}</div>
          </div>
          <div className="sp-r2">
            <select className="fi sp-qf" value={draft.qf} onChange={(e) => set({ qf: e.target.value as Filter['qf'] })} aria-label="검색 대상">
              <option value="all">-전체-</option><option value="name">사업명</option><option value="cust">고객사</option><option value="tender">입찰 번호</option></select>
            <input className="fi sp-q" value={draft.q} onChange={(e) => set({ q: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') setApplied(draft) }}
              placeholder="사업명, 고객사, 고객 입찰 번호" aria-label="검색어" />
            <button type="button" className="bo" onClick={() => { setDraft(START); setApplied(START) }}>초기화</button>
            <button type="button" className="bp" onClick={() => setApplied(draft)}><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>search</span>검색</button>
          </div>
        </div>
        {list.error && <div className="sh-empty" role="alert">사업 목록을 불러오지 못했습니다: {list.error}</div>}
        <div className="sh-box" style={{ marginTop: 16 }}>
          <div className="pl-tr sh-th"><span>순번</span><span>사업명</span><span>고객사 · 국가</span><span>고객 입찰 번호</span><span>제출 마감</span><span>설비 범위별 진행</span><span>내 역할</span><span>영업</span><span /></div>
          {list.data && rows.length === 0 && (
            <div className="sh-empty">{base.length === 0 && mine ? '내가 관여한 사업이 없습니다. "팀 전체"를 눌러 보세요.' : '조건에 맞는 사업이 없습니다.'}</div>
          )}
          {!list.data && !list.error && <div className="sh-empty">불러오는 중…</div>}
          {rows.map((b, i) => (
            <a key={b.business_id} className="pl-tr pl-row" href={href(`/projects/${b.business_no}`)}>
              <span className="mono sh-mut" style={{ textAlign: 'right' }}>{i + 1}</span>
              <span className="pl-nm"><b>{b.business_name}</b><span className="ell mono">{b.business_no}</span></span>
              <span className="pl-nm"><span style={{ color: '#1F2937' }}>{b.customer_name ?? '—'}</span><span>{b.country ?? ''}</span></span>
              <span className="mono sh-mut">{b.tender_no ?? '—'}</span>
              <span><span className={'dd ' + ddCls(b)}>{ddText(b)}</span><span className="mono sh-mut" style={{ display: 'block' }}>{b.due_date ? dueText(b.due_date) : ''}</span></span>
              <span className="pl-rg">
                {b.ranges.length === 0 && <span className="sh-mut">연결된 검토 없음</span>}
                {b.ranges.map((r) => (
                  <span key={r.run_id} className={`pj-ch ${RANGE_CHIP[r.state]}`}
                    title={`${r.review_name ?? r.review_no} · ${r.engineer_name ?? '담당 없음'}${r.open_requests ? ` · 협조 미확인 ${r.open_requests}건` : ''}`}>
                    {RANGE_NAMES[r.state]}</span>
                ))}</span>
              <span className="sh-mut" style={{ color: '#1F2937' }}>{b.my_role ? BUSINESS_ROLE_NAMES[b.my_role] : '—'}</span>
              <span className="sh-mut">{b.sales_name ?? '—'}</span>
              <span className="ms" aria-hidden="true" style={{ color: '#98A2B3' }}>chevron_right</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}
