import { Fragment, useState } from 'react'
import { api, type RunLogItem } from '../api'
import { AiModeLine } from '../components/AiMode'
import './detail.css'
import { stamp } from '../components/format'
import { FLOW_ACTION_NAMES, FLOW_COUNT_NAMES, STAGE_NAMES, STAGE_TONES, STEP_NAMES } from '../components/labels'
import { duration } from '../components/progress'
import { useLoad } from '../components/useLoad'
import { href } from '../shell/router'
import { usePageCss } from '../shell/pageCss'

// SCR-25 실행 기록 (목업에 없음, add-run-log, NFR-09). docs/screens/SCR-25_공유.md
// 검토마다 걸린 시간·단계별 시간·AI 사용량·추정 비용. 비용은 모델 단가(팀 가정)로 어림한 값 (CR-06).

const num = (n: number) => n.toLocaleString('en-US')
// 1분 안쪽은 소수 한 자리 초 (규칙만 쓴 실행은 1초도 안 걸린다)
const secs = (s: number | null) => (s === null ? '—' : s < 60 ? `${s.toFixed(1)}초` : duration(s * 1000))
const won = (n: number | null) => (n === null ? '단가 없음' : `${num(n)}원`)
const tokens = (r: RunLogItem) => r.llm_input_tokens + r.llm_output_tokens + r.llm_thinking_tokens
/** 이 기능 전에 처리한 실행: 단계 시간도 AI 기록도 없다 */
const noLog = (r: RunLogItem) => r.steps.length === 0

