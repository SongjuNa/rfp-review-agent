import { useState } from 'react'
import { api, type CompareRule, type DocKindRule, type ItemKey, type RiskExpression } from '../api'
import { ErrorText } from '../components/common'
import { Pager } from '../components/Pager'
import { DIRECTION_NAMES, DOC_KIND_NAMES, RISK_NAMES } from '../components/labels'
import { useLoad } from '../components/useLoad'
import { usePageCss } from '../shell/pageCss'
import { ExampleBand } from './detail/ExampleTab'

// SCR-17 판정 규칙 (목업 v4.57 Rules). docs/screens/SCR-17-판정규칙.md
// 읽기만 한다. 비교 방향·항목 이름·위험 표현·문서 종류 사전 네 가지와 쓴 횟수 (단위 탭은 단위 환산 금지 CR-10으로 뺐다).

type TabKey = 'dir' | 'name' | 'risk' | 'kind'
type Cell = { v: string; cls?: string; right?: boolean }
type Row = { key: string; search: string; cells: Cell[]; detail: [string, string][] }
type Tab = { label: string; ph: string; cols: [string, boolean][]; rows: Row[]; used: number }

const LOCK = '규칙 고치기는 이 change 범위 밖입니다 (data/seed를 고쳐 다시 적재)'
// 사람이 제안한 위험 표현 (예시). 제안·반영 흐름은 만들지 않는다 (SCR-17_공유.md)
const PROPOSED: [string, string, string, string, string][] = [
  ['10-29', '"online partial discharge monitoring sensors (UHF)"', '기술 검토 엔지니어 · 예시 검토', 'st c-blue', '확인 대기'],
  ['10-27', '"shall be capable of operating without derating"', '기술 검토 엔지니어 · 예시 검토', 'st c-green', '반영 · 10-28'],
  ['10-24', '"to the satisfaction of the Engineer"', '기술 검토 엔지니어 · 예시 검토', 'st c-green', '반영 · 10-28'],
]

const strength = (s: string | null) => (s === 'HIGHER' ? '클수록 강점' : s === 'LOWER' ? '작을수록 강점' : '강점 아님')
const dir = (d: string | null) => (d ? DIRECTION_NAMES[d] ?? d : '—')
const usedCell = (n: number): Cell => ({ v: `${n}건`, right: true, cls: n ? '' : 'c-grey' })

function dirTab(rules: CompareRule[]): Tab {
  return {
    label: '비교 방향', ph: '항목, 표, 방향',
    cols: [['항목', false], ['표 · 번호', false], ['방향', false], ['시간 조건', false], ['강점 방향', false], ['쓴 판정', true]],
    used: rules.reduce((a, r) => a + r.used, 0),
    rows: rules.map((r) => {
      const name = r.name_ko ?? r.item_key ?? '표준 항목 없음'
      const where = `${r.table_name ?? '—'}${r.item_no ? ` · ${r.item_no}번` : ''}`
      return {
        key: `dir:${r.compare_rule_id}`, search: [name, r.item_key, where, dir(r.direction), r.process_note].join(' '),
        cells: [{ v: name, cls: r.item_key ? '' : 'c-grey' }, { v: where, cls: 'mono' }, { v: dir(r.direction), cls: r.direction === 'AI' ? 'c-ora' : '' },
          { v: r.time_condition ? '시간도 비교' : '—' }, { v: strength(r.strength_direction) }, usedCell(r.used)],
        detail: [['표준 항목', r.item_key ?? '—'], ['처리', r.process_note ?? '—']],
      }
    }),
  }
}

function nameTab(items: ItemKey[]): Tab {
  return {
    label: '항목 이름', ph: 'RFP 표기, 표준 항목',
    cols: [['표준 항목', false], ['RFP에 나오는 표기', false], ['제품표 칸', false], ['기본 방향', false], ['쓴 판정', true]],
    used: items.reduce((a, r) => a + r.used, 0),
    rows: items.map((r) => ({
      key: `name:${r.item_key}`, search: [r.name_ko, r.item_key, ...r.aliases].join(' '),
      cells: [{ v: r.name_ko }, { v: r.aliases.length ? r.aliases.join(', ') : '같은 뜻 표현 없음', cls: r.aliases.length ? '' : 'c-grey' },
        { v: r.pm_column ?? (r.fixed_key ? `고정값 ${r.fixed_key}` : '—'), cls: 'mono' }, { v: dir(r.default_direction) }, usedCell(r.used)],
      detail: [['표준 항목 키', r.item_key], ['강점 방향', strength(r.strength_direction)], ['메모', r.note ?? '—']],
    })),
  }
}

