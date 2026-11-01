import { TypeFix } from '../../components/TypeFix'
import { useEffect, useState } from 'react'
import { api, type EngineeringCheck, type Judgment, type LogEntry, type OutputItem, type RunDocument, type Warranty } from '../../api'
import { CHECK_NAMES, checkLine } from '../../components/checks'
import { stamp } from '../../components/format'
import { compareText, confirmedBy, itemName, markSplit, prodCell, reqText, suggested, itemFor } from '../../components/judgment'
import { RESULT_NAMES, RESULT_TONES, locationText } from '../../components/labels'
import { useLoad } from '../../components/useLoad'
import { PastDecisionRow } from '../../components/PastDecisionRow'
import { OutputEditor } from './OutputEditor'

// SCR-08-1 판정 상세 창 (목업 v4.57 Detail의 판정 줄을 누르면 뜨는 창 .mdw).
// 번역, 비슷한 요구의 과거 결과, 지난 검토 수정 기록은 API가 없어 없다 (SCR-08-1_공유.md).
// 목록 문장은 여기서 고치고 확정한다 (SCR-08-11).

const LANGS: Record<string, string> = { en: 'EN · 영어', ko: 'KO · 한국어', image: '이미지' }

export function JudgmentDialog({ runId, j, w, check, items, log, docs, pos, total, canEdit, onPrev, onNext, onClose, onEdit, onConfirm, onDone, onSaved }: {
  runId: number; j: Judgment; w?: Warranty; check?: EngineeringCheck; items: OutputItem[]; log: LogEntry[]; docs: RunDocument[]
  pos: number; total: number; canEdit: boolean
  onPrev: (() => void) | null; onNext: (() => void) | null; onClose: () => void; onEdit: () => void; onConfirm: () => Promise<void>
  onDone: () => void; onSaved: (message: string) => void
}) {
  const req = useLoad(() => api.requirement(j.requirement_id, runId), [j.requirement_id, runId])
  const [occ, setOcc] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return   // 문장·사유 칸에서는 줄 이동 안 함
      if (e.key === 'ArrowUp' && onPrev) { e.preventDefault(); onPrev() }
      if (e.key === 'ArrowDown' && onNext) { e.preventDefault(); onNext() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  const loc = j.locations[Math.min(occ, j.locations.length - 1)]
  const doc = docs.find((d) => d.file_no === loc?.file_no)
  const [a, m, b] = markSplit(req.data?.text_raw ?? '', j.req_value_raw)
  const p = prodCell(j, w)
  const sug = suggested(j, log)
  const conf = j.review_status === 'CONFIRMED' || j.review_status === 'EDITED' ? confirmedBy(j, log) : null
  const draft = itemFor(items, j)
  const basis: [string, string][] = [
    ['적용 규칙', j.reason_text ?? '—'], ['비교', compareText(j, w)],
    ['제품값 출처', j.result === 'WARRANTY_TO_FILL' ? p.sub : j.product_code ? `${j.product_code} · 제품표` : '—'],
  ]
  if (j.type_name) basis.push(['유형', j.type_name])
  if (check) basis.push(['공학 검산', `${CHECK_NAMES[check.result]} · ${checkLine(check)}`])   // update-check-display
  const confirm = () => {
    setBusy(true)
    setError(null)
    onConfirm().catch((e: Error) => setError(e.message)).finally(() => setBusy(false))
  }

  return (
    <div className="mdo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mdw" role="dialog" aria-modal="true" aria-labelledby="mdTitle">
        <div className="mdh">
          <span className={`st ${RESULT_TONES[j.result]}`}>{RESULT_NAMES[j.result]}</span>
          <h2 id="mdTitle">{itemName(j)}{j.item_name_raw && j.item_name && <span className="mden">{j.item_name_raw}</span>}</h2>
          <span className="mdpos">판정 {pos} / {total}</span>
          <button type="button" className="ib" onClick={onPrev ?? undefined} disabled={!onPrev} aria-label="이전 판정" title="이전 판정"><span className="ms" aria-hidden="true">keyboard_arrow_up</span></button>
          <button type="button" className="ib" onClick={onNext ?? undefined} disabled={!onNext} aria-label="다음 판정" title="다음 판정"><span className="ms" aria-hidden="true">keyboard_arrow_down</span></button>
          <button type="button" className="ib" onClick={onClose} aria-label="닫기" title="닫기 (Esc)"><span className="ms" aria-hidden="true">close</span></button>
        </div>
        <div className="mdb">
          <section className="mdl" aria-label="RFP 원문">
            <div className="mdl-top">
              <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)', color: 'var(--c-muted)' }}>description</span>
              <b className="ell">{doc?.file_name ?? req.data?.file_name ?? `파일 ${loc?.file_no ?? ''}`}</b>
              {doc && <span className="lang">{LANGS[doc.language] ?? doc.language}</span>}
            </div>
            <div className="occ" role="tablist" aria-label="같은 요구가 나온 위치">
              {j.locations.map((l, i) => (
                <button key={i} type="button" role="tab" aria-selected={i === occ} className={i === occ ? 'oc on' : 'oc'} onClick={() => setOcc(i)}>
                  {l.table_name ? `${l.table_name}${l.item_no ? ` No. ${l.item_no}` : ''}` : `${l.line_start ?? ''}행`}</button>
              ))}
            </div>
            <div className="paper">
              {loc && <div className="sect">{locationText(loc)}{loc.section_title ? ` · ${loc.section_title}` : ''}</div>}
              {req.data && <div className="pl hitl"><span className="lno">{loc?.line_start ?? ''}</span><span className="ltx">{a}{m && <mark>{m}</mark>}{b}</span></div>}
              {req.error && <p role="alert">{req.error}</p>}
            </div>
          </section>

          <section className="mdr" aria-label="판정 근거">
            <div className="lbl">비교</div>
            <div className="cmp">
              <div><span className="cl">요구값 (원문)</span><b>{reqText(j)}</b><span className="cs">{loc ? locationText(loc) : ''}</span></div>
              <div className="op" aria-hidden="true">?</div>
              <div><span className="cl">{j.result === 'WARRANTY_TO_FILL' ? '보증값' : '제품값'}</span><b className={j.result === 'DEVIATION_CANDIDATE' ? 'c-red' : p.cls}>{p.val}</b><span className="cs">{p.sub}</span></div>
            </div>

            <div className="lbl">판정 근거</div>
            <dl className="basis">
              {basis.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            <TypeFix runId={runId} requirementId={j.requirement_id} current={j.type_code ?? null} />

            <div className="lbl">판정 출처</div>
            <table className="pv"><tbody>
              <tr><th>시스템 제안</th><td><span className={`st ${RESULT_TONES[sug]}`}>{RESULT_NAMES[sug]}</span><span className="pvs">코드 규칙</span></td></tr>
              <tr><th>담당자 확정</th><td>{conf
                ? <><span className={`st ${RESULT_TONES[j.result]}`}>{RESULT_NAMES[j.result]}</span><span className="pvs">{conf.actor} · {stamp(conf.acted_at)}</span></>
                : <span className="pend">아직 확정 안 함</span>}</td></tr>
              <PastDecisionRow j={j} />
            </tbody></table>

            {draft && <div style={{ marginTop: 18 }}><OutputEditor key={`${draft.item_id}-${draft.text_draft}-${draft.status}`} runId={runId} item={draft} id="mdDraft" canEdit={canEdit} onDone={onDone} onSaved={onSaved} /></div>}
            {error && <p className="aphint" role="alert">{error}</p>}
          </section>
        </div>
        <div className="mdf">
          <span className="mdf-n">↑↓ 이전·다음 판정 · Esc 닫기</span>
          <button type="button" className="bo" onClick={onEdit} disabled={!canEdit}>판정 바꾸기</button>
          <button type="button" className="bp" onClick={confirm} disabled={!canEdit || busy || !!conf}>{conf ? '확정함' : '제안대로 확정'}</button>
        </div>
      </div>
    </div>
  )
}
