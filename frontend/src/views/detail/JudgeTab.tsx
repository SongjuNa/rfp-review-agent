import { useEffect, useState } from 'react'
import { api, type EngineeringCheck, type Judgment, type LogEntry, type OutputItem, type RunDocument, type RunSummary, type Warranty } from '../../api'
import { Pager } from '../../components/Pager'
import { bulkMessage } from '../../components/bulk'
import { PastDecisionRow } from '../../components/PastDecisionRow'
import { CHECK_NAMES, CHECK_RULE, CHECK_TONES, checkLine, checksByRequirement } from '../../components/checks'
import { stamp } from '../../components/format'
import { confirmedBy, compareText, itemName, locShort, markSplit, prodCell, reqText, suggested, itemFor } from '../../components/judgment'
import { RESULT_DOTS, RESULT_NAMES, RESULT_ORDER, RESULT_TONES, TYPE_NAMES } from '../../components/labels'
import { useLoad } from '../../components/useLoad'
import { currentPath, navigate, pathQuery } from '../../shell/router'
import { useSession } from '../../shell/useSession'
import { filterQuery, parseFilter } from '../../components/judgeFilter'
import { OutputEditor } from './OutputEditor'
import { RevisionBar } from './RevisionBar'

// SCR-08-1 판정 탭 (목업 v4.57 Detail #judge). docs/screens/SCR-08-1-판정.md
// 판정 칩·거르기·판정 순서 표, 줄을 누르면 판정 상세 화면(add-judgment-view), 오른쪽 패널은 돌아온 줄. 고른 줄·준수 모두를 한꺼번에 제안대로 확정 (add-bulk-confirm).
// 공학 검산(FR-12) 위반·확인 필요 줄 표시와 패널 "공학 검산" 칸 (update-check-display).


