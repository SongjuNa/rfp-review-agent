import { useState } from 'react'
import type { Project as ProjectRow } from '../../examples/SCR-04'
import { usePageCss } from '../../shell/pageCss'
import { href } from '../../shell/router'
import { ExampleBand } from '../detail/ExampleTab'

// SCR-05 사업 상세 (목업 v4.57 Project). docs/screens/SCR-05-사업상세.md
// 사업 단위 API가 없어 예시 데이터로만 보여 준다. 접속 상태도 예시다.

type Tab = 'ov' | 'ppl' | 'sch' | 'doc' | 'his'
const TABS: [Tab, string][] = [['ov', '개요'], ['ppl', '담당자'], ['sch', '일정'], ['doc', '문서'], ['his', '지난 이력']]
// 목업에서 접속 중으로 보이는 사람 (역할 이름으로 바꿈)
const ONLINE = new Set(['기술 검토 엔지니어 A', '기술 검토 엔지니어 B', '기술 검토 엔지니어 C', '기술 검토 엔지니어 D', '결재자', '영업 담당 A', '견적 담당 A', '설계 담당 A'])
const ME = '기술 검토 엔지니어 A'
const KINDS: Record<string, string> = { '입찰 안내서': 'st c-grey', '기술 사양': 'st c-blue', Addendum: 'st c-ora', '질의 회신': 'st c-green' }
const GO: Record<string, string> = { pre: 'RFP 등록하기', done: '입찰 결과 보기', fail: '오류 내용 보기', ap: '결재 대기 보기', co: '협조 요청 보기' }

