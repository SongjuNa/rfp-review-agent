import { api, type RunSummary } from '../../api'
import { stamp } from '../../components/format'
import { historyText, reasonLabel } from '../../components/history'
import { useLoad } from '../../components/useLoad'

// SCR-08-9 이력 탭 (목업 v4.57 Detail #log). docs/screens/SCR-08-9-이력.md
// 사람이 바꾼 기록(review_log)을 새것부터, 맨 아래에 시스템이 판정을 만든 줄.

const SKIP_REASONS = new Set(['검토 정보 고치기', '손실값 고치기', '비교 제품 바꿔 보기', '상신 취소', '반려 뒤 다시 확인'])

export function LogTab({ run, tick }: { run: RunSummary; tick: number }) {
  const log = useLoad(() => api.history(run.run_id), [run.run_id, tick])
  const rows = [...(log.data ?? [])].reverse()
  return (
    <section className="sec" id="log">
      <div className="sech"><h2>이력</h2></div>
      {log.error && <p role="alert">{log.error} <button type="button" className="lnk" onClick={log.reload}>다시 불러오기</button></p>}
      <table className="mini"><tbody>
        {rows.map((l) => (
          <tr key={l.log_id}>
            <td style={{ width: 92, whiteSpace: 'nowrap', color: '#667085' }}>{stamp(l.acted_at)}</td>
            <td style={{ width: 96, whiteSpace: 'nowrap' }}>{l.actor}</td>
            <td>{historyText(l)}{l.reason && !SKIP_REASONS.has(l.reason) && <div className="en">{reasonLabel(l)}: {l.reason}</div>}</td>
          </tr>
        ))}
        {run.finished_at && (
          <tr>
            <td style={{ width: 92, whiteSpace: 'nowrap', color: '#667085' }}>{stamp(run.finished_at)}</td>
            <td style={{ width: 96, whiteSpace: 'nowrap' }}>시스템</td>
            <td>판정 {run.judgments}줄 생성</td>
          </tr>
        )}
      </tbody></table>
    </section>
  )
}