/** 검색어는 멈춘 뒤 0.3초 있다 보낸다 */
function useDebounced(value: string, ms = 300): string {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function JudgeTab({ run, tick, onChanged }: { run: RunSummary; tick: number; onChanged: () => void }) {
  const { user } = useSession()
  const id = run.run_id
  // 판정 상세 화면에서 돌아오면 주소의 거르기·쪽·보던 줄로 연다
  const [init] = useState(() => {
    const p = pathQuery(currentPath())
    const cur = Number(p.get('cur'))
    return { ...parseFilter(p), cur: Number.isInteger(cur) && cur > 0 ? cur : null }
  })
  const [f, setF] = useState(init.f)
  const [onlyUnc, setOnlyUnc] = useState(init.unc)
  const [onlyPast, setOnlyPast] = useState(init.past)   // 지난 확정과 다른 줄만 (add-review-memory)
  const [onlyRev, setOnlyRev] = useState(!!init.rev)     // 개정에서 바뀐 줄만 (add-revision-notice)
  const [text, setText] = useState(init.q)
  const q = useDebounced(text)
  const [type, setType] = useState(init.type)
  const [page, setPage] = useState(init.page)
  const [size, setSize] = useState(init.size)
  const [cur, setCur] = useState<number | null>(init.cur)
  const [edK, setEdK] = useState('')
  const [edWhy, setEdWhy] = useState('')
  const [edHint, setEdHint] = useState(false)
  const [wVal, setWVal] = useState('')
  const [wWhy, setWWhy] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sel, setSel] = useState<Record<number, string>>({})   // 고른 판정 id → 판정 (쪽을 넘겨도 남는다)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)
  const [panelError, setPanelError] = useState<string | null>(null)
  const filters = { result: f === 'all' ? undefined : f, unconfirmed: onlyUnc, q, type_code: type || undefined, past: onlyPast ? 'differs' as const : undefined, revised: onlyRev || undefined }
  const key = JSON.stringify(filters)
  const counts = useLoad(() => api.judgmentCounts(id), [id, tick])
  const rows = useLoad(() => api.judgmentPage(id, { ...filters, order: 'priority', offset: (page - 1) * size, limit: size }),
    [id, key, page, size, tick])
  const warranty = useLoad(() => api.warranty(id, { limit: 500 }), [id, tick])
  const items = useLoad(() => api.outputs(id), [id, tick])
  const log = useLoad(() => api.history(id), [id, tick])
  const docs = useLoad(() => api.documents(id), [id])
  const checks = useLoad(() => api.checks(id), [id, tick])
  const checkOf = checksByRequirement(checks.data ?? [])
  const violations = (checks.data ?? []).filter((x) => x.result === 'VIOLATION').length
  const unsure = (checks.data ?? []).filter((x) => x.result === 'NEEDS_REVIEW').length
  const canEdit = run.stage === 'ENGINEER_REVIEW' && user?.role === 'ENGINEER'

  const list = rows.data?.items ?? []
  const total = rows.data?.total ?? 0
  const curRow = list.find((r) => r.judgment_id === cur) ?? (cur === null ? list[0] : undefined)
  const wOf = (j: Judgment) => warranty.data?.find((w) => w.judgment_id === j.judgment_id)
  const c = counts.data
  const n = (r: string) => c?.by_result[r] ?? 0
  const chips: [string, string, number][] = [['all', '전체', c?.total ?? 0], ...RESULT_ORDER.map((r): [string, string, number] => [r, RESULT_NAMES[r], n(r)])]

  const reset = (fn: () => void) => { fn(); setPage(1); setCur(null) }
  const clearFilter = () => reset(() => { setF('all'); setOnlyUnc(false); setOnlyPast(false); setOnlyRev(false); setText(''); setType('') })
  // 줄을 누르면 판정 상세 화면. 지금 거르기·쪽을 주소로 넘겨 이전·다음과 목록으로 돌아오기에 쓴다
  const open = (j: Judgment) => navigate(`/reviews/${id}/judgments/${j.judgment_id}${filterQuery({ f, unc: onlyUnc, q: text, type, past: onlyPast, rev: onlyRev, page, size })}`)
  const done = () => { onChanged() }
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }
  const act = (body: Parameters<typeof api.act>[1]) => api.act(id, { ...body, actor_id: user!.user_id }).then(done)
  const go = (d: number) => {
    const i = list.findIndex((r) => r.judgment_id === (curRow?.judgment_id ?? -1)) + d
    if (list[i]) { setCur(list[i].judgment_id); setEdK(''); setEdWhy(''); setEdHint(false); setPanelError(null) }
  }
  const apply = () => {
    if (!curRow || !edK) return
    if (!edWhy.trim()) { setEdHint(true); return }
    setPanelError(null)
    setApplying(true)
    const was = curRow.result
    act({ target: 'judgment', target_id: curRow.judgment_id, action: 'EDIT', value: { result: edK }, reason: edWhy.trim() })
      .then(() => { say(`판정을 바꿨습니다: ${RESULT_NAMES[was]} → ${RESULT_NAMES[edK]}`); setEdK(''); setEdWhy('') },
        (e: Error) => setPanelError(e.message))
      .finally(() => setApplying(false))
  }
  const selIds = Object.keys(sel).map(Number)
  const selSum = RESULT_ORDER.map((r) => [r, Object.values(sel).filter((v) => v === r).length] as const)
    .filter(([, k]) => k).map(([r, k]) => `${RESULT_NAMES[r]} ${k}`).join(' · ')
  const allSel = list.length > 0 && list.every((j) => sel[j.judgment_id])
  const toggle = (j: Judgment) => setSel((s) => {
    const n = { ...s }
    if (n[j.judgment_id]) delete n[j.judgment_id]; else n[j.judgment_id] = j.result
    return n
  })
  const toggleAll = () => setSel((s) => {
    const n = { ...s }
    list.forEach((j) => { if (allSel) delete n[j.judgment_id]; else n[j.judgment_id] = j.result })
    return n
  })
  const confirmIds = async (ids: number[]) => {
    if (!ids.length) return
    setBusy(true)
    setError(null)
    try {
      const out = await api.bulkConfirm(id, ids, user!.user_id)
      setSel({})
      // 검산 위반·숫자 불일치·값이 빈 줄은 서버가 빼고 확정한다 (update-bulk-confirm-guard)
      say(bulkMessage(out))
      done()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const saveW = (candidateId: number) => {
    setError(null)
    act({ target: 'warranty_candidate', target_id: candidateId, action: 'EDIT', value: { value: wVal.trim() }, reason: wWhy.trim() })
      .then(() => { setWVal(''); setWWhy('') }, (e: Error) => setError(e.message))
  }

  return (
    <section className="sec" id="judge">
      <div className="sech"><h2>판정</h2></div>
      {run.revision && <RevisionBar runId={id} revision={run.revision} only={onlyRev} onToggle={() => reset(() => setOnlyRev(!onlyRev))} />}
      <div className="fbar">
        {chips.map(([k, label, cnt]) => (
          <button key={k} type="button" className={'chip' + (f === k ? ' on' : '')} aria-pressed={f === k}
            onClick={() => reset(() => setF(k))}>
            {k !== 'all' && <i style={{ background: RESULT_DOTS[k] }} />}{label}
            {(k === 'DEVIATION_CANDIDATE' || k === 'QUERY_CANDIDATE') && cnt > 0 && <> <span className="n">{cnt}</span></>}
          </button>
        ))}
        {c && (c.past_differs > 0 || onlyPast) && (
          <button type="button" className={'chip' + (onlyPast ? ' on' : '')} aria-pressed={onlyPast} title="다른 검토에서 사람이 같은 요구·같은 제품을 다르게 확정한 줄"
            onClick={() => reset(() => setOnlyPast(!onlyPast))}><i style={{ background: 'var(--c-orange)' }} />지난 확정과 다름 <span className="n">{c.past_differs}</span></button>
        )}
        <span style={{ flex: '1 1 0' }} />
        <label className="sr" htmlFor="jq">판정 검색</label>
        <label className="unc"><input type="checkbox" checked={onlyUnc} onChange={() => reset(() => setOnlyUnc(!onlyUnc))} />확정 안 한 줄만</label>
        <input className="fi" id="jq" value={text} onChange={(e) => { setText(e.target.value); setPage(1); setCur(null) }}
          placeholder="항목명, 영문, 원문 문장" style={{ width: 200 }} />
        <label className="sr" htmlFor="jtype">유형</label>
        <select className="fi" id="jtype" value={type} onChange={(e) => reset(() => setType(e.target.value))}>
          <option value="">모든 유형</option>
          {Object.entries(TYPE_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </div>
      {(violations > 0 || unsure > 0) && (
        <p className="chkn"><span className="ms" aria-hidden="true">calculate</span>
          <span>공학 검산 {[violations ? `위반 ${violations}건` : '', unsure ? `확인 필요 ${unsure}건` : ''].filter(Boolean).join(' · ')}
            <span className="en" style={{ display: 'inline', marginLeft: 6 }}>{CHECK_RULE}. 표에 표시한 줄을 눌러 계산식을 보세요.</span></span></p>
      )}
      <div className={'work' + (curRow ? ' open' : '')}>
        <div style={{ minWidth: 0 }}>
          {canEdit && selIds.length > 0 && (
            <div className="bulk"><b>{selIds.length}줄 선택</b><span className="en" style={{ margin: 0 }}>{selSum}</span><span style={{ flex: '1 1 0' }} />
              <button type="button" className="bo" onClick={() => setSel({})}>선택 해제</button>
              <button type="button" className="bp" disabled={busy} onClick={() => confirmIds(selIds)}><span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>done_all</span>제안대로 확정</button></div>
          )}
          <div className="tw">
            <table className="tbl">
              <thead><tr><th style={{ width: 34 }}><input type="checkbox" className="jck" checked={allSel} onChange={toggleAll} disabled={!canEdit} aria-label="보이는 줄 모두 선택" /></th><th style={{ width: 92 }}>판정</th><th>항목</th><th>요구값</th><th>제품값 · 보증값</th><th>원문 위치</th></tr></thead>
              <tbody>
                {list.map((j) => {
                  const p = prodCell(j, wOf(j))
                  return (
                    <tr key={j.judgment_id} className={curRow?.judgment_id === j.judgment_id ? 'cur' : ''} onClick={() => open(j)}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" className="jck" checked={!!sel[j.judgment_id]} onChange={() => toggle(j)}
                        disabled={!canEdit} aria-label={`${itemName(j)} 선택`} /></td>
                      <td><span className={`st ${RESULT_TONES[j.result]}`}>{RESULT_NAMES[j.result]}</span>
                        {j.revised && <div className="en c-blue" title={`문서 추가(개정 ${run.revision?.no ?? ''})로 ${j.revised === 'CHANGED' ? '판정 값이 바뀐' : '새로 생긴'} 줄`}>{j.revised === 'CHANGED' ? '바뀜(개정)' : '추가(개정)'}</div>}
                        {j.review_status === 'EDITED' && <div className="en" title="사람이 바꾼 판정">바꿈</div>}
                        {(j.review_status === 'CONFIRMED' || j.review_status === 'EDITED') && <div className="cfm"><span className="ms" aria-hidden="true">check</span>확정</div>}
                        {j.past_decision && <div className={'en past' + (j.past_decision.same ? '' : ' c-ora')} title={`${j.past_decision.review_no}에서 사람이 ${RESULT_NAMES[j.past_decision.result]}(으)로 확정`}>
                          {j.past_decision.same ? `지난 확정 ${RESULT_NAMES[j.past_decision.result]}` : '지난 확정과 다름'}
                          {j.past_decision.match === 'MEANING' && j.past_decision.score != null && ` · 뜻 비슷 ${j.past_decision.score.toFixed(2)}`}</div>}
                      </td>
                      <td style={{ minWidth: 180 }}><span style={{ fontWeight: 600 }}>{itemName(j)}</span>
                        {checkOf.get(j.requirement_id) && checkOf.get(j.requirement_id)!.result !== 'PASS' && (
                          <span className={`tag chk ${checkOf.get(j.requirement_id)!.result === 'VIOLATION' ? 'bad' : 'warn'}`}>
                            {checkOf.get(j.requirement_id)!.result === 'VIOLATION' ? '검산 위반' : '검산 확인 필요'}</span>)}
                        {j.item_name && j.item_name_raw && <div className="en">{j.item_name_raw}</div>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{reqText(j)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><span className={p.cls}>{p.val}</span><div className="en">{p.sub}</div></td>
                      <td className="loc">{locShort(j, docs.data ?? [])}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {rows.data && list.length === 0 && (
            <p style={{ margin: 0, padding: '16px 10px', color: 'var(--c-muted)' }}>조건에 맞는 줄이 없습니다.{' '}
              <button type="button" className="lnk" onClick={clearFilter}>필터 지우기</button></p>
          )}
          {total > 0 && <Pager total={total} page={page} size={size} shown={list.length} onPage={setPage} onSize={(s) => { setSize(s); setPage(1) }} />}
          <div className="tfoot"><span>{list.length}줄 표시 · 전체 판정 {c?.total ?? 0}줄</span><span>판정 순서: 일탈 후보 → 질의 후보 → 확인 필요 → 보증값 작성 → 준수</span></div>
          {error && <p className="aphint" role="alert">{error}</p>}
        </div>

        {curRow && (
          <Panel runId={id} j={curRow} w={wOf(curRow)} check={checkOf.get(curRow.requirement_id)} items={items.data ?? []} log={log.data ?? []} docs={docs.data ?? []} canEdit={canEdit}
            edK={edK} edWhy={edWhy} edHint={edHint} wVal={wVal} wWhy={wWhy}
            setEdK={setEdK} setEdWhy={(v) => { setEdWhy(v); setEdHint(false) }} setWVal={setWVal} setWWhy={setWWhy}
            onPrev={() => go(-1)} onNext={() => go(1)} onClose={() => setCur(-1)} onApply={apply} applying={applying} error={panelError} onSaveW={saveW} onDone={done} onSaved={say} />
        )}
      </div>

      {toast && <div className="toast" role="status"><span className="ms" aria-hidden="true">check_circle</span>{toast}</div>}
    </section>
  )
}

type PanelProps = {
  runId: number; j: Judgment; w?: Warranty; check?: EngineeringCheck; items: OutputItem[]; log: LogEntry[]; docs: RunDocument[]; canEdit: boolean
  edK: string; edWhy: string; edHint: boolean; wVal: string; wWhy: string
  setEdK: (v: string) => void; setEdWhy: (v: string) => void; setWVal: (v: string) => void; setWWhy: (v: string) => void
  onPrev: () => void; onNext: () => void; onClose: () => void; onApply: () => void; applying: boolean; error: string | null
  onSaveW: (candidateId: number) => void
  onDone: () => void; onSaved: (message: string) => void
}

/** 오른쪽 패널: 원문, 판정 근거, 판정 출처, 보증값, 목록 문장, 판정 바꾸기 */
function Panel({ runId, j, w, check, items, log, docs, canEdit, edK, edWhy, edHint, wVal, wWhy, setEdK, setEdWhy, setWVal, setWWhy,
  onPrev, onNext, onClose, onApply, applying, error, onSaveW, onDone, onSaved }: PanelProps) {
  const req = useLoad(() => api.requirement(j.requirement_id, runId), [j.requirement_id, runId])
  const [a, m, b] = markSplit(req.data?.text_raw ?? '', j.req_value_raw)
  const sug = suggested(j, log)
  const conf = j.review_status === 'CONFIRMED' || j.review_status === 'EDITED' ? confirmedBy(j, log) : null
  const draft = itemFor(items, j)
  const doc = docs.find((d) => d.file_no === j.locations[0]?.file_no)
  return (
    <aside className="panel" aria-label="원문과 판정">
      <div className="ph">
        <div style={{ flex: '1 1 auto', minWidth: 0 }}><div className="en" style={{ margin: '0 0 2px' }}>{locShort(j, docs)}</div><h3>{itemName(j)}</h3></div>
        <button type="button" className="ib" aria-label="이전 줄" onClick={onPrev}><span className="ms" aria-hidden="true">keyboard_arrow_up</span></button>
        <button type="button" className="ib" aria-label="다음 줄" onClick={onNext}><span className="ms" aria-hidden="true">keyboard_arrow_down</span></button>
        <button type="button" className="ib" aria-label="원문 창 닫기" onClick={onClose}><span className="ms" aria-hidden="true">close</span></button>
      </div>
      <div className="pb">
        <div>
          <div className="lbl">원문 ({doc?.file_name ?? `파일 ${j.locations[0]?.file_no ?? ''}`})</div>
          <div className="src">
            {j.locations[0]?.table_name ? (
              <table><tbody>
                <tr className="h"><td>No.</td><td>Description</td><td>Unit</td><td>Employer's Req.</td></tr>
                <tr><td>{j.locations[0].item_no}</td><td>{j.item_name_raw}</td><td>{j.unit_raw}</td><td><mark>{j.req_value_raw}</mark></td></tr>
              </tbody></table>
            ) : <span>{a}{m && <mark>{m}</mark>}{b}</span>}
          </div>
        </div>
        <div>
          <div className="lbl">판정 근거</div>
          <div><span className={`st ${RESULT_TONES[j.result]}`}>{RESULT_NAMES[j.result]}</span> <span style={{ marginLeft: 6 }}>{compareText(j, w)}</span></div>
          <div className="en" style={{ marginTop: 2 }}>{j.reason_text}</div>
        </div>
        {check && (
          <div>
            <div className="lbl">공학 검산</div>
            <div><span className={CHECK_TONES[check.result]}>{CHECK_NAMES[check.result]}</span> <span style={{ marginLeft: 6 }}>{checkLine(check)}</span></div>
            <div className="en" style={{ marginTop: 2 }}>{check.rule_code} · {CHECK_RULE}</div>
          </div>
        )}
        <div>
          <div className="lbl">판정 출처</div>
          <table className="pv"><tbody>
            <tr><th>시스템 제안</th><td><span className={`st ${RESULT_TONES[sug]}`}>{RESULT_NAMES[sug]}</span><span className="pvs">코드 규칙</span></td></tr>
            <tr><th>담당자 확정</th><td>{conf
              ? <><span className={`st ${RESULT_TONES[j.result]}`}>{RESULT_NAMES[j.result]}</span><span className="pvs">{conf.actor} · {stamp(conf.acted_at)}</span></>
              : <span className="pend" title="확정하지 않으면 시스템 제안 그대로 상신됩니다">아직 확정 안 함</span>}</td></tr>
            <PastDecisionRow j={j} />
          </tbody></table>
        </div>
        {j.result === 'WARRANTY_TO_FILL' && w && (
          <div>
            <label className="lbl" htmlFor="wval" style={{ display: 'block' }}>보증값 (comply는 쓸 수 없음)</label>
            {w.candidate_value
              ? <div style={{ fontWeight: 600 }}>{prodCell(j, w).val} <span className="en" style={{ display: 'inline', marginLeft: 6 }}>출처 {prodCell(j, w).sub}</span></div>
              : canEdit && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input className="fi" id="wval" value={wVal} onChange={(e) => setWVal(e.target.value)} placeholder="근거 있는 값만 입력" style={{ flex: '1 1 120px' }} />
                  <input className="fi" aria-label="보증값 근거" value={wWhy} onChange={(e) => setWWhy(e.target.value)} placeholder="근거 (이력에 남음)" style={{ flex: '1 1 120px' }} />
                  <button type="button" className="bo" disabled={!wVal.trim() || !wWhy.trim()} onClick={() => onSaveW(w.candidate_id)}>넣기</button>
                </div>
              )}
          </div>
        )}
        {draft && <OutputEditor key={`${draft.item_id}-${draft.text_draft}-${draft.status}`} runId={runId} item={draft} id="draft" canEdit={canEdit} onDone={onDone} onSaved={onSaved} />}
        <div style={{ borderTop: '1px solid #DCE3EC', paddingTop: 14 }}>
          <div className="lbl">판정 바꾸기</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label className="sr" htmlFor="newk">새 판정</label>
            <select className="fi" id="newk" value={edK || j.result} disabled={!canEdit} onChange={(e) => setEdK(e.target.value)}>
              {RESULT_ORDER.map((r) => <option key={r} value={r}>{RESULT_NAMES[r]}</option>)}
            </select>
            <label className="sr" htmlFor="why">바꾸는 사유</label>
            <input className="fi" id="why" value={edWhy} disabled={!canEdit} onChange={(e) => setEdWhy(e.target.value)}
              placeholder="사유 (이력에 남음)" style={{ flex: '1 1 140px' }} />
            <button type="button" className="bp" onClick={onApply} disabled={!canEdit || applying || !edK || edK === j.result || !edWhy.trim()}>
              {applying ? '적용 중…' : '적용'}</button>
          </div>
          {edHint && <div className="en" style={{ marginTop: 4 }}>판정을 바꾸려면 사유를 적어 주세요.</div>}
          {applying && <div className="en" style={{ marginTop: 4 }}>판정을 바꾸고 일탈·질의 목록을 다시 만드는 중입니다…</div>}
          {error && <p className="aphint" role="alert">{error}</p>}
          {!canEdit && <div className="en" style={{ marginTop: 4 }}>담당자 확인 단계에서 엔지니어만 바꿀 수 있습니다.</div>}
        </div>
      </div>
    </aside>
  )
}