function riskTab(exprs: RiskExpression[]): Tab {
  return {
    label: '위험 표현', ph: '영문 표현, 위험 종류',
    cols: [['표현 (원문)', false], ['위험 종류', false], ['언어', false], ['위험으로 보는 조건', false], ['쓴 횟수', true]],
    used: exprs.reduce((a, r) => a + r.used, 0),
    rows: exprs.map((r) => ({
      key: `risk:${r.expr_id}`, search: [r.expression, RISK_NAMES[r.risk_kind] ?? r.risk_kind, r.context_rule].join(' '),
      cells: [{ v: r.expression }, { v: RISK_NAMES[r.risk_kind] ?? r.risk_kind }, { v: r.language, cls: 'mono' },
        { v: r.context_rule, cls: r.context_rule.includes('미정') ? 'c-ora' : '' }, usedCell(r.used)],
      detail: [['위험 조건 후보 수', `${r.used}건 (이 표현으로 찾은 후보, 확정은 사람)`]],
    })),
  }
}

function kindTab(rules: DocKindRule[]): Tab {
  return {
    label: '문서 종류', ph: '문서 종류, 찾는 표현',
    cols: [['문서 종류', false], ['파일 이름에서 찾는 표현', false], ['첫 장에서 찾는 표현', false], ['순서', true], ['분류한 문서', true]],
    used: rules.reduce((a, r) => a + r.used, 0),
    rows: rules.map((r) => ({
      key: `kind:${r.doc_kind_rule_id}`, search: [DOC_KIND_NAMES[r.doc_kind], r.doc_kind, r.name_pattern, r.page_pattern, r.note].join(' '),
      cells: [{ v: DOC_KIND_NAMES[r.doc_kind] ?? r.doc_kind }, { v: r.name_pattern, cls: 'mono' },
        { v: r.page_pattern ?? '파일 이름만 봄', cls: r.page_pattern ? 'mono' : 'c-grey' }, { v: String(r.priority), right: true },
        { v: `${r.used}개`, right: true, cls: r.used ? '' : 'c-grey' }],
      detail: [['메모', r.note ?? '—'], ['찾는 순서', '모든 줄의 파일 이름 표현을 위에서부터 본 뒤, 맞는 것이 없으면 첫 장 표현을 본다. 아무것도 안 맞으면 "종류 모름"(확인 필요)'],
        ['분류한 문서', `${r.used}개 (규칙이 이 종류로 정한 문서. AI·사람이 정한 문서는 빼고 셈)`]],
    })),
  }
}

