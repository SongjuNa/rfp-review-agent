import { useState } from 'react'
import { EXAMPLE_PROJECTS, type Project } from '../../examples/SCR-04'
import { usePageCss } from '../../shell/pageCss'
import { href } from '../../shell/router'
import { ExampleBand } from '../detail/ExampleTab'

// SCR-04 사업 현황 (목업 v4.57 Projects). docs/screens/SCR-04-사업현황.md
// 사업 단위(여러 검토를 묶는 입찰 건) API가 없어 예시 데이터로만 보여 준다.

type Filter = { st: 'open' | 'done' | 'all'; cty: string; due: '' | '3' | '7'; qf: 'all' | 'name' | 'cust' | 'tender'; q: string }
const START: Filter = { st: 'open', cty: '', due: '', qf: 'all', q: '' }
const SCOPES: ['mine' | 'all', string][] = [['mine', '내 사업'], ['all', '팀 전체']]
const DUE: [Filter['due'], string][] = [['', '전체'], ['3', '3일 안'], ['7', '7일 안']]
const COUNTRIES = [...new Set(EXAMPLE_PROJECTS.map((p) => p.cty))]

function match(p: Project, f: Filter) {
  const q = f.q.trim().toLowerCase()
  const text = { all: p.short + p.title + p.cust + p.tender, name: p.short + p.title, cust: p.cust, tender: p.tender }[f.qf]
  return (f.st === 'all' || (f.st === 'done' ? p.done : !p.done)) && (!f.cty || p.cty === f.cty)
    && (!f.due || (p.n >= 0 && p.n <= Number(f.due))) && (!q || text.toLowerCase().includes(q))
}

const ddCls = (p: Project) => 'dd ' + (p.done ? 'neu' : p.n <= 3 ? 'neg' : p.n <= 7 ? 'crit' : 'neu')

export function Projects() {
  usePageCss('Projects')
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  // 검색 칸은 고친 값(draft)과 적용한 값(applied)을 따로 둔다. 검색 단추나 Enter로 적용 (목업과 같음)
  const [draft, setDraft] = useState<Filter>(START)
  const [applied, setApplied] = useState<Filter>(START)
  const base = EXAMPLE_PROJECTS.filter((p) => scope === 'all' || p.mine)
  const rows = base.filter((p) => match(p, applied)).sort((a, b) => a.n - b.n)
  const set = (part: Partial<Filter>) => setDraft({ ...draft, ...part })

  return (
    <main className="main">
      <ExampleBand />
      <div className="ttl"><h1>사업 현황</h1><a className="bp" href={href('/register')}><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>add</span>RFP 등록</a></div>
      <div className="sh-sum">
        <span>진행 중 사업<b>{base.filter((p) => !p.done).length}</b></span>
        <span>3일 내 제출 마감<b className="c-red">{base.filter((p) => !p.done && p.n >= 0 && p.n <= 3).length}</b></span>
        <span>마감 지남<b className="c-red">{base.filter((p) => !p.done && p.n < 0).length}</b></span>
        <span>등록 전 범위<b className="c-ora">{base.reduce((a, p) => a + p.ranges.filter((r) => r.key === 'pre').length, 0)}</b></span>
      </div>
      <section className="sec">
        <div className="sech"><h2>사업 <span style={{ fontWeight: 400, color: '#667085' }}>{rows.length}</span></h2>
          <div className="seg" role="group" aria-label="범위">
            {SCOPES.map(([k, label]) => <button key={k} type="button" className={scope === k ? 'on' : ''} onClick={() => setScope(k)}>{label}</button>)}
          </div>
        </div>
        <div className="sp" role="search" aria-label="사업 찾기">
          <div className="sp-r1">
            <label className="sp-f"><span className="sp-l">상태</span>
              <select className="fi" value={draft.st} onChange={(e) => set({ st: e.target.value as Filter['st'] })}>
                <option value="open">진행 중</option><option value="done">제출 완료</option><option value="all">전체</option></select></label>
            <label className="sp-f"><span className="sp-l">국가</span>
              <select className="fi" value={draft.cty} onChange={(e) => set({ cty: e.target.value })}>
                <option value="">모든 국가</option>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></label>
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
        <div className="sh-box" style={{ marginTop: 16 }}>
          <div className="pl-tr sh-th"><span>순번</span><span>사업명</span><span>고객사 · 국가</span><span>고객 입찰 번호</span><span>제출 마감</span><span>설비 범위별 진행</span><span>내 역할</span><span>영업</span><span /></div>
          {rows.length === 0 && <div className="sh-empty">조건에 맞는 사업이 없습니다.</div>}
          {rows.map((p, i) => (
            <a key={p.id} className="pl-tr pl-row" href={href(`/projects/${p.id}`)}>
              <span className="mono sh-mut" style={{ textAlign: 'right' }}>{i + 1}</span>
              <span className="pl-nm"><b>{p.short}</b><span className="ell">{p.title}</span></span>
              <span className="pl-nm"><span style={{ color: '#1F2937' }}>{p.cust}</span><span>{p.cty}</span></span>
              <span className="mono sh-mut">{p.tender}</span>
              <span><span className={ddCls(p)}>{p.done ? '제출함' : p.dd}</span><span className="mono sh-mut" style={{ display: 'block' }}>{p.due}</span></span>
              <span className="pl-rg">{p.ranges.map((r) => (
                <span key={r.lot + r.scope} className={`pj-ch ${r.key}`} title={`${r.scope} · ${r.owner} · ${r.note}`}>{(r.lot === '단일' ? '' : r.lot + ' ') + r.st}</span>
              ))}</span>
              <span className="sh-mut" style={{ color: '#1F2937' }}>{p.role}</span>
              <span className="sh-mut">{p.sales}</span>
              <span className="ms" aria-hidden="true" style={{ color: '#98A2B3' }}>chevron_right</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}
