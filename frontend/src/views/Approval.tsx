// 승인 화면과 수정 이력
import { useState } from 'react'
import { api, type User } from '../api'
import { Badge, ErrorText } from '../components/common'
import { STAGE_NAMES } from '../components/labels'
import { useLoad } from '../components/useLoad'
import { CheckBox } from './Outputs'

const ACTION_NAMES: Record<string, string> = {
  CONFIRM: '확정', EDIT: '수정', REJECT: '반려', ADOPT: '채택', DISCARD: '버림',
}
const TARGET_NAMES: Record<string, string> = {
  judgment: '판정', warranty_candidate: '보증값', output_item: '목록 항목', proposal_point: '제안 포인트',
  risk_flag: '위험 조건', loss_calc: '손실 환산', run_product_choice: '비교 제품', review_run: '검토 실행',
}

export function Approval({ runId, user, onChanged }: { runId: number; user: User | null; onChanged: () => void }) {
  const { data, error, reload } = useLoad(() => api.approval(runId), [runId])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const done = (p: Promise<unknown>) => {
    setBusy(true)
    setActionError(null)
    p.then(() => { reload(); onChanged() }, (e: Error) => setActionError(e.message)).finally(() => setBusy(false))
  }
  if (!data) return <ErrorText error={error} />
  const isApprover = user?.role === 'APPROVER'
  const criteria = data.stage === 'ENGINEER_REVIEW' ? data.preview ?? [] : data.reasons
  return (
    <section>
      <p>지금 단계: <Badge>{STAGE_NAMES[data.stage]}</Badge></p>
      <CheckBox check={data.submission_check} />
      <h3>{data.stage === 'ENGINEER_REVIEW' ? '확인을 마치면 걸릴 승인 기준' : '걸린 승인 기준'}</h3>
      {criteria.length === 0 ? <p>걸린 기준이 없습니다. 확인을 마치면 바로 승인됩니다.</p> : (
        <ul className="plain">
          {criteria.map((c) => (
            <li key={c.ar_code}><Badge tone="warn">{c.ar_code}</Badge> {c.description ?? ''} — {c.detail}</li>
          ))}
        </ul>
      )}
      <ErrorText error={actionError} />
      {data.stage === 'ENGINEER_REVIEW' && (
        <button type="button" disabled={busy || !user}
          onClick={() => done(api.finishReview(runId, user!.user_id))}>담당자 확인 마치기</button>
      )}
      {data.stage === 'APPROVAL' && (
        isApprover ? (
          <form className="action-form" onSubmit={(e) => e.preventDefault()}>
            <label className="wide">의견 <textarea value={comment} rows={3} onChange={(e) => setComment(e.target.value)} /></label>
            <button type="button" disabled={busy} onClick={() => done(api.decide(runId, 'APPROVED', comment, user!.user_id))}>승인</button>
            <button type="button" disabled={busy} onClick={() => done(api.decide(runId, 'REJECTED', comment, user!.user_id))}>반려</button>
          </form>
        ) : <p>승인자 역할 사용자로 바꾸면 승인·반려할 수 있습니다.</p>
      )}
      {data.approval?.decided_at && (
        <p>결정: <Badge tone={data.approval.decision === 'APPROVED' ? 'ok' : 'bad'}>
          {data.approval.decision === 'APPROVED' ? '승인' : '반려'}</Badge>{' '}
          {data.approval.approver ?? '자동'} · {new Date(data.approval.decided_at).toLocaleString('ko-KR')}
          {data.approval.comment && <> · “{data.approval.comment}”</>}</p>
      )}
      {data.stage === 'REJECTED' && (
        <button type="button" disabled={busy || !user} onClick={() => done(api.reopen(runId, user!.user_id))}>
          고쳐서 다시 확인하기</button>
      )}
    </section>
  )
}

function show(value: Record<string, unknown> | null, keys: string[]): string {
  if (!value) return ''
  return keys.filter((k) => value[k] !== undefined && value[k] !== null).map((k) => `${k}: ${String(value[k])}`).join(', ')
}

const SHOWN = ['result', 'status', 'candidate_value', 'text_draft', 'stage', 'product_code', 'total_usd', 'review_status']

export function History({ runId }: { runId: number }) {
  const { data, error } = useLoad(() => api.history(runId), [runId])
  return (
    <section>
      <ErrorText error={error} />
      {data?.length === 0 && <p>아직 이력이 없습니다.</p>}
      <table>
        <thead><tr><th>시각</th><th>작업자</th><th>대상</th><th>동작</th><th>이전 값</th><th>새 값</th><th>사유</th></tr></thead>
        <tbody>
          {data?.map((l) => (
            <tr key={l.log_id}>
              <td>{new Date(l.acted_at).toLocaleString('ko-KR')}</td>
              <td>{l.actor}</td>
              <td>{TARGET_NAMES[l.target_table] ?? l.target_table} #{l.target_id}</td>
              <td>{ACTION_NAMES[l.action] ?? l.action}</td>
              <td className="text">{show(l.before_value, SHOWN)}</td>
              <td className="text">{show(l.after_value, SHOWN)}</td>
              <td>{l.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
