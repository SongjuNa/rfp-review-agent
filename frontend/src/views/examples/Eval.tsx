import { useEffect, useState } from 'react'
import { Pager } from '../../components/Pager'
import { EXAMPLE_GROUND_TRUTH, EXAMPLE_METRICS, EXAMPLE_SCORE_LOG, PENDING_NOTE, type Metric } from '../../examples/SCR-19'
import { usePageCss } from '../../shell/pageCss'
import { ExampleBand } from '../detail/ExampleTab'

// SCR-19 정답지·채점 (목업 v4.57 Eval). docs/screens/SCR-19-정답지채점.md
// 정답지·채점기는 남은 작업이라 예시 데이터로만 보여 준다. "지금 채점하기"도 화면 안에서만 점수가 바뀐다.

type Tab = 'k' | 'g' | 'l'
const TABS: [Tab, string][] = [['k', '채점 결과'], ['g', '정답지'], ['l', '개선 기록']]
const unit = (m: Metric, v: number) => v + (m[3] === '%' ? ' %' : ' ' + m[3])

export function Eval() {
  usePageCss('Eval')
  const [tab, setTab] = useState<Tab>('k')
  const [running, setRunning] = useState(false)
  const [ran, setRan] = useState(false)
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(EXAMPLE_GROUND_TRUTH.map((g) => [g[0], g[5]])))
  const [toast, setToast] = useState('')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const gts = EXAMPLE_GROUND_TRUTH.filter((g) => on[g[0]])
  // 목업처럼 채점을 다시 돌리면 바뀐 지표가 0.4 오른 모습을 보여 준다 (예시)
  const bump = ran ? 0.4 : 0
  const val = (m: Metric) => (m[7] > 0 ? Math.min(100, +(m[5] + (m[4] !== m[5] ? bump : 0)).toFixed(1)) : m[5])
  const pass = (m: Metric) => {
    const v = val(m)
    const goal = parseFloat(m[6].replace(/[^0-9.]/g, ''))
    return m[6].startsWith('≥') ? v >= goal : m[6].startsWith('≤') ? v <= goal : v === goal
  }
  const rows = EXAMPLE_METRICS.map((m) => {
    const v = val(m)
    const d = +(v - m[4]).toFixed(1)
    const better = m[7] > 0 ? d > 0 : d < 0
    return { m, v, d, cls: d === 0 ? 'same' : better ? 'up' : 'down' }
  })
  const run = () => {
    setRunning(true)
    setTimeout(() => {
      setRunning(false)
      setRan(true)
      setToast(`채점을 마쳤습니다. 정답지 ${gts.length}건 기준으로 12개 지표를 다시 쟀습니다. (예시 화면이라 실제로 채점하지 않습니다)`)
    }, 1600)
  }

  return (
    <main className="main">
      <ExampleBand />
      <div className="ttl"><div><h1>정답지·채점</h1><p className="tb-sub">사람이 확정한 판정을 정답지로 삼아, 사전·규칙·제품표를 고칠 때마다 점수를 다시 잽니다.</p></div>
        <button type="button" className="bp" onClick={run} disabled={running}><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>play_arrow</span>{running ? '채점 중…' : '지금 채점하기'}</button></div>
      <div className="sh-note"><span className="ms" aria-hidden="true">info</span><span>지난 검토의 사람 판정은 새 검토에서 <b>힌트로만</b> 보여 주고 판정을 자동으로 바꾸지 않습니다. 정답지와의 일치율이 충분히 높아지면 사람이 확인할 줄을 줄여 나가는 것이 목표이며, 사람 검토를 건너뛰는 자동 확정은 하지 않습니다.</span></div>
      <div className="sh-sum">
        <span>정답지<b>{gts.reduce((a, g) => a + g[4], 0).toLocaleString('en-US')}줄</b></span><span>검토<b>{gts.length}건</b></span>
        <span>마지막 채점<b>{ran ? '10-29 00:52' : '10-28 18:40'}</b></span>
        <span>목표 달성<b className="c-green">{EXAMPLE_METRICS.filter(pass).length} / 12</b></span>
        <span>지난번보다 좋아짐<b className="c-blue">{rows.filter((r) => r.cls === 'up').length}</b></span>
      </div>
      <div className="pgtabs" role="tablist" style={{ marginTop: 24 }}>
        {TABS.map(([k, label]) => <button key={k} type="button" role="tab" className={tab === k ? 'on' : ''} aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === 'k' && (
        <div className="sh-box">
          <div className="ev-tr sh-th"><span>지표</span><span>무엇을 재나</span><span>지난 (10-21)</span><span>이번 ({ran ? '10-29' : '10-28'})</span><span>변화</span><span>목표</span></div>
          {rows.slice((page - 1) * size, page * size).map(({ m, v, d, cls }) => (
            <div key={m[0]} className="ev-tr ev-row"><span><b className="mono">{m[0]}</b> {m[1]}</span><span className="sh-mut">{m[2]}</span>
              <span className="mono sh-mut">{unit(m, m[4])}</span><span className="mono" style={{ fontWeight: 600 }}>{unit(m, v)}</span>
              <span className={cls}>{d === 0 ? '변화 없음' : (d > 0 ? '▲ ' : '▼ ') + Math.abs(d)}</span>
              <span><span className={pass(m) ? 'st c-green' : 'st c-ora'}>{m[6]}</span></span></div>
          ))}
        </div>
      )}
      {tab === 'k' && <Pager total={rows.length} page={page} size={size} shown={rows.slice((page - 1) * size, page * size).length} onPage={setPage} onSize={(n) => { setSize(n); setPage(1) }} />}
      {tab === 'g' && (
        <>
          <div className="sh-box">
            <div className="gt-tr sh-th"><span>넣기</span><span>검토</span><span>확정한 사람</span><span>확정일</span><span>판정 줄</span></div>
            {EXAMPLE_GROUND_TRUTH.map(([id, name, who, date, n]) => (
              <label key={id} className="gt-tr ev-row"><input type="checkbox" checked={on[id]} onChange={() => setOn({ ...on, [id]: !on[id] })} />
                <span><b>{name}</b><span className="mono sh-mut" style={{ display: 'block' }}>{id}</span></span><span className="sh-mut">{who}</span>
                <span className="mono sh-mut">{date}</span><span className="mono">{n}줄</span></label>
            ))}
          </div>
          <div className="sh-note"><span className="ms" aria-hidden="true">schedule</span><span>{PENDING_NOTE}</span></div>
        </>
      )}
      {tab === 'l' && (
        <div className="sh-box">
          <div className="lg-tr sh-th"><span>날짜</span><span>고친 곳</span><span>무엇을 고쳤나</span><span>점수 변화</span><span>한 사람</span></div>
          {EXAMPLE_SCORE_LOG.map(([date, kind, what, delta, who]) => (
            <div key={date + what} className="lg-tr ev-row"><span className="mono sh-mut">{date}</span><span><span className="st c-grey">{kind}</span></span>
              <span>{what}</span><span className="mono c-blue" style={{ fontWeight: 600 }}>{delta}</span><span className="sh-mut">{who}</span></div>
          ))}
        </div>
      )}
      {toast && <div className="stt" role="status"><span className="ms" aria-hidden="true">check_circle</span>{toast}</div>}
    </main>
  )
}
