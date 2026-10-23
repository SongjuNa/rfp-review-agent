import { useState, type ReactNode } from 'react'
import { api, type ActionBody, type Location, type Requirement } from '../api'
import { RESULT_NAMES, locationText } from './labels'

/** 팀 가정 값이 들어간 결과 표시 (CR-06). */
export function Assumed({ show }: { show: boolean }) {
  return show ? <span className="badge assumed">팀 가정</span> : null
}

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone ?? ''}`}>{children}</span>
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? <p role="alert" className="error">{error}</p> : null
}

/** 원문 위치 칩. 누르면 요구사항 원문을 불러와 보여 준다. */
export function Evidence({ runId, requirementId, locations }: {
  runId: number; requirementId: number; locations: Location[]
}) {
  const [open, setOpen] = useState(false)
  const [req, setReq] = useState<Requirement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const toggle = () => {
    setOpen(!open)
    if (!req) api.requirement(requirementId, runId).then(setReq, (e: Error) => setError(e.message))
  }
  return (
    <div className="evidence">
      <button type="button" className="link" onClick={toggle} aria-expanded={open}>
        {locations.slice(0, 3).map(locationText).join(' / ')}
        {locations.length > 3 && ` 외 ${locations.length - 3}곳`}
      </button>
      {open && (
        <div className="source">
          <ErrorText error={error} />
          {!req && !error && <p>불러오는 중…</p>}
          {req && (
            <>
              <blockquote>{req.text_raw}</blockquote>
              <ul className="plain">
                {req.locations.map((l, i) => <li key={i}>{locationText(l)}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

type Choice = { action: string; label: string; edit?: 'result' | 'value' | 'text'; needsReason?: boolean }

const CHOICES: Record<string, Choice[]> = {
  judgment: [
    { action: 'CONFIRM', label: '확정' },
    { action: 'EDIT', label: '수정', edit: 'result', needsReason: true },
    { action: 'REJECT', label: '반려', needsReason: true },
  ],
  warranty_candidate: [
    { action: 'CONFIRM', label: '확정' },
    { action: 'EDIT', label: '값 넣기', edit: 'value', needsReason: true },
    { action: 'REJECT', label: '반려', needsReason: true },
  ],
  output_item: [
    { action: 'CONFIRM', label: '확정' },
    { action: 'EDIT', label: '문장 수정', edit: 'text', needsReason: true },
    { action: 'REJECT', label: '목록에서 빼기', needsReason: true },
  ],
  proposal_point: [
    { action: 'ADOPT', label: '채택' },
    { action: 'EDIT', label: '고쳐서 채택', edit: 'text', needsReason: true },
    { action: 'DISCARD', label: '버림', needsReason: true },
  ],
  risk_flag: [
    { action: 'CONFIRM', label: '확정' },
    { action: 'REJECT', label: '문제 없음', needsReason: true },
  ],
}

/** 후보 하나에 확정·수정·반려(제안 포인트는 채택·버림·수정)를 사유와 함께 남긴다. */
export function ActionBar({ runId, target, targetId, actorId, editable, initialText, onDone }: {
  runId: number
  target: string
  targetId: number
  actorId: number | null
  editable: boolean
  initialText?: string
  onDone: () => void
}) {
  const [choice, setChoice] = useState<Choice | null>(null)
  const [reason, setReason] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [result, setResult] = useState('DEVIATION_CANDIDATE')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!editable) return null

  const send = (c: Choice) => {
    const body: ActionBody = { target, target_id: targetId, action: c.action, actor_id: actorId ?? undefined }
    if (c.needsReason) body.reason = reason
    if (c.edit === 'result') body.value = { result }
    if (c.edit === 'value') body.value = { value, unit: unit || null }
    if (c.edit === 'text') body.value = { text: value }
    setBusy(true)
    setError(null)
    api.act(runId, body).then(() => {
      setChoice(null)
      setReason('')
      onDone()
    }, (e: Error) => setError(e.message)).finally(() => setBusy(false))
  }

  const pick = (c: Choice) => {
    if (!c.needsReason && !c.edit) return send(c)
    setChoice(c)
    setValue(c.edit === 'text' ? initialText ?? '' : '')
  }

  return (
    <div className="actions">
      {CHOICES[target].map((c) => (
        <button key={c.action} type="button" disabled={busy} onClick={() => pick(c)}
          className={choice?.action === c.action ? 'active' : ''}>
          {c.label}
        </button>
      ))}
      {choice && (
        <form className="action-form" onSubmit={(e) => { e.preventDefault(); send(choice) }}>
          {choice.edit === 'result' && (
            <label>새 판정
              <select value={result} onChange={(e) => setResult(e.target.value)}>
                {Object.entries(RESULT_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          )}
          {choice.edit === 'value' && (
            <>
              <label>보증값 <input value={value} onChange={(e) => setValue(e.target.value)} required /></label>
              <label>단위 <input value={unit} onChange={(e) => setUnit(e.target.value)} size={6} /></label>
            </>
          )}
          {choice.edit === 'text' && (
            <label className="wide">문장
              <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3} required />
            </label>
          )}
          <label className="wide">사유 <input value={reason} onChange={(e) => setReason(e.target.value)} required /></label>
          <button type="submit" disabled={busy}>저장</button>
          <button type="button" onClick={() => setChoice(null)}>취소</button>
        </form>
      )}
      <ErrorText error={error} />
    </div>
  )
}

/** 페이지 나눔이 있는 목록의 "더 보기". */
export function More({ shown, pageSize, onMore }: { shown: number; pageSize: number; onMore: () => void }) {
  return shown > 0 && shown % pageSize === 0
    ? <button type="button" className="more" onClick={onMore}>더 보기</button>
    : null
}
