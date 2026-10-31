import { Fragment, useState } from 'react'
import { api, type LogEntry, type Risk, type RunDocument, type RunSummary } from '../../api'
import { stamp } from '../../components/format'
import { locName, locShort, markSplit } from '../../components/judgment'
import { RISK_NAMES, STATUS_NAMES } from '../../components/labels'
import { useLoad } from '../../components/useLoad'
import { useSession } from '../../shell/useSession'
import { ExampleBand } from './ExampleTab'
import { OutputEditor } from './OutputEditor'

// SCR-08-3 위험 조건 탭 (목업 v4.57 Detail #risk). docs/screens/SCR-08-3-위험조건.md
// 위험 조건 표는 실제 데이터, "사람이 찾은 특이 요구"는 제안 API가 없어 예시 영역 (SCR-08-3_공유.md).

const KINDS = ['BLANKET', 'VALUE_MISMATCH', 'OPEN_SCOPE'] as const
const TONES: Record<string, string> = { CANDIDATE: 'c-ora', CONFIRMED: 'c-red', CLOSED_OK: 'c-grey' }
// 언어 모델 설명이 없을 때 쓰는 종류별 한 줄
const KIND_NOTES: Record<string, string> = {
  BLANKET: '책임 범위를 정하지 않고 넓히는 표현',
  VALUE_MISMATCH: '같은 항목의 값이 문서 안에서 다름',
  OPEN_SCOPE: '대상 범위가 열려 있는 표현',
}

function title(r: Risk): string {
  if (r.risk_kind === 'VALUE_MISMATCH') {
    const values = r.members.map((m) => m.value_raw).filter(Boolean).join(' / ')
    return `${r.item_name ?? RISK_NAMES[r.risk_kind]}${values ? ` ${values}` : ''}`
  }
  return r.expression ? `“${r.expression}”` : RISK_NAMES[r.risk_kind] ?? r.risk_kind
}

function where(r: Risk, docs: RunDocument[]): string {
  return locShort({ locations: r.members.flatMap((m) => m.locations) }, docs)
}

/** 마지막 확정·닫기 기록 (누가, 언제, 사유) */
function decided(r: Risk, log: LogEntry[]): LogEntry | null {
  const mine = log.filter((l) => l.target_table === 'risk_flag' && l.target_id === r.risk_id
    && (l.action === 'CONFIRM' || l.action === 'REJECT'))
  return mine.length ? mine[mine.length - 1] : null
}

