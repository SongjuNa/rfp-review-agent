import { useState } from 'react'
import { api, type ItemKey, type Product, type ProductDetail } from '../api'
import { Pager } from '../components/Pager'
import { productPhoto } from '../components/productPhotos'
import { FAMILY_NAMES, POINT_KIND_NAMES, RESULT_NAMES, RESULT_TONES, STATUS_NAMES } from '../components/labels'
import { useLoad } from '../components/useLoad'
import { href } from '../shell/router'
import { usePageCss } from '../shell/pageCss'

// SCR-16 제품표 (목업 v4.57 Products). docs/screens/SCR-16-제품표.md
// 읽기만 한다. 빈 칸은 "비어 있음", 그 제품군에 없는 칸은 "—", 팀 가정 값은 "팀 가정" (CR-04, CR-06).

type Col = { key: keyof Product & string; label: string; unit: string; item?: string; lower?: boolean }
// 표의 주요 칸. item = 강점 방향을 읽는 표준 항목 (item_pm_mapping), lower = 작을수록 강점 (손실, FR-13)
const COLS: Col[] = [
  { key: 'rated_voltage_kv', label: '정격 전압', unit: 'kV', item: 'rated_voltage_um' },
  { key: 'rated_current_a', label: '정격 전류', unit: 'A', item: 'rated_current' },
  { key: 'short_circuit_ka', label: '단시간 견딤 전류', unit: 'kA', item: 'short_time_current' },
  { key: 'rated_frequency', label: '정격 주파수', unit: 'Hz', item: 'rated_frequency' },
  { key: 'rated_capacity', label: '정격 용량', unit: '', item: 'rated_capacity' },
  { key: 'noload_loss_kw', label: '무부하 손실', unit: 'kW', lower: true },
  { key: 'load_loss_kw', label: '부하 손실', unit: 'kW', lower: true },
  { key: 'weight_kg', label: '중량', unit: 'kg', item: 'weight' },
]
const SHORT: Record<string, string> = {
  rated_voltage_kv: '전압 kV', rated_current_a: '정격 전류 A', short_circuit_ka: '단시간 kA', rated_frequency: '주파수 Hz',
  rated_capacity: '용량', noload_loss_kw: '무부하손 kW', load_loss_kw: '부하손 kW', weight_kg: '중량 kg',
}
// 값 탭에 보이는 나머지 칸 (설명 글 칸 포함)
const MORE: [string, string][] = [
  ['aux_loss_kw', '보조 손실 (kW)'], ['standards', '적용 규격'], ['certifications', '인증'], ['ip_rating', '보호 등급'],
  ['operating_temp', '사용 온도'], ['dimensions_mm', '외형 (mm)'], ['market', '시장'], ['lifecycle_status', '수명 주기'],
  ['warranty_months', '보증 기간 (개월)'], ['std_lead_time_weeks', '표준 납기 (주)'], ['description', '설명'],
]
const LOSS = new Set(['noload_loss_kw', 'load_loss_kw', 'aux_loss_kw'])
// 비교값 칸 (백엔드 products.COMPARISON_COLUMNS). comparison_values_assumed가 참이면 팀 가정 (CR-06)
const COMPARISON = new Set(['lightning_impulse_kv', 'power_freq_withstand_kv', 'switching_impulse_kv', 'peak_current_ka',
  'making_current_ka', 'breaking_time_ms', 'closing_time_ms', 'gas_leakage_percent', 'partial_discharge_pc', 'cooling_type',
  'insulation_medium', 'maintenance_months', 'service_life_years'])
const LOCK = '제품표 고치기는 이 change 범위 밖입니다 (data/seed를 고쳐 다시 적재)'

type Cell = { text: string; cls: string; sub: string; state: 'na' | 'empty' | 'assume' | 'ok' }

function fmt(v: unknown): string {
  if (typeof v === 'number') return v.toLocaleString('en-US')
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) return Number(v).toLocaleString('en-US')
  return String(v)
}

