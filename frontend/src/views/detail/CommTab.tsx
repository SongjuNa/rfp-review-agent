import { useEffect, useState } from 'react'
import { ExampleBand } from './ExampleTab'

// SCR-08-6 상업 조건 탭 (목업 v4.57 Detail #comm). docs/screens/SCR-08-6-상업조건.md
// 상업 조항을 찾는 API가 없어(차별화 아이디어 C1, 팀 결정 대기) 목업 데이터를 옮긴 예시 화면이다.
// 고르고 전달해도 저장하지 않는다 (_공통규칙.md 6장). 사람 이름 대신 담당 역할을 쓴다.

type To = 'cost' | 'sales'
type St = 'none' | 'sent' | 'seen' | 'reply'
const TO_NAMES: Record<To, string> = { cost: '견적 담당', sales: '영업 담당' }
const ST: Record<St, [string, string]> = { none: ['미전달', 'st c-grey'], sent: ['전달', 'st c-blue'], seen: ['확인', 'st c-blue'], reply: ['회신', 'st c-green'] }
const ST_TIME: Partial<Record<St, string>> = { sent: '10-24 11:20', seen: '10-24 11:20', reply: '10-24 16:40' }

type Clause = { id: string; cat: string; sum: string; orig: string; loc: string; risk: string; to: To; st: St; reply?: [string, string] }
const CLAUSES: Clause[] = [
  { id: 'M1', cat: '지급 조건', sum: '선급금 10 % · 선적 후 80 % · 준공 후 10 %', orig: 'Payment: 10 % advance against Advance Payment Guarantee, 80 % on shipment, 10 % on Taking-Over.', loc: 'GCC 14.2 · 2210행', risk: '', to: 'cost', st: 'reply', reply: ['10-24 16:40', '당사 표준 지급 조건과 같습니다. 별도 조치 없이 진행합니다.'] },
  { id: 'M2', cat: '지체상금', sum: '주당 계약금액의 0.5 % · 상한 10 %', orig: 'Delay damages: 0.5 % of the Contract Price per week, not exceeding 10 % in aggregate.', loc: 'GCC 26.1 · 2388행', risk: '', to: 'sales', st: 'sent' },
  { id: 'M3', cat: '책임 한도', sum: '책임 한도를 두지 않음', orig: "The Contractor's total liability under the Contract shall not be limited.", loc: 'GCC 31.4 · 2471행', risk: '책임 한도 없음', to: 'sales', st: 'none' },
  { id: 'M4', cat: '하자 보증', sum: '준공 후 24개월 또는 선적 후 30개월 중 먼저 끝나는 날까지', orig: 'Defects Notification Period: 24 months from Taking-Over or 30 months from shipment, whichever is earlier.', loc: 'GCC 29.1 · 2432행', risk: '', to: 'cost', st: 'none' },
  { id: 'M5', cat: '이행 보증서', sum: '계약금액의 10 % · 하자 보증 기간 끝까지 유효', orig: 'Performance Security: 10 % of the Contract Price, valid until expiry of the Defects Notification Period.', loc: 'GCC 12.1 · 2150행', risk: '', to: 'sales', st: 'seen' },
  { id: 'M6', cat: '가격 유효 기간', sum: '입찰 마감 후 180일', orig: 'Bids shall remain valid for 180 days after the bid submission deadline.', loc: 'ITB 18.1 · 412행', risk: '', to: 'cost', st: 'none' },
  { id: 'M7', cat: '인도 조건', sum: 'CIP 현장 · 통관은 발주처', orig: 'Delivery: CIP Site (Incoterms 2020). Customs clearance by the Employer.', loc: 'GCC 9.2 · 2077행', risk: '', to: 'cost', st: 'none' },
  { id: 'M8', cat: '통화·환율', sum: 'USD 60 % 이상 · 현지 통화 허용 · 환율 조정 없음', orig: 'Bid prices shall be in USD (minimum 60 %) and local currency. No adjustment for exchange rate fluctuation.', loc: 'ITB 15.2 · 365행', risk: '환율 조정 없음', to: 'sales', st: 'none' },
  { id: 'M9', cat: '예비품 가격', sum: '5년분 예비품 가격을 Price Schedule No.5에 따로 기재', orig: 'Prices for spare parts for five years of operation shall be quoted separately in Price Schedule No. 5.', loc: 'ITB 14.6 · 351행', risk: '', to: 'cost', st: 'none' },
]
type Impact = { id: string; cat: string; sum: string; link: string; to: To; st: St }
const IMPACTS: Impact[] = [
  { id: 'T1', cat: '옵션 가격', sum: '230 kV 주모선 4,000 A 옵션 (표준 3,150 A) 가격 필요', link: '판정 · 230 kV GIS 주모선 정격 전류', to: 'cost', st: 'none' },
  { id: 'T2', cat: '납기 영향', sum: '옵션 적용 시 납기 +8주 → 지체상금 조항(GCC 26.1)과 부딪힘', link: '판정 · 230 kV GIS 주모선 정격 전류', to: 'sales', st: 'none' },
  { id: 'T3', cat: '손실 환산 가산액', sum: '팀 가정 손실값 기준 평가 가격에 $1,240,400 더해짐', link: '손실 환산', to: 'cost', st: 'sent' },
]

