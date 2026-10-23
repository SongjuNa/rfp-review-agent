// 일탈·질의 목록과 누락 점검(시안 3), 제안 포인트 채택
import { api, type OutputItem, type SubmissionCheck } from '../api'
import { ActionBar, Assumed, Badge, ErrorText, Evidence } from '../components/common'
import { POINT_KIND_NAMES, STATUS_NAMES } from '../components/labels'
import { useLoad } from '../components/useLoad'
import type { ViewProps } from './types'

export function CheckBox({ check }: { check: SubmissionCheck | null | undefined }) {
  if (!check) return null
  const missing = check.missing_judgment_ids.length
  return (
    <div className={`check ${missing ? 'bad' : 'ok'}`} role="status">
      <strong>제출 전 누락 점검</strong>
      <span>일탈 후보 {check.deviation_candidates}건</span>
      <span>목록에 들어간 것 {check.deviation_listed}건</span>
      <span>빠진 일탈 {missing}건{missing ? ' (AR-07)' : ''}</span>
      <span>남은 질의 {check.open_queries}건</span>
    </div>
  )
}

function Item({ item, number, runId, actorId, editable, onDone }: {
  item: OutputItem; number: Map<number, string>; runId: number; actorId: number | null; editable: boolean
  onDone: () => void
}) {
  return (
    <li className={`card ${item.status === 'REMOVED' ? 'removed' : ''}`}>
      <header>
        <strong>{number.get(item.item_id)}</strong>
        <Badge>{STATUS_NAMES[item.status]}</Badge>
        <Badge>{item.drafted_by === 'AI' ? 'AI 초안' : item.drafted_by === 'ENGINEER' ? '엔지니어 문장' : '코드 문장'}</Badge>
        {item.number_check === 'MISMATCH' && <Badge tone="bad">숫자 불일치: {item.number_detail}</Badge>}
        <Assumed show={item.is_assumed} />
      </header>
      <p>{item.text_draft}</p>
      <div className="sub">원문 위치 {item.locations.length}곳</div>
      <Evidence runId={runId} requirementId={item.sources[0].requirement_id} locations={item.locations} />
      {item.linked_items.length > 0 && (
        <div className="sub">연결된 항목: {item.linked_items.map((i) => number.get(i) ?? `#${i}`).join(', ')}</div>
      )}
      <ActionBar runId={runId} target="output_item" targetId={item.item_id} actorId={actorId}
        editable={editable} initialText={item.text_draft} onDone={onDone} />
    </li>
  )
}

export function Outputs({ runId, actorId, editable, onChanged }: ViewProps) {
  const items = useLoad(() => api.outputs(runId), [runId])
  const check = useLoad(() => api.submissionCheck(runId), [runId])
  const reload = () => { items.reload(); check.reload(); onChanged() }
  const lists = (['DEVIATION', 'QUERY'] as const).map((kind) => (items.data ?? []).filter((i) => i.list_kind === kind))
  const number = new Map<number, string>()
  lists.forEach((list, k) => list.forEach((i, n) => number.set(i.item_id, `${k === 0 ? '일탈' : '질의'} ${n + 1}`)))
  return (
    <section>
      <CheckBox check={check.data} />
      <ErrorText error={items.error} />
      {lists.map((list, k) => (
        <div key={k}>
          <h3>{list[0]?.list_name ?? (k === 0 ? '일탈 목록' : '질의 목록')} ({list.length})</h3>
          <ul className="cards">
            {list.map((i) => (
              <Item key={i.item_id} item={i} number={number} runId={runId} actorId={actorId}
                editable={editable} onDone={reload} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

export function Proposals({ runId, actorId, editable }: ViewProps) {
  const { data, error, reload } = useLoad(() => api.proposals(runId), [runId])
  const adopted = (data ?? []).filter((p) => p.status === 'ADOPTED' || p.status === 'EDITED').length
  return (
    <section>
      <p>채택한 제안 포인트만 전달됩니다 (AR-08). 지금 채택 {adopted}건.</p>
      <ErrorText error={error} />
      <ul className="cards">
        {data?.map((p) => (
          <li key={p.point_id} className={`card ${p.status === 'DISCARDED' ? 'removed' : ''}`}>
            <header>
              <Badge tone="ok">{POINT_KIND_NAMES[p.point_kind] ?? p.point_kind}</Badge>
              <Badge>{STATUS_NAMES[p.status]}</Badge>
              {p.number_check === 'MISMATCH' && <Badge tone="bad">숫자 불일치: {p.number_detail}</Badge>}
              <Assumed show={p.is_assumed} />
            </header>
            <p>{p.text_draft}</p>
            <p className="sub">근거: {p.basis}</p>
            <Evidence runId={runId} requirementId={p.requirement_id} locations={p.locations} />
            <ActionBar runId={runId} target="proposal_point" targetId={p.point_id} actorId={actorId}
              editable={editable} initialText={p.text_draft} onDone={reload} />
          </li>
        ))}
      </ul>
    </section>
  )
}