export function Project({ project: p }: { project: ProjectRow }) {
  usePageCss('Project')
  const [tab, setTab] = useState<Tab>('ov')
  const next = p.sched.find((e) => e[2] === 'next')
  const ddCls = p.done ? '' : p.n <= 3 ? 'neg' : p.n <= 7 ? 'crit' : ''

  return (
    <main className="main">
      <ExampleBand />
      <div className="pd-top"><span className="mono">{p.id}</span><span>고객 입찰 번호 {p.tender}</span><span className={p.done ? 'st c-green' : 'st c-blue'}>{p.done ? '제출 완료' : '진행 중'}</span></div>
      <div className="ttl" style={{ marginTop: 6 }}><h1>{p.title}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="bo" href={href('/projects')}><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>list</span>사업 목록</a>
          <a className="bp" href={href('/register')}><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>add</span>이 사업에 RFP 등록</a>
        </div>
      </div>
      <dl className="pd-info">
        <div><dt>사업명 (검토명 앞부분)</dt><dd>{p.short}</dd></div>
        <div><dt>고객사 · 국가</dt><dd>{p.cust} · {p.cty}</dd></div>
        <div><dt>발주 방식</dt><dd>{p.mode}</dd></div>
        <div><dt>제출 마감</dt><dd><b className={ddCls}>{p.done ? '제출함' : p.dd}</b> {p.due}</dd></div>
        <div><dt>다음 일정</dt><dd>{next ? `${next[1]} · ${next[0]} (${next[3]})` : '—'}</dd></div>
        <div><dt>내 역할</dt><dd>{p.role}</dd></div>
      </dl>
      <div className="pgtabs" role="tablist" style={{ marginTop: 24 }}>
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" className={tab === k ? 'on' : ''} aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}{k === 'ov' ? ` (${p.ranges.length})` : ''}</button>
        ))}
      </div>

      {tab === 'ov' && (
        <div className="pd-cards">{p.ranges.map((r) => (
          <a key={r.lot + r.scope} className="pd-card" href={href(r.href)}>
            <span className="pd-ch"><span className="pd-lot">{r.lot === '단일' ? '단일 발주' : r.lot}</span><span className={r.stCls}>{r.st}</span></span>
            <b className="pd-sc">{r.scope}</b>
            <span className="mono sh-mut">{r.rv || '검토 번호 없음 (등록 전)'}</span>
            <span className="pd-own"><span className="hm-av" aria-hidden="true" style={{ width: 26, height: 26, fontSize: 11 }}>{r.owner[0]}</span>{r.owner}</span>
            <span className="pd-note">{r.note}</span>
            <span className="pd-go">{GO[r.key] ?? '검토 열기'}<span className="ms" aria-hidden="true">chevron_right</span></span>
          </a>
        ))}</div>
      )}

      {tab === 'ppl' && (
        <>
          <h3 className="pd-h3">사내 담당자</h3>
          <div className="sh-box">
            <div className="pp-tr sh-th"><span>역할</span><span>이름</span><span>맡은 범위</span><span>상태</span><span /></div>
            {p.team.map(([role, name, scope]) => (
              <div key={role + name + scope} className="pp-tr pp-row">
                <span className="sh-mut" style={{ color: '#475467', fontWeight: 600 }}>{role}</span>
                <span className="pd-own"><span className="hm-av" aria-hidden="true" style={{ width: 28, height: 28, fontSize: 12 }}>{name[0]}<i className={ONLINE.has(name) ? 'on' : ''} /></span>{name}{name === ME && <span className="pp-me">나</span>}</span>
                <span className="sh-mut">{scope}</span>
                <span className="sh-mut">{ONLINE.has(name) ? '접속 중' : name === '품질 담당' ? '24시간 넘게 미확인 1건' : '자리 비움'}</span>
                <span style={{ textAlign: 'right' }}>{name !== ME && role !== '결재' && <a className="bo pp-btn" href={href('/todo')}>협조 요청</a>}</span>
              </div>
            ))}
          </div>
          <h3 className="pd-h3">고객 측 창구</h3>
          <div className="sh-box">{p.client.map(([role, co, ch]) => (
            <div key={role} className="pp-tr pp-row"><span className="sh-mut" style={{ color: '#475467', fontWeight: 600 }}>{role}</span><span>{co}</span><span className="sh-mut" style={{ gridColumn: 'span 3' }}>{ch}</span></div>
          ))}</div>
          <div className="sh-note"><span className="ms" aria-hidden="true">info</span><span>고객 측 담당자의 개인 연락처는 저장하지 않습니다. 공식 질의는 고객이 정한 창구로만 보냅니다.</span></div>
        </>
      )}

      {tab === 'sch' && (
        <ol className="ptl">{p.sched.map(([date, label, st, tag]) => (
          <li key={date + label} className={st}><span className="tl-dot" /><span className="mono tl-d">{date}</span><b>{label}</b>
            <span className={st === 'next' ? 'st c-blue' : 'sh-mut'}>{st === 'done' ? '지남' : tag}</span></li>
        ))}</ol>
      )}

      {tab === 'doc' && (
        <div className="sh-box">
          <div className="dc-tr sh-th"><span>문서</span><span>종류</span><span>받은 날</span><span>영향 범위</span></div>
          {p.docs.map(([name, kind, date, lots]) => (
            <div key={name} className="dc-tr pp-row"><span className="pd-own"><span className="ms" aria-hidden="true" style={{ color: '#667085' }}>description</span><span className="ell">{name}</span></span>
              <span><span className={KINDS[kind] ?? 'st c-grey'}>{kind}</span></span><span className="mono sh-mut">{date}</span><span className="sh-mut">{lots}</span></div>
          ))}
        </div>
      )}

      {tab === 'his' && (
        <>
          <p className="sh-mut" style={{ margin: '0 0 10px' }}>같은 고객 {p.cust}의 지난 입찰입니다.</p>
          <div className="sh-box">
            {p.hist.length === 0 && <div className="sh-empty">이 고객과의 지난 입찰이 없습니다.</div>}
            {p.hist.map(([bid, name, md, y, res, cls]) => (
              <a key={bid} className="hs-tr pp-row pl-link" href={href(`/bids/${bid}`)}><span className="mono sh-mut">{bid}</span><b>{name}</b><span className="mono sh-mut">{y}-{md}</span>
                <span><span className={cls}>{res}</span></span><span className="ms" aria-hidden="true" style={{ color: '#98A2B3' }}>chevron_right</span></a>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