function now(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function CommTab() {
  const [sel, setSel] = useState<Record<string, boolean>>({})
  const [to, setTo] = useState<Record<string, To>>({})
  const [sent, setSent] = useState<Record<string, string>>({})      // 이 화면에서 전달한 항목 → 시각
  const [toast, setToast] = useState('')
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const all = [...CLAUSES, ...IMPACTS]
  const stOf = (r: Clause | Impact): St => (sent[r.id] ? 'sent' : r.st)
  const toOf = (r: Clause | Impact): To => to[r.id] ?? r.to
  const left = all.filter((r) => stOf(r) === 'none').length
  const picked = all.filter((r) => stOf(r) === 'none' && sel[r.id])
  const send = () => {
    const t = now()
    const counts: Record<To, number> = { cost: 0, sales: 0 }
    picked.forEach((r) => { counts[toOf(r)] += 1 })
    setSent({ ...sent, ...Object.fromEntries(picked.map((r) => [r.id, t])) })
    setSel({})
    setToast(`상업 조건을 전달했습니다: ${(Object.keys(counts) as To[]).filter((k) => counts[k]).map((k) => `${TO_NAMES[k]} ${counts[k]}건`).join(', ')}`)
  }

  const cells = (r: Clause | Impact) => {
    const st = stOf(r)
    const lock = st !== 'none'
    return {
      row: !lock && sel[r.id] ? 'sel' : undefined,
      check: <td style={{ width: 28 }}><input type="checkbox" checked={!lock && !!sel[r.id]} disabled={lock} aria-label={`${r.cat} 선택`}
        onChange={() => setSel({ ...sel, [r.id]: !sel[r.id] })} /></td>,
      to: <td style={{ width: 150 }}><select className="fi cmo" aria-label="담당" value={toOf(r)} disabled={lock}
        onChange={(e) => setTo({ ...to, [r.id]: e.target.value as To })}>
        <option value="cost">견적 담당</option><option value="sales">영업 담당</option></select></td>,
      st: <td style={{ width: 96, textAlign: 'right' }}><span className={ST[st][1]}>{ST[st][0]}</span><div className="en">{sent[r.id] ?? ST_TIME[st] ?? ''}</div></td>,
    }
  }

  return (
    <section className="sec" id="comm">
      <ExampleBand />
      <div className="sech">
        <h2>상업 조건<span className="note">RFP 조항 {CLAUSES.length} · 기술 판단 영향 {IMPACTS.length}{left ? ` · 미전달 ${left}` : ''}</span></h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="cmsel">{picked.length ? `${picked.length}건 선택` : ''}</span>
          <button type="button" className="bp" disabled={!picked.length} onClick={send}>
            <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>send</span>골라서 전달</button>
        </div>
      </div>
      <p className="rdi">RFP의 상업 조항과 기술 판단에서 생긴 상업 영향입니다. 받아들일지는 영업·견적 담당이 정하고, 여기서는 담당자에게 전달하고 회신을 확인합니다.</p>
      <h3 className="cmh">RFP의 상업 조항</h3>
      <table className="mini cmt"><tbody>
        {CLAUSES.map((r) => {
          const c = cells(r)
          return (
            <tr key={r.id} className={c.row}>
              {c.check}
              <td style={{ width: 104 }}><b style={{ fontWeight: 600 }}>{r.cat}</b>{r.risk && <div><span className="st c-ora" style={{ marginTop: 4 }}>{r.risk}</span></div>}</td>
              <td><div>{r.sum}</div><div className="en" style={{ marginTop: 2 }}>{r.orig}</div>
                {r.reply && stOf(r) === 'reply' && <div className="cmrp"><span className="ms" aria-hidden="true">reply</span>
                  <span><b>{TO_NAMES[r.to]}</b> · {r.reply[0]}<br />{r.reply[1]}</span></div>}</td>
              <td className="loc" style={{ width: 150 }}>{r.loc}</td>
              {c.to}{c.st}
            </tr>
          )
        })}
      </tbody></table>
      <h3 className="cmh">기술 판단에서 생긴 상업 영향</h3>
      <table className="mini cmt"><tbody>
        {IMPACTS.map((r) => {
          const c = cells(r)
          return (
            <tr key={r.id} className={c.row}>
              {c.check}
              <td style={{ width: 104 }}><b style={{ fontWeight: 600 }}>{r.cat}</b></td>
              <td><div>{r.sum}</div><span className="lnk" title="예시 데이터라 이동하지 않습니다" style={{ fontSize: 'var(--fs-xs)', marginTop: 2, display: 'inline-block' }}>{r.link} →</span></td>
              <td className="loc" style={{ width: 150 }} />
              {c.to}{c.st}
            </tr>
          )
        })}
      </tbody></table>
      <p className="cmfoot">전달한 항목은 <a href="#/todo">협조 요청 현황</a>에서 회신을 확인할 수 있습니다.</p>
      {toast && <div className="ltoast" role="status"><span className="ms" aria-hidden="true">check_circle</span>{toast}</div>}
    </section>
  )
}