export function Rules() {
  usePageCss('Rules')
  const [tab, setTab] = useState<TabKey>('dir')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const data = useLoad(() => Promise.all([api.compareRules(), api.ruleItems(), api.riskExpressions(), api.docKindRules()]), [])

  const tabs: Record<TabKey, Tab> | null = data.data
    ? { dir: dirTab(data.data[0]), name: nameTab(data.data[1]), risk: riskTab(data.data[2]), kind: kindTab(data.data[3]) }
    : null
  const T = tabs?.[tab]
  const needle = q.trim().toLowerCase()
  const found = T ? T.rows.filter((r) => !needle || r.search.toLowerCase().includes(needle)) : []
  const rows = found.slice((page - 1) * size, page * size)

  return (
    <main className="main">
      <div className="ttl">
        <h1>판정 규칙</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span title="수정 요청 보내기는 아직 없습니다"><button type="button" className="bo" disabled><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>edit_note</span>수정 요청</button></span>
          <span title={LOCK}><button type="button" className="bp" disabled><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>lock</span>규칙 추가</button></span>
        </div>
      </div>
      <section className="rkp" aria-labelledby="rkpT">
        <ExampleBand />
        <div className="rkp-h"><h2 id="rkpT">위험 표현 사전 · 사람이 제안한 표현</h2><span>검토 중 엔지니어가 찾은 특이 요구입니다. 규칙 담당이 확인하면 사전에 들어가 다음 검토부터 위험 조건으로 잡힙니다.</span></div>
        {PROPOSED.map(([d, ex, by, cls, st]) => (
          <div key={ex} className="rkp-r"><span className="mono">{d}</span><b>{ex}</b><span>{by}</span><span className={cls}>{st}</span></div>
        ))}
        <div className="rkp-f"><a href="#/eval">반영 후 점수 변화는 정답지·채점에서 봅니다<span className="ms" aria-hidden="true">chevron_right</span></a></div>
      </section>
      <div className="rtabs" role="tablist" aria-label="규칙 종류">
        {(['dir', 'risk', 'name', 'kind'] as TabKey[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''}
            onClick={() => { setTab(k); setQ(''); setOpen({}); setPage(1) }}>
            {tabs?.[k].label ?? { dir: '비교 방향', name: '항목 이름', risk: '위험 표현', kind: '문서 종류' }[k]}<span className="n">{tabs?.[k].rows.length ?? '…'}</span>
          </button>
        ))}
      </div>
      <section className="sec" style={{ marginTop: 16 }}>
        <ErrorText error={data.error} />
        <div className="rhead"><span>마지막 수정 <b>기록 없음</b></span><span>{tab === 'kind' ? '규칙이 분류한 문서' : '지금 판정에 쓰임'} <b>{T ? `${T.used.toLocaleString('en-US')}${tab === 'kind' ? '개' : '회'}` : '…'}</b></span></div>
        <div className="filters" role="search" style={{ marginTop: 0 }}>
          <label htmlFor="rq" className="sr">규칙 검색</label>
          <input className="fi" id="rq" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder={T?.ph} style={{ flex: '1 1 260px', maxWidth: 340 }} />
          {q && <button type="button" className="bo" onClick={() => { setQ(''); setPage(1) }}>검색 지우기</button>}
        </div>
        <div className="tw">
          <table className="tbl">
            <thead><tr>{T?.cols.map(([label, right]) => <th key={label} style={right ? { textAlign: 'right' } : undefined}>{label}</th>)}</tr></thead>
            <tbody>
              {rows.flatMap((r) => {
                const op = !!open[r.key]
                const toggle = () => setOpen({ ...open, [r.key]: !op })
                const out = [
                  <tr key={r.key} className={op ? 'on' : ''} onClick={toggle} style={{ cursor: 'pointer' }}
                    tabIndex={0} aria-expanded={op} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}>
                    {r.cells.map((c, k) => (
                      <td key={k} style={{ ...(c.right ? { textAlign: 'right' } : {}), ...(k === 0 ? { fontWeight: 600, whiteSpace: 'nowrap' } : {}) }}>
                        {k === 0 && <span className="ms caret" aria-hidden="true">{op ? 'expand_more' : 'chevron_right'}</span>}
                        <span className={c.cls}>{c.v}</span>
                      </td>
                    ))}
                  </tr>,
                ]
                if (op) out.push(
                  <tr key={`${r.key}:x`} className="rx"><td colSpan={T?.cols.length}><div className="rxin">
                    <div><h4>이 규칙의 내용</h4><ul>{r.detail.map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul></div>
                    <div><h4>수정 이력</h4><ul><li>수정 이력을 저장하지 않습니다 (기준 데이터 적재본 그대로)</li></ul></div>
                  </div></td></tr>,
                )
                return out
              })}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && <Pager total={found.length} page={page} size={size} shown={rows.length} onPage={setPage} onSize={(n) => { setSize(n); setPage(1) }} />}
        {T && rows.length === 0 && <p style={{ margin: 0, padding: '16px 12px', color: '#667085' }}>조건에 맞는 규칙이 없습니다.</p>}
      </section>
    </main>
  )
}
