import { useEffect, useState } from 'react'
import { api, type AssistantAnswer, type AssistantEvidence, type RunDocument } from '../../api'
import { locName } from '../../components/judgment'
import { RESULT_NAMES, TYPE_NAMES } from '../../components/labels'
import './assistant.css'

// 검토 도우미 창 (add-review-assistant, FR-17). docs/screens/SCR-08-검토상세.md, SCR-08_공유.md
// AI는 읽기 도구(요구사항 찾기·판정 찾기·한 줄 보기)만 쓴다. 이 창에는 고치기 단추가 없다.

const EXAMPLES = ['시험 입회 조건이 있는 조항', '일탈 후보 판정을 먼저 보여 줘', 'ambient temperature']
const TOOL_NAMES: Record<string, string> = {
  search_requirements: '요구사항 찾기', find_judgments: '판정 찾기', get_requirement: '한 줄 보기',
}

function stepText(s: AssistantAnswer['steps'][number]): string {
  const what = [s.words && `“${s.words}”`, s.type_code && (TYPE_NAMES[s.type_code] ?? s.type_code),
    s.result && (RESULT_NAMES[s.result] ?? s.result), s.ref].filter(Boolean).join(' · ')
  return `${TOOL_NAMES[s.tool] ?? s.tool}${what ? ` ${what}` : ''} → ${s.found}줄`
}

function Evidence({ e, docs }: { e: AssistantEvidence; docs: RunDocument[] }) {
  return (
    <li id={`as-${e.ref}`} className="as-ev" data-testid="assistant-evidence">
      <div className="as-evh"><span className="mono as-ref">{e.ref}</span>
        {e.kind === 'JUDGMENT'
          ? <span>판정 <b>{RESULT_NAMES[e.result ?? ''] ?? e.result}</b>{e.item_name ? ` · ${e.item_name}` : ''}{e.req_value_raw ? ` · 요구값 ${e.req_value_raw}` : ''}{e.product_value_raw ? ` · 제품값 ${e.product_value_raw}` : ''}</span>
          : <span>요구사항{e.type_code ? ` · ${TYPE_NAMES[e.type_code] ?? e.type_code}` : ''}</span>}
      </div>
      <p className="as-txt">{e.text_raw}</p>
      <div className="as-loc">{e.locations.map((l) => locName(l, docs)).join(' / ')}</div>
    </li>
  )
}

export function AssistantPanel({ runId, docs, onClose }: { runId: number; docs: RunDocument[]; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [asked, setAsked] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const send = (text: string) => {
    const question = text.trim()
    if (question.length < 2 || busy) return
    setBusy(true)
    setError(null)
    setAsked(question)
    api.ask(runId, question).then(setAnswer, (e: Error) => { setAnswer(null); setError(e.message) }).finally(() => setBusy(false))
  }
  const jump = (ref: string) => document.getElementById(`as-${ref}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  return (
    <aside className="as" role="dialog" aria-modal="false" aria-labelledby="asT">
      <div className="as-h">
        <div><h2 id="asT">검토 도우미</h2><span>읽기만 합니다 · 답마다 원문 위치</span></div>
        <button type="button" className="ib" onClick={onClose} aria-label="닫기" title="닫기 (Esc)"><span className="ms" aria-hidden="true">close</span></button>
      </div>
      <form className="as-f" onSubmit={(e) => { e.preventDefault(); send(q) }}>
        <textarea className="fi" rows={2} value={q} maxLength={500} onChange={(e) => setQ(e.target.value)} aria-label="검토 도우미 질문"
          placeholder="예: 시험 성적서를 요구하는 조항만 보여 줘" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(q) } }} />
        <button type="submit" className="bp" disabled={busy || q.trim().length < 2}>{busy ? '찾는 중…' : '묻기'}</button>
      </form>
      <div className="as-ex">{EXAMPLES.map((x) => <button key={x} type="button" className="chip" disabled={busy} onClick={() => { setQ(x); send(x) }}>{x}</button>)}</div>
      <div className="as-b" aria-live="polite">
        {error && <p className="aphint" role="alert">{error}</p>}
        {!answer && !error && !busy && <p className="as-empty">이 검토의 요구사항과 판정에서 찾아 답합니다. 값을 바꾸거나 판정하지 않습니다.</p>}
        {busy && <p className="as-empty">“{asked}” 찾는 중…</p>}
        {answer && !busy && (
          <>
            <div className="as-q">“{asked}”</div>
            <div className={`as-mode ${answer.mode === 'AI' ? '' : 'search'}`}>
              {answer.mode === 'AI' ? 'AI가 쓴 문장 · 근거와 대조함' : 'AI 없이 글자로 찾음'}
              {answer.dropped > 0 && <span> · 근거와 맞지 않아 뺀 문장 {answer.dropped}개</span>}
            </div>
            {answer.sentences.length > 0 && (
              <ol className="as-ans">{answer.sentences.map((s, i) => (
                <li key={i}>{s.text} {s.evidence_ids.map((r) => <button key={r} type="button" className="as-ref lnk mono" onClick={() => jump(r)}>{r}</button>)}</li>
              ))}</ol>
            )}
            {answer.note && <p className="as-note" role="status">{answer.note}</p>}
            {answer.evidence.length > 0 && <><h3>근거 {answer.evidence.length}줄</h3>
              <ul className="as-evs">{answer.evidence.map((e) => <Evidence key={e.ref} e={e} docs={docs} />)}</ul></>}
            {answer.steps.length > 0 && <><h3>찾은 경로</h3>
              <ol className="as-steps">{answer.steps.map((s, i) => <li key={i}>{stepText(s)}</li>)}</ol></>}
          </>
        )}
      </div>
    </aside>
  )
}
