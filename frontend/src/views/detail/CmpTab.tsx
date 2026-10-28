import { useState } from 'react'
import { EXAMPLE_CMP, type CmpKind, type CmpResult } from '../../examples/SCR-08-7'
import { ExampleBand } from './ExampleTab'

// SCR-08-7 지난 RFP 비교 탭 (목업 v4.57 Detail #cmp). docs/screens/SCR-08-7-지난RFP비교.md
// 같은 고객의 지난 검토와 요구를 짝짓는 API가 없어 목업 데이터를 옮긴 예시 화면이다. 저장하지 않는다.

const RESULTS: Record<CmpResult, [string, string]> = {
  D: ['일탈 후보', 'st c-red'], Q: ['질의 후보', 'st c-ora'], R: ['확인 필요', 'st c-ora'], W: ['작성 필요', 'st c-blue'],
  C: ['준수', 'st c-green'], '': ['없음', 'st c-grey'],
}
const KINDS: Record<CmpKind, [string, string]> = { chg: ['값 바뀜', 'ck chg'], new: ['새로 생김', 'ck new'], del: ['사라짐', 'ck del'] }
type Filter = 'all' | CmpKind

export function CmpTab() {
  const [id, setId] = useState(EXAMPLE_CMP[0].id)
  const [f, setF] = useState<Filter>('all')
  const cp = EXAMPLE_CMP.find((c) => c.id === id) ?? EXAMPLE_CMP[0]
  const n = (k: CmpKind) => cp.rows.filter((r) => r.kind === k).length
  const chips: [Filter, string, number][] = [['all', '달라진 요구', cp.rows.length], ['chg', '값 바뀜', n('chg')], ['new', '새로 생김', n('new')], ['del', '사라짐', n('del')]]
  const rows = cp.rows.filter((r) => f === 'all' || r.kind === f)

  return (
    <section className="sec" id="cmp">
      <ExampleBand />
      <div className="sech">
        <h2>지난 RFP 비교<span className="note">같은 고객의 지난 RFP와 요구사항을 짝지어 달라진 것만 보여 줍니다.</span></h2>
        <label className="cmpsel">비교 대상
          <select className="fi" value={id} onChange={(e) => { setId(e.target.value); setF('all') }}>
            {EXAMPLE_CMP.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select></label>
      </div>
      <div className="cmph">
        <div><span className="l">지난 입찰</span><b><a href="#/bids">{cp.bid}</a> · {cp.name}</b><span className="en" style={{ margin: 0 }}>제출 {cp.sub} · {cp.prod}</span></div>
        <span className="st c-green">{cp.res}</span>
      </div>
      <div className="cmpk">
        {chips.map(([k, label, count]) => (
          <button key={k} type="button" className={f === k ? 'on' : ''} aria-pressed={f === k} onClick={() => setF(k)}><span>{label}</span><b>{count}</b></button>
        ))}
      </div>
      <div className="tw"><table className="tbl">
        <thead><tr><th style={{ width: 90 }}>구분</th><th>항목</th><th>지난 RFP</th><th>이번 RFP</th><th>판정 변화</th><th>참고</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.kind}-${r.item}`} className={r.kind === 'del' ? 'cmpd' : undefined}>
              <td><span className={KINDS[r.kind][1]}>{KINDS[r.kind][0]}</span></td>
              <td style={{ fontWeight: 600 }}>{r.item}</td>
              <td style={{ whiteSpace: 'nowrap', color: '#667085' }}>{r.before}</td>
              <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{r.after}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {r.kind === 'chg' && <><span className={RESULTS[r.from][1]}>{RESULTS[r.from][0]}</span>
                  <span className="ms" aria-hidden="true" style={{ fontSize: 14, color: '#98A2B3', verticalAlign: 'middle' }}>arrow_forward</span></>}
                {r.kind === 'del' ? <span className="st c-grey">요구 없음</span> : <span className={RESULTS[r.to][1]}>{RESULTS[r.to][0]}</span>}
              </td>
              <td style={{ color: '#475467', fontSize: 'var(--fs-sm)' }}>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <p className="cmfoot">같은 요구 {cp.same}줄은 판정이 지난번과 같아 숨겼습니다.</p>
    </section>
  )
}