/** 칸 하나: 제품군에 없는 칸 "—", 판정에 쓰는데 빈 칸 "비어 있음", 팀 가정이면 아래 줄에 "팀 가정" */
function cell(p: Product | ProductDetail, key: string): Cell {
  const v = (p as Record<string, unknown>)[key]
  if (v === null || v === undefined || v === '') {
    return p.value_columns.includes(key) ? { text: '비어 있음', cls: 'c-ora', sub: '', state: 'empty' } : { text: '—', cls: 'dimv', sub: '', state: 'na' }
  }
  const assumed = p.is_assumed || (LOSS.has(key) && !!p.loss_is_assumed) || (COMPARISON.has(key) && p.comparison_values_assumed)
  const text = key === 'rated_capacity' && p.rated_capacity_unit ? `${fmt(v)} ${p.rated_capacity_unit}` : fmt(v)
  return { text, cls: '', sub: assumed ? '팀 가정' : '', state: assumed ? 'assume' : 'ok' }
}

function strength(c: Col, items: ItemKey[]): string {
  if (c.lower) return '작을수록 강점'
  const s = items.find((i) => i.item_key === c.item)?.strength_direction
  return s === 'HIGHER' ? '클수록 강점' : s === 'LOWER' ? '작을수록 강점' : '강점 아님'
}