export function RiskTab({ run, tick, onChanged }: { run: RunSummary; tick: number; onChanged: () => void }) {
  const { user } = useSession()
  const id = run.run_id
  const risks = useLoad(() => api.risks(id), [id, tick])
  const log = useLoad(() => api.history(id), [id, tick])
  const docs = useLoad(() => api.documents(id), [id])
  const items = useLoad(() => api.outputs(id), [id, tick])
  const [open, setOpen] = useState<number | null>(null)
  const [closing, setClosing] = useState<number | null>(null)
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }
  const canEdit = run.stage === 'ENGINEER_REVIEW' && user?.role === 'ENGINEER'
  const lock = run.stage !== 'ENGINEER_REVIEW' ? '담당자 확인 단계에서만 고칠 수 있습니다' : !canEdit ? '엔지니어만 고칠 수 있습니다' : undefined

  const all = risks.data ?? []
  const live = all.filter((r) => r.status !== 'CLOSED_OK')
  const rows = [...live, ...all.filter((r) => r.status === 'CLOSED_OK')]
  const note = KINDS.map((k) => `${RISK_NAMES[k]} ${live.filter((r) => r.risk_kind === k).length}`).join(' · ')

  const act = (r: Risk, action: 'CONFIRM' | 'REJECT') => {
    setBusy(true)
    setError(null)
    api.act(id, { target: 'risk_flag', target_id: r.risk_id, action, reason: action === 'REJECT' ? why.trim() : undefined, actor_id: user!.user_id })
      .then(() => { setClosing(null); setWhy(''); onChanged() })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false))
  }

  return (
    <section className="sec" id="risk">
      <div className="sech"><h2>위험 조건<span className="note">{note}</span></h2></div>
      <Found />
      {risks.error && <p role="alert">{risks.error} <button type="button" className="lnk" onClick={risks.reload}>다시 불러오기</button></p>}
      {risks.data?.length === 0 && <p style={{ color: '#667085' }}>위험 조건 후보가 없습니다.</p>}
      {rows.length > 0 && (
        <table className="mini"><tbody>
          {rows.map((r) => {
            const d = decided(r, log.data ?? [])
            const closed = r.status === 'CLOSED_OK'
            return (
              <Fragment key={r.risk_id}>
                <tr className={closed ? 'dis' : undefined}>
                  <td style={{ width: 92 }}><span className={`st ${TONES[r.status] ?? 'c-grey'}`}>{STATUS_NAMES[r.status] ?? r.status}</span></td>
                  <td>
                    <b style={{ fontWeight: 600 }}>{title(r)}</b>
                    <div className="en">{RISK_NAMES[r.risk_kind]} · {closed && d?.reason ? d.reason : r.explanation_ai ?? KIND_NOTES[r.risk_kind]}</div>
                  </td>
                  <td className="loc">
                    <button type="button" className="lnk" aria-expanded={open === r.risk_id} style={{ fontSize: 'inherit', fontWeight: 400, color: 'inherit', textAlign: 'left' }}
                      onClick={() => setOpen(open === r.risk_id ? null : r.risk_id)}>{where(r, docs.data ?? [])}</button>
                  </td>
                  <td className="loc" style={{ width: 1 }}>
                    {r.status === 'CANDIDATE'
                      ? closing === r.risk_id
                        ? <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input className="fi" aria-label="문제 없음 사유" placeholder="닫는 사유" value={why} autoFocus
                              onChange={(e) => setWhy(e.target.value)} style={{ width: 200, height: 32 }} />
                            <button type="button" className="bp" disabled={busy || !why.trim()} onClick={() => act(r, 'REJECT')}>닫기</button>
                            <button type="button" className="bo" onClick={() => { setClosing(null); setWhy('') }}>취소</button>
                          </span>
                        : <span style={{ display: 'flex', gap: 6 }} title={lock}>
                            <button type="button" className="bo" disabled={!canEdit || busy} onClick={() => act(r, 'CONFIRM')}>위험으로 확정</button>
                            <button type="button" className="bo" disabled={!canEdit || busy} onClick={() => { setClosing(r.risk_id); setWhy('') }}>문제 없음</button>
                          </span>
                      : d ? `${d.actor} · ${stamp(d.acted_at)}` : '—'}
                  </td>
                </tr>
                {open === r.risk_id && (
                  <tr><td /><td colSpan={3}>
                    {r.members.map((m) => {
                      const [a, k, b] = markSplit(m.text_raw, r.risk_kind === 'VALUE_MISMATCH' ? m.value_raw : r.expression)
                      return (
                        <div key={m.requirement_id} className="pl hitl" style={{ margin: '4px 0' }}>
                          <span className="lno">{m.locations[0]?.line_start ?? ''}</span>
                          <span className="ltx">{a}{k && <mark>{k}</mark>}{b}<div className="en">{m.locations.map((l) => locName(l, docs.data ?? [])).join(' · ')}</div></span>
                        </div>
                      )
                    })}
                    {(items.data ?? []).filter((i) => i.sources.some((s) => s.risk_id === r.risk_id)).map((i) => (
                      <div key={i.item_id} style={{ marginTop: 10, maxWidth: 640 }}>
                        <OutputEditor key={`${i.item_id}-${i.text_draft}-${i.status}`} runId={id} item={i} id={`risk-draft-${i.item_id}`} canEdit={canEdit} onDone={onChanged} onSaved={say} />
                      </div>
                    ))}
                  </td></tr>
                )}
              </Fragment>
            )
          })}
        </tbody></table>
      )}
      {error && <p className="aphint" role="alert">{error}</p>}
      {toast && <div className="toast" role="status"><span className="ms" aria-hidden="true">check_circle</span>{toast}</div>}
    </section>
  )
}

// 사람이 찾은 특이 요구: 위험 표현 사전 제안 API가 없어 예시 데이터. 눌러도 저장하지 않는다 (_공통규칙.md 6장)
function Found() {
  const [sent, setSent] = useState(false)
  const [text, setText] = useState('')
  const [more, setMore] = useState<string[]>([])
  const pending = <span className="st c-blue">제안함 · 규칙 담당 확인 대기</span>
  return (
    <div className="rk">
      <ExampleBand />
      <div className="rk-h"><b>사람이 찾은 특이 요구</b><span>시스템이 위험 조건으로 잡지 못한 문장을 찾았다면 위험 표현 사전에 추가를 제안합니다. 규칙 담당이 확인한 뒤 다음 검토부터 잡힙니다.</span></div>
      <div className="rk-r"><div><b>"each bay shall be provided with continuous monitoring sensors"</b><span>예시 문서.docx · 4.3 Monitoring · 표 6 · 71행 · 베이마다 상시 감시 센서 요구 (표준 사양에 없음)</span></div>
        {sent ? pending : <button type="button" className="bo" onClick={() => setSent(true)}>위험 표현 사전에 추가 제안</button>}</div>
      {more.map((t, i) => <div key={i} className="rk-r"><div><b>"{t}"</b><span>직접 추가 · 예시</span></div>{pending}</div>)}
      <div className="rk-f">
        <input className="fi" value={text} onChange={(e) => setText(e.target.value)} placeholder="놓친 표현을 원문 그대로 붙여 넣기 (예: shall be capable of ...)" aria-label="놓친 위험 표현" />
        <button type="button" className="bo" disabled={!text.trim()} onClick={() => { setMore([...more, text.trim()]); setText('') }}>제안 추가</button>
      </div>
    </div>
  )
}
