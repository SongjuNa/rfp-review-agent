// 적합성 표(비교 제품·여유·바꿔 보기), 보증값, 손실 환산
import { useState } from 'react'
import { api, type EngineeringCheck, type Equipment, type Judgment, type Loss } from '../api'
import { ActionBar, Assumed, Badge, ErrorText, Evidence, More } from '../components/common'
import { CHECK_NAMES, CHECK_REASONS, MARGIN_NAMES, RESULT_NAMES, STATUS_NAMES } from '../components/labels'
import { useLoad, usePaged } from '../components/useLoad'
import type { ViewProps } from './types'

const RESULT_TONES: Record<string, string> = {
  COMPLY: 'ok', DEVIATION_CANDIDATE: 'bad', QUERY_CANDIDATE: 'warn', NEEDS_REVIEW: 'warn',
}

function margin(j: Judgment): string {
  if (j.margin_value === null) return '—'
  const v = Number(j.margin_value)
  return j.margin_kind === 'TIME_RATIO' ? `시간 ${v}배` : `${v} ${j.unit_raw ?? ''}`.trim()
}

function EquipmentPanel({ runId, editable, onSwitched }: {
  runId: number; editable: boolean; onSwitched: () => void
}) {
  const { data, error, reload } = useLoad(() => api.equipment(runId), [runId])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const groups = (data ?? []).filter((g) => g.family && (g.candidates.length > 0 || g.products?.length))
  const choose = (g: Equipment, code: string) => {
    setBusy(g.equipment_group)
    setMessage(null)
    api.chooseProduct(runId, g.equipment_group, code || null).then(() => {
      reload()
      onSwitched()
    }, (e: Error) => setMessage(e.message)).finally(() => setBusy(null))
  }
  return (
    <details open>
      <summary>설비 묶음별 비교 제품 ({groups.length})</summary>
      <ErrorText error={error ?? message} />
      <table>
        <thead><tr><th>설비 묶음</th><th>비교 제품</th><th>고른 주체</th><th>판정</th><th>일탈</th><th>제품 못 고름</th></tr></thead>
        <tbody>
          {groups.map((g) => {
            const current = g.chosen_product ?? g.products?.[0] ?? ''
            const options = Array.from(new Set([...g.candidates, ...(g.products ?? []), current].filter(Boolean)))
            return (
              <tr key={g.equipment_group}>
                <td>{g.label}</td>
                <td>
                  {editable ? (
                    <select aria-label={`${g.label} 비교 제품`} value={g.chosen_product ?? ''} disabled={busy !== null}
                      onChange={(e) => choose(g, e.target.value)}>
                      <option value="">자동 선택{g.chosen_product ? '' : ` (${current || '없음'})`}</option>
                      {options.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (current || '—')}
                  {busy === g.equipment_group && ' 다시 판정 중…'}
                </td>
                <td>{g.chosen_product ? '엔지니어' : '자동'}</td>
                <td>{g.judgments}</td><td>{g.deviations}</td><td>{g.ambiguous}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </details>
  )
}

export function Judgments({ runId, actorId, editable, onChanged }: ViewProps) {
  const [result, setResult] = useState('DEVIATION_CANDIDATE')
  const [version, setVersion] = useState(0)
  const { rows, error, more, pageSize, reload } = usePaged(
    (offset, limit) => api.judgments(runId, { result: result || undefined, offset, limit }), [runId, result, version])
  const changed = () => { reload(); onChanged() }
  return (
    <section>
      <EquipmentPanel runId={runId} editable={editable} onSwitched={() => { setVersion(version + 1); onChanged() }} />
      <h3>적합성 판정</h3>
      <label>판정 <select value={result} onChange={(e) => setResult(e.target.value)}>
        <option value="">전체</option>
        {Object.entries(RESULT_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select></label>
      <ErrorText error={error} />
      <table>
        <thead><tr><th>항목</th><th>요구값</th><th>비교 제품 · 제품값</th><th>판정</th><th>여유 · 방향</th><th>원문</th><th>확인</th></tr></thead>
        <tbody>
          {rows.map((j) => (
            <tr key={j.judgment_id}>
              <td>{j.item_name_raw}<div className="sub">{j.item_name ?? j.item_key ?? '항목 사전에 없음'}</div></td>
              <td>{j.req_value_raw} {j.unit_raw}{j.cond_time_s ? ` (${j.cond_time_s}초)` : ''}</td>
              <td>{j.product_code ?? '—'}{j.product_selected_by === 'ENGINEER' && <Badge>엔지니어 선택</Badge>}
                <div className="sub">{j.product_value_raw ?? ''}</div><Assumed show={j.is_assumed} /></td>
              <td><Badge tone={RESULT_TONES[j.result]}>{RESULT_NAMES[j.result] ?? j.result}</Badge>
                <div className="sub">{j.reason_text}</div></td>
              <td>{margin(j)}<div className="sub">{MARGIN_NAMES[j.margin_direction]}</div></td>
              <td><Evidence runId={runId} requirementId={j.requirement_id} locations={j.locations} /></td>
              <td><Badge>{STATUS_NAMES[j.review_status]}</Badge>
                <ActionBar runId={runId} target="judgment" targetId={j.judgment_id} actorId={actorId}
                  editable={editable} onDone={changed} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <More shown={rows.length} pageSize={pageSize} onMore={more} />
    </section>
  )
}

const SOURCE_NAMES: Record<string, string> = { PM: '제품표', FIXED: '회사 고정값', ENGINEER: '엔지니어' }
const EMPTY_REASONS: Record<string, string> = {
  NOT_MAPPED: '연결표에 없는 항목', NO_PRODUCT_VALUE: '제품표에 값 없음', PRODUCT_AMBIGUOUS: '비교 제품을 고를 수 없음',
  UNIT_DIFF: '단위가 다름', NO_FIXED_VALUE: '회사 고정값 없음',
}

export function WarrantyView({ runId, actorId, editable }: ViewProps) {
  const [status, setStatus] = useState('CANDIDATE')
  const { rows, error, more, pageSize, reload } = usePaged(
    (offset, limit) => api.warranty(runId, { status: status || undefined, offset, limit }), [runId, status])
  return (
    <section>
      <label>상태 <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">전체</option>
        {['CANDIDATE', 'EMPTY_REVIEW', 'CONFIRMED', 'REJECTED'].map((s) => <option key={s} value={s}>{STATUS_NAMES[s]}</option>)}
      </select></label>
      <ErrorText error={error} />
      <table>
        <thead><tr><th>항목</th><th>후보 값</th><th>출처</th><th>상태</th><th>원문</th><th>확인</th></tr></thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.candidate_id}>
              <td>{w.item_name_raw}<div className="sub">{w.item_name ?? w.item_key}</div></td>
              <td>{w.candidate_value ? `${w.candidate_value} ${w.candidate_unit ?? ''}` : '(비어 있음)'}<Assumed show={w.is_assumed} /></td>
              <td>{w.source_kind ? SOURCE_NAMES[w.source_kind] : '—'}
                <div className="sub">{w.product_code ?? ''} {w.pm_column ?? w.fixed_key ?? ''}</div></td>
              <td><Badge tone={w.status === 'EMPTY_REVIEW' ? 'warn' : ''}>{STATUS_NAMES[w.status]}</Badge>
                {w.reason_code && <div className="sub">{EMPTY_REASONS[w.reason_code] ?? w.reason_code}</div>}</td>
              <td><Evidence runId={runId} requirementId={w.requirement_id} locations={w.locations} /></td>
              <td><ActionBar runId={runId} target="warranty_candidate" targetId={w.candidate_id} actorId={actorId}
                editable={editable} onDone={reload} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <More shown={rows.length} pageSize={pageSize} onMore={more} />
    </section>
  )
}

function LossEdit({ runId, loss, onDone }: { runId: number; loss: Loss; onDone: () => void }) {
  const [values, setValues] = useState({
    loss_noload_kw: loss.loss_noload_kw?.toString() ?? '',
    loss_load_kw: loss.loss_load_kw?.toString() ?? '',
    loss_aux_kw: loss.loss_aux_kw?.toString() ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const save = () => {
    const body = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === '' ? null : Number(v)]))
    api.updateLoss(runId, loss.loss_calc_id, body).then(onDone, (e: Error) => setError(e.message))
  }
  const field = (key: keyof typeof values, label: string) => (
    <label>{label} <input type="number" min="0" step="any" value={values[key]} size={6}
      onChange={(e) => setValues({ ...values, [key]: e.target.value })} /> kW</label>
  )
  return (
    <form className="action-form" onSubmit={(e) => { e.preventDefault(); save() }}>
      {field('loss_noload_kw', '무부하')}{field('loss_load_kw', '부하')}{field('loss_aux_kw', '보조')}
      <button type="submit">다시 계산</button>
      <span className="sub">직접 넣은 손실값은 팀 가정으로 표시됩니다.</span>
      <ErrorText error={error} />
    </form>
  )
}

export function Losses({ runId, editable, onChanged }: ViewProps) {
  const { data, error, reload } = useLoad(() => api.losses(runId), [runId])
  return (
    <section>
      <ErrorText error={error} />
      {data?.length === 0 && <p>손실 환산 조항(단가 $/kW 행)이 없습니다.</p>}
      <ul className="cards">
        {data?.map((l) => (
          <li key={l.loss_calc_id} className="card">
            <header>
              <strong>{l.product_code ?? '비교 제품 없음'}</strong>
              <Badge tone={l.status === 'CALCULATED' ? 'ok' : 'warn'}>{l.status === 'CALCULATED' ? '계산됨' : '확인 필요'}</Badge>
              <Assumed show={l.is_assumed} />
            </header>
            <p className="total">{l.total_usd !== null ? `손실 환산 가산액 ${Number(l.total_usd).toLocaleString('en-US')} $` : '합계 없음'}</p>
            <p className="formula">{l.formula}</p>
            <p className="sub">단가 {Number(l.price_noload).toLocaleString('en-US')} / {Number(l.price_load).toLocaleString('en-US')} / {Number(l.price_aux).toLocaleString('en-US')} {l.price_unit}</p>
            <Evidence runId={runId} requirementId={l.requirement_id} locations={l.locations} />
            {editable && <LossEdit runId={runId} loss={l} onDone={() => { reload(); onChanged() }} />}
          </li>
        ))}
      </ul>
    </section>
  )
}

function checkLine(c: EngineeringCheck) {
  const values = `최대 순간 전류 ${Number(c.peak_ka)} kA · 단시간 전류 ${Number(c.ik_ka)} kA`
  if (c.result === 'NEEDS_REVIEW') return `${values} · ${CHECK_REASONS[c.reason_code ?? ''] ?? c.reason_code}`
  return `${values} · 주파수 ${Number(c.frequency_hz)} Hz → 계산한 값 ${Number(c.expected_ka)} kA (× ${Number(c.factor)})`
}

export function Checks({ runId }: ViewProps) {
  const { data, error } = useLoad(() => api.checks(runId), [runId])
  const order = { VIOLATION: 0, NEEDS_REVIEW: 1, PASS: 2 }
  const rows = [...(data ?? [])].sort((a, b) => order[a.result] - order[b.result])
  return (
    <section>
      <p>같은 표·같은 부위에서 최대 순간 전류 = 단시간 전류 × 2.5(50 Hz) 또는 × 2.6(60 Hz)인지 봅니다 (규칙 B1).
        위반은 질의 목록에 질의 후보로 들어갑니다.</p>
      <ErrorText error={error} />
      {data?.length === 0 && <p>같은 부위에 단시간 전류와 최대 순간 전류가 함께 있는 표가 없습니다.</p>}
      <ul className="cards">
        {rows.map((c) => (
          <li key={c.check_id} className="card">
            <header>
              <Badge tone={c.result === 'PASS' ? 'ok' : c.result === 'VIOLATION' ? 'bad' : 'warn'}>{CHECK_NAMES[c.result]}</Badge>
            </header>
            <p>{checkLine(c)}</p>
            <Evidence runId={runId} requirementId={c.requirement_id} locations={[...c.locations, ...c.ik_locations]} />
          </li>
        ))}
      </ul>
    </section>
  )
}