export function Products() {
  usePageCss('Products')
  const [view, setView] = useState<'list' | 'cmp'>('list')
  const [fam, setFam] = useState('all')
  const [q, setQ] = useState('')
  const [cards, setCards] = useState(true)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [sel, setSel] = useState<string[]>([])
  // 목업처럼 처음에는 목록 첫 제품의 패널을 펼친다. 닫으면(null) 다시 열지 않는다
  const [picked, setCur] = useState<string | null | undefined>(undefined)
  const [ptab, setPtab] = useState<'graph' | 'vals'>('graph')
  const [diffOnly, setDiffOnly] = useState(false)
  const fams = useLoad(() => api.productFamilies(), [])
  const items = useLoad(() => api.ruleItems(), [])
  const list = useLoad(() => api.products({ family: fam === 'all' ? undefined : fam, q: q.trim() || undefined, offset: (page - 1) * size, limit: size, cards: cards ? undefined : 'false' }),
    [fam, q, page, size, cards])
  const cmp = useLoad(() => Promise.all(sel.map((c) => api.product(c))), [sel.join(',')])

  const all = fams.data ?? []
  const total = all.reduce((n, f) => n + f.products, 0)
  const sum = (k: 'empty_cells' | 'assumed' | 'design_cards' | 'with_empty') => all.reduce((n, f) => n + f[k], 0)
  const rows = list.data?.items ?? []
  const cur = picked === undefined ? rows[0]?.product_code ?? null : picked
  const detail = useLoad(() => (cur ? api.product(cur) : Promise.resolve(null)), [cur])
  const toggle = (code: string) => setSel(sel.includes(code) ? sel.filter((c) => c !== code) : [...sel, code])

  return (
    <main className="main">
      <nav className="pgtabs" aria-label="제품표 메뉴">
        <a className={view === 'list' ? 'on' : ''} href="#/products" onClick={(e) => { e.preventDefault(); setView('list') }}>제품 목록</a>
        <a className={view === 'cmp' ? 'on' : ''} href="#/products" onClick={(e) => { e.preventDefault(); setView('cmp') }}>비교 ({sel.length})</a>
      </nav>
      <div className="idl"><span>product_master</span><span>제품 {total} · 제품군 {all.length}</span><span>지금 DB에 적재된 판 (실행이 쓴 판과 다를 수 있음)</span></div>
      <div className="ttl">
        <h1>제품표</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span title={LOCK}><button type="button" className="bo" disabled><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>upload</span>엑셀 가져오기</button></span>
          <span title="내보내기는 내보내기 change에서 만듭니다"><button type="button" className="bo" disabled><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>download</span>내보내기</button></span>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="l">비어 있는 칸</div><b className="c-ora">{fams.data ? sum('empty_cells') : '—'}</b><div className="s">판정에 쓰는 칸 · 제품 {sum('with_empty')}개</div></div>
        <div className="kpi"><div className="l">팀 가정 값</div><b className="c-blue">{fams.data ? sum('assumed') : '—'}</b><div className="s">변압기 손실값 등</div></div>
        <div className="kpi"><div className="l">설계 사례 카드</div><b>{fams.data ? sum('design_cards') : '—'}</b><div className="s">기본 비교 제품 아님</div></div>
      </div>

      {view === 'list' ? (
        <section className="sec" style={{ marginTop: 24 }}>
          <div className="fbar">
            {[{ family: 'all', products: total }, ...all].map((f) => (
              <button key={f.family} type="button" className={`chip${fam === f.family ? ' on' : ''}`} aria-pressed={fam === f.family}
                onClick={() => { setFam(f.family); setPage(1) }}>{f.family === 'all' ? '전체' : FAMILY_NAMES[f.family] ?? f.family} <span className="n">{f.products}</span></button>
            ))}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: '#475467', marginLeft: 4 }}>
              <input type="checkbox" checked={cards} onChange={(e) => { setCards(e.target.checked); setPage(1) }} style={{ accentColor: '#0569A0' }} />설계 사례 카드 포함</label>
            <span style={{ flex: '1 1 0' }} />
            <label className="sr" htmlFor="pq">제품 검색</label>
            <input className="fi" id="pq" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="제품 코드, 이름" style={{ width: 180 }} />
            <span title="요구 조건으로 찾기는 이 change 범위 밖입니다"><button type="button" className="bo" disabled><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>manage_search</span>요구 조건으로 찾기</button></span>
            <button type="button" className="bp" disabled={sel.length < 2} onClick={() => setView('cmp')}><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>compare_arrows</span>선택한 {sel.length}개 비교</button>
          </div>
          <div className={`work${cur ? ' open' : ''}`}>
            <div style={{ minWidth: 0 }}>
              <div className="tw">
                <table className="tbl">
                  <thead><tr>
                    <th style={{ width: 28 }}><span className="sr">비교에 넣기</span></th>
                    <th>제품</th><th>제품군</th>
                    {COLS.map((c) => <th key={c.key} style={c.key === 'rated_frequency' ? undefined : { textAlign: 'right' }}>{SHORT[c.key]}</th>)}
                  </tr></thead>
                  <tbody>
                    {list.data === null && !list.error && <tr><td colSpan={10} className="dimv">불러오는 중…</td></tr>}
                    {rows.map((p) => (
                      <tr key={p.product_code} className={cur === p.product_code ? 'cur' : undefined} onClick={() => { setCur(p.product_code) }} style={{ cursor: 'pointer' }}>
                        <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`${p.product_code} 비교에 넣기`} checked={sel.includes(p.product_code)}
                          disabled={!sel.includes(p.product_code) && sel.length >= 3} onChange={() => toggle(p.product_code)} style={{ accentColor: '#0569A0', marginTop: 2 }} /></td>
                        <td style={{ whiteSpace: 'nowrap' }}><span style={{ fontWeight: 600 }}>{p.product_code}</span>{p.is_design_card && <span className="tag">설계 사례</span>}
                          <div className="en">{p.source_doc}</div></td>
                        <td>{FAMILY_NAMES[p.family] ?? p.family}</td>
                        {COLS.map((c) => {
                          const x = cell(p, c.key)
                          return <td key={c.key} style={c.key === 'rated_frequency' ? undefined : { textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span className={x.cls}>{x.text}</span>{x.sub && <div className="en c-blue">{x.sub}</div>}</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 0 && <Pager total={list.data!.total} page={page} size={size} shown={rows.length} onPage={setPage} onSize={(n) => { setSize(n); setPage(1) }} />}
              </div>
              {list.error && <p role="alert">{list.error}</p>}
              {list.data !== null && rows.length === 0 && <p style={{ margin: 0, padding: '16px 10px', color: '#667085' }}>조건에 맞는 제품이 없습니다.</p>}
              <div className="tfoot"><span>{list.data?.total ?? 0}개 · 주요 {COLS.length}칸 (나머지 칸은 오른쪽 "값" 탭)</span><span>— 해당 없음 · <span className="c-ora">비어 있음</span> · 팀 가정</span></div>
            </div>
            {cur && <Panel code={cur} data={detail.data} error={detail.error} tab={ptab} onTab={setPtab} items={items.data ?? []} onClose={() => setCur(null)} />}
          </div>
        </section>
      ) : (
        <Compare products={cmp.data ?? []} items={items.data ?? []} diffOnly={diffOnly} onDiff={setDiffOnly} onBack={() => setView('list')} />
      )}
    </main>
  )
}

/** 오른쪽 제품 상세: 연결(판정에 쓰임, 제안 포인트, 값의 출처, 현장 이력) / 값(전체 칸) */
function Panel({ code, data, error, tab, onTab, items, onClose }: {
  code: string; data: ProductDetail | null; error: string | null; tab: 'graph' | 'vals'; onTab: (t: 'graph' | 'vals') => void; items: ItemKey[]; onClose: () => void
}) {
  const p = data?.product_code === code ? data : null
  const groups = p ? [
    { icon: 'fact_check', label: '판정에 쓰임', n: p.used, sub: p.used ? `검토 ${p.used_runs}건${p.used > p.used_in.length ? ` · 최근 ${p.used_in.length}줄` : ''}` : '',
      items: p.used_in.slice(0, 3).map((u) => ({ key: `j${u.judgment_id}`, text: u.item_name, tone: RESULT_TONES[u.result] ?? '', sub: `${u.review_no} · ${RESULT_NAMES[u.result] ?? u.result}`, to: `/reviews/${u.run_id}` })),
      more: p.used - Math.min(3, p.used_in.length), none: '아직 판정에 쓰이지 않음' },
    { icon: 'trending_up', label: '제안 포인트', n: p.proposals.length, sub: '',
      items: p.proposals.slice(0, 3).map((x) => ({ key: `p${x.point_id}`, text: `${POINT_KIND_NAMES[x.point_kind] ?? x.point_kind} 제안 포인트`, tone: 'c-green',
        sub: `RV · 실행 ${x.run_id} · ${STATUS_NAMES[x.status] ?? x.status}${x.is_assumed ? ' · 팀 가정' : ''}`, to: `/reviews/${x.run_id}` })),
      more: p.proposals.length - Math.min(3, p.proposals.length), none: '이 제품을 근거로 한 제안 포인트 없음' },
    { icon: 'menu_book', label: '값의 출처', n: 1, sub: '',
      items: [{ key: 'src', text: p.source_doc, tone: '', sub: `판정에 쓰는 칸 ${p.value_columns.length} · 빈 칸 ${p.empty_count}`, to: '' }], more: 0, none: '' },
    { icon: 'build', label: '현장 이력', n: p.field_history.length, sub: '',
      items: p.field_history.slice(0, 3).map((f) => ({ key: `f${f.fault_link_id}`, text: `${f.item_name} · ${f.fault_id}`, tone: '', sub: `${f.symptom} · 해결 사례 ${f.cases}건`, to: '' })),
      more: p.field_history.length - Math.min(3, p.field_history.length), none: `연결된 고장 사례 없음 (${FAMILY_NAMES[p.family] ?? p.family} 항목 없음)` },
  ] : []
  return (
    <aside className="panel" aria-label="제품 상세">
      <div className="ph">
        <div style={{ flex: '1 1 auto', minWidth: 0 }}><div className="en" style={{ margin: '0 0 2px' }}>{p ? `${FAMILY_NAMES[p.family] ?? p.family} · ${p.product_name}` : '불러오는 중…'}</div><h3>{code}</h3></div>
        <button type="button" className="ib" aria-label="닫기" onClick={onClose}><span className="ms" aria-hidden="true">close</span></button>
      </div>
      {p && <Photo sourceDoc={p.source_doc} />}
      <div className="ptabs" role="tablist">
        <button type="button" role="tab" className={tab === 'graph' ? 'on' : ''} aria-selected={tab === 'graph'} onClick={() => onTab('graph')}>연결</button>
        <button type="button" role="tab" className={tab === 'vals' ? 'on' : ''} aria-selected={tab === 'vals'} onClick={() => onTab('vals')}>값</button>
      </div>
      {error && <p role="alert" style={{ padding: '0 16px' }}>{error}</p>}
      {p && tab === 'graph' && (
        <div className="pb">
          <div className="graph">
            <div className="g-center"><span className="ms" aria-hidden="true" style={{ color: '#0569A0' }}>inventory_2</span><b>{p.product_code}</b><span className="en" style={{ margin: 0 }}>{p.is_design_card ? '설계 사례 카드' : '제품표'}</span></div>
            <div className="g-groups">
              {groups.map((g) => (
                <div key={g.label} className="g-group" aria-label={g.label}>
                  <div className="g-head"><span className="ms" aria-hidden="true">{g.icon}</span>{g.label}<span className="g-n">{g.n}</span></div>
                  {g.sub && <div className="en" style={{ margin: '0 0 4px' }}>{g.sub}</div>}
                  {g.items.map((it) => it.to
                    ? <a key={it.key} className="g-item" href={href(it.to)}><span className={it.tone} style={{ fontWeight: 600 }}>{it.text}</span><span className="en" style={{ margin: 0 }}>{it.sub}</span></a>
                    : <div key={it.key} className="g-item"><span style={{ fontWeight: 600 }}>{it.text}</span><span className="en" style={{ margin: 0 }}>{it.sub}</span></div>)}
                  {!g.items.length && g.none && <div className="g-item none"><span>{g.none}</span></div>}
                  {g.more > 0 && <span className="g-more">외 {g.more.toLocaleString('en-US')}건</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {p && tab === 'vals' && (
        <div className="pb" style={{ gap: 0 }}>
          {[['제품 이름', p.product_name], ['제품군', FAMILY_NAMES[p.family] ?? p.family]].map(([l, v]) => (
            <div key={l} className="vrow"><span className="vl">{l}</span><span className="vv"><span>{v}</span></span></div>
          ))}
          {COLS.map((c) => {
            const x = cell(p, c.key)
            return (
              <div key={c.key} className="vrow"><span className="vl">{c.label}{c.unit && ` (${c.unit})`}<span className="en" style={{ margin: 0 }}>{strength(c, items)}</span></span>
                <span className="vv"><span className={x.cls}>{x.text}</span><span className="en" style={{ margin: 0 }}>
                  {x.state === 'ok' ? p.source_doc : x.state === 'assume' ? '팀 가정 · 카탈로그에 없음' : x.state === 'empty' ? '판정 때 확인 필요가 됨' : '이 제품군에 해당 없음'}</span></span></div>
            )
          })}
          {MORE.map(([k, l]) => {
            const x = cell(p, k)
            return <div key={k} className="vrow"><span className="vl" style={{ flex: 'none' }}>{l}</span><span className="vv"><span className={x.cls} style={k === 'description' ? { fontWeight: 400, textAlign: 'left' } : undefined}>{x.text}</span></span></div>
          })}
        </div>
      )}
    </aside>
  )
}

/** 제품 계열 대표 사진과 출처 (add-product-photos). 모델마다 다른 사진이 아니라서 그렇게 적는다. */
function Photo({ sourceDoc }: { sourceDoc: string | null }) {
  const ph = productPhoto(sourceDoc)
  if (!ph) return <p className="en" style={{ margin: '0 16px 8px' }} aria-label="제품 사진">공식 사진 없음</p>
  return (
    <figure className="pimg" aria-label="제품 사진" style={{ margin: '0 16px 12px', padding: '10px 10px 8px' }}>
      <img src={ph.src} alt={`${ph.family} 대표 사진`} style={{ display: 'block', width: '100%', height: 180, objectFit: 'contain' }} />
      <figcaption>{ph.family} 대표 사진 · 이 모델만의 사진은 아님<br />
        사진 출처: <a href={ph.page} target="_blank" rel="noreferrer">{ph.site}</a></figcaption>
    </figure>
  )
}

/** 두세 제품을 칸마다 나란히. 값이 다른 줄은 노랗게, 강점 방향으로 가장 유리한 값에 ▲ */
function Compare({ products, items, diffOnly, onDiff, onBack }: {
  products: ProductDetail[]; items: ItemKey[]; diffOnly: boolean; onDiff: (v: boolean) => void; onBack: () => void
}) {
  const rows = COLS.map((c) => {
    const cs = products.map((p) => cell(p, c.key))
    const differs = new Set(cs.map((x) => x.text)).size > 1
    const dir = strength(c, items)
    const nums = products.map((p) => { const v = (p as Record<string, unknown>)[c.key]; return typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null })
    let best = -1
    const known = nums.filter((n): n is number => n !== null)
    if (differs && dir !== '강점 아님' && known.length >= 2) {
      const pick = dir === '클수록 강점' ? Math.max(...known) : Math.min(...known)
      if (known.filter((n) => n === pick).length === 1) best = nums.indexOf(pick)
    }
    return { c, cs, differs, dir, best }
  }).filter((r) => !diffOnly || r.differs)
  return (
    <section className="sec" style={{ marginTop: 24 }}>
      <div className="sech">
        <h2>제품 비교<span className="note">{products.map((p) => p.product_code).join(' · ')}</span></h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: '#475467' }}>
            <input type="checkbox" checked={diffOnly} onChange={(e) => onDiff(e.target.checked)} style={{ accentColor: '#0569A0' }} />다른 값만 보기</label>
          <button type="button" className="bo" onClick={onBack}>목록으로</button>
        </div>
      </div>
      {products.length < 2 && <p style={{ color: '#667085' }}>목록에서 비교할 제품을 2개 이상 고르세요.</p>}
      {products.length >= 2 && (
        <>
          <div className="tw">
            <table className="tbl" style={{ marginTop: 12 }}>
              <thead><tr><th style={{ width: 180 }}>항목</th><th style={{ width: 110 }}>강점 방향</th>{products.map((p) => <th key={p.product_code} style={{ textAlign: 'right' }}>{p.product_code}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.c.key} className={r.differs ? 'diff' : undefined} style={{ cursor: 'default' }}>
                    <td style={{ fontWeight: 600 }}>{r.c.label}{r.c.unit && ` (${r.c.unit})`}</td>
                    <td className="en" style={{ margin: 0, paddingTop: 10 }}>{r.dir}</td>
                    {r.cs.map((x, i) => <td key={i} style={{ textAlign: 'right' }}><span className={x.cls}>{x.text}{x.sub && ` · ${x.sub}`}</span>
                      {i === r.best && <span className="best" title="이 항목에서 가장 유리한 값">▲</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tfoot"><span>노란 줄: 제품끼리 값이 다른 항목 · ▲ 강점 방향으로 가장 유리한 값</span><span>강점 방향은 항목 이름 사전 기준 (손실은 작을수록 강점)</span></div>
        </>
      )}
    </section>
  )
}