function Steps({ r }: { r: RunLogItem }) {
  if (noLog(r)) return <p className="dimv">기록 없음 (실행 기록 기능 전에 처리한 검토)</p>
  const tries = [...new Set(r.steps.map((s) => s.attempt))]
  return (
    <div className="rlsteps">
      {tries.map((t) => (
        <div key={t}>
          <b>{t === 0 ? '처음 처리' : `다시 시도 ${t}`}</b>
          <ol>
            {r.steps.filter((s) => s.attempt === t).map((s) => (
              <li key={s.step}><span>{STEP_NAMES[s.step] ?? s.step}</span><span>{s.seconds === null ? '끝나지 않음' : secs(s.seconds)}</span></li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

/** 흐름 기록 (add-flow-history, C2): 저장된 흐름 상태로 단계마다 바뀐 건수·사람 동작·멈춘 자리. 보기만 한다 */
function Flow({ runId }: { runId: number }) {
  const flow = useLoad(() => api.runFlow(runId), [runId])
  if (flow.error) return <p className="c-red">{flow.error}</p>
  if (!flow.data) return <p className="dimv">흐름 기록 불러오는 중…</p>
  const f = flow.data
  if (!f.recorded) return <div className="rlflow"><b>흐름 기록</b><p className="dimv">흐름 기록 없음</p></div>
  const stopText = f.stop === 'END' ? '흐름 끝' : f.stop ? `${STEP_NAMES[f.stop] ?? f.stop}에서 멈춤`
    : f.next_node ? `${STEP_NAMES[f.next_node] ?? f.next_node} 앞에서 멈춤 (처리 중이거나 실패)` : ''
  return (
    <div className="rlflow">
      <b>흐름 기록 <span className="en">흐름 저장 시각 기준</span></b>
      <ol>
        {f.steps.map((s, i) => (
          <li key={i}>
            <span>{STEP_NAMES[s.node] ?? s.node}{s.action && <span className="rlact"> · {FLOW_ACTION_NAMES[s.action] ?? s.action}</span>}</span>
            <span>{secs(s.seconds)}</span>
            <span className="en">{s.changes.map((c) => `${FLOW_COUNT_NAMES[c.key] ?? c.key} ${c.before ?? 0} → ${c.after}`).join(' · ')}</span>
          </li>
        ))}
      </ol>
      {stopText && <p className="rlstop">{stopText}</p>}
    </div>
  )
}

export function RunLog() {
  usePageCss('Products')
  const log = useLoad(() => api.runLog(), [])
  const [open, setOpen] = useState<number | null>(null)
  const rows = log.data ?? []
  const done = rows.filter((r) => r.seconds !== null && r.stage !== 'PROCESSING' && !noLog(r))
  const avg = done.length ? done.reduce((n, r) => n + (r.seconds ?? 0), 0) / done.length : null
  const calls = rows.reduce((n, r) => n + r.llm_calls, 0)
  const cost = rows.reduce((n, r) => n + (r.estimated_cost_krw ?? 0), 0)

  return (
    <main className="main">
      <div className="idl"><span>review_run · run_step_time</span><span>최근 실행 {rows.length}건</span><span>처리 중 AI 사용량만 셉니다 (확정·수정 뒤 문장 다시 쓰기는 빼고)</span><AiModeLine as="span" /></div>
      <div className="ttl"><h1>실행 기록</h1></div>
      <div className="kpis">
        <div className="kpi"><div className="l">실행</div><b>{log.data ? rows.length : '—'}</b><div className="s">기록 있는 실행 {rows.filter((r) => !noLog(r)).length}건</div></div>
        <div className="kpi"><div className="l">평균 걸린 시간</div><b>{avg === null ? '—' : secs(avg)}</b><div className="s">끝난 실행 {done.length}건</div></div>
        <div className="kpi"><div className="l">AI 요청</div><b>{num(calls)}</b><div className="s">재시도 {num(rows.reduce((n, r) => n + r.llm_retries, 0))}번 포함</div></div>
        <div className="kpi"><div className="l">추정 비용 합</div><b>{num(cost)}원</b><div className="s">추정 · 팀 가정 단가, 1$ = 1,500원</div></div>
      </div>
      <div className="tw" style={{ marginTop: 16 }}>
        <table className="tbl rltbl">
          <thead><tr>
            <th>검토</th><th>상태</th><th>시작</th><th style={{ textAlign: 'right' }}>걸린 시간</th><th>모델</th>
            <th style={{ textAlign: 'right' }}>AI 요청</th><th style={{ textAlign: 'right' }}>토큰</th><th style={{ textAlign: 'right' }}>추정 비용</th>
            <th style={{ textAlign: 'right' }}>문서</th><th style={{ textAlign: 'right' }}>요구사항</th><th style={{ textAlign: 'right' }}>판정</th><th style={{ textAlign: 'right' }}>다시 시도</th>
          </tr></thead>
          <tbody>
            {log.data === null && !log.error && <tr><td colSpan={12} className="dimv">불러오는 중…</td></tr>}
            {log.error && <tr><td colSpan={12} className="c-red">{log.error}</td></tr>}
            {rows.map((r) => (
              <Fragment key={r.run_id}>
                <tr className={open === r.run_id ? 'cur' : undefined} style={{ cursor: 'pointer' }} aria-expanded={open === r.run_id}
                  onClick={() => setOpen(open === r.run_id ? null : r.run_id)}>
                  <td><a href={href(`/reviews/${r.run_id}`)} onClick={(e) => e.stopPropagation()}>{r.review_no}</a>
                    <div className="en">{r.review_name ?? r.project_name ?? ''}</div></td>
                  <td><span className={`st ${STAGE_TONES[r.stage] ?? ''}`}>{STAGE_NAMES[r.stage] ?? r.stage}</span>
                    {r.cancelled && <div className="en">취소함</div>}</td>
                  <td>{stamp(r.started_at)}</td>
                  <td style={{ textAlign: 'right' }}>{r.stage === 'PROCESSING' ? '처리 중' : secs(r.seconds)}</td>
                  <td>{r.llm_model ?? '규칙만'}<div className="en">사전 {r.dict_version}</div></td>
                  <td style={{ textAlign: 'right' }}>{noLog(r) ? <span className="dimv">기록 없음</span> : <>{num(r.llm_calls)}{r.llm_retries > 0 && <div className="en c-ora">재시도 {r.llm_retries}</div>}{r.explanations_dropped > 0 && <div className="en c-ora" title="근거 조각·인용·숫자 대조에서 버린 위험 조건 설명">AI 설명 버림 {r.explanations_dropped}</div>}{r.explanations_unverified > 0 && <div className="en c-ora" title="검증 에이전트가 근거가 받쳐 준다고 답하지 않은 위험 조건 설명">검증 확인 필요 {r.explanations_unverified}</div>}{(r.type_examples ?? 0) > 0 && <div className="en" title="다른 문서에서 사람이 고친 유형을 예시로 붙여 물은 줄 (add-type-examples)">유형 예시 {r.type_examples}줄</div>}</>}</td>
                  <td style={{ textAlign: 'right' }}>{noLog(r) ? '—' : num(tokens(r))}</td>
                  <td style={{ textAlign: 'right' }}>{noLog(r) ? '—' : <>{won(r.estimated_cost_krw)}{r.cost_assumed && <div className="en">추정 · 팀 가정</div>}</>}</td>
                  <td style={{ textAlign: 'right' }}>{r.documents}{r.documents_reused > 0 && <div className="en">다시 씀 {r.documents_reused}</div>}</td>
                  <td style={{ textAlign: 'right' }}>{num(r.requirements)}</td>
                  <td style={{ textAlign: 'right' }}>{num(r.judgments)}</td>
                  <td style={{ textAlign: 'right' }}>{r.retries}</td>
                </tr>
                {open === r.run_id && <tr className="rlopen"><td colSpan={12}><Steps r={r} /><Flow runId={r.run_id} /></td></tr>}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
