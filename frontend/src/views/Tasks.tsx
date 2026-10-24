import { useState } from 'react'
import { api, type Assignment, type ReviewCard, type User } from '../api'
import { Assumed, Badge, ErrorText, Evidence } from '../components/common'
import { POINT_KIND_NAMES, ROLE_NAMES, STAGE_NAMES, TASK_STATUS_NAMES } from '../components/labels'
import { useLoad } from '../components/useLoad'

const STATUS_TONES: Record<string, string> = { TODO: 'warn', DOING: '', DONE: 'ok' }

/** 엔지니어·승인자: 멈춰 있는 검토와 걸린 승인 기준. 누르면 그 검토를 연다. */
function ReviewCards({ cards, role, onOpen }: { cards: ReviewCard[]; role: string; onOpen: (runId: number) => void }) {
  if (cards.length === 0) {
    return <p>{role === 'APPROVER' ? '승인을 기다리는 검토가 없습니다.' : '담당자 확인 중인 검토가 없습니다.'}</p>
  }
  return (
    <ul className="cards">
      {cards.map((c) => (
        <li key={c.run_id} className="card">
          <header>
            <strong>검토 #{c.run_id}</strong> <Badge>{STAGE_NAMES[c.stage]}</Badge>
            <span className="sub">{c.files}</span>
          </header>
          <p className="sub">요구사항 {c.summary.requirements} · 일탈 후보 {c.summary.deviation_candidates}
            · 검산 위반 {c.summary.check_violations} · 목록 {c.summary.output_items} · 제안 {c.summary.proposals}</p>
          {c.criteria.length > 0 ? (
            <ul className="plain">
              {c.criteria.map((r) => <li key={r.ar_code}><Badge tone="warn">{r.ar_code}</Badge> {r.detail}</li>)}
            </ul>
          ) : <p className="sub">걸린 승인 기준이 없습니다.</p>}
          <div className="actions">
            <button type="button" onClick={() => onOpen(c.run_id)}>
              {role === 'APPROVER' ? '승인하러 가기' : '확인하러 가기'}</button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function AssignmentCard({ task, user, onChanged }: { task: Assignment; user: User; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setStatus = (status: string) => {
    setBusy(true)
    setError(null)
    api.setTaskStatus(task.assignment_id, status, user.user_id)
      .then(onChanged, (e: Error) => setError(e.message)).finally(() => setBusy(false))
  }
  return (
    <li className="card">
      <header>
        <Badge tone={STATUS_TONES[task.status]}>{TASK_STATUS_NAMES[task.status]}</Badge>
        <Badge>{task.point_kind ? `제안 포인트 · ${POINT_KIND_NAMES[task.point_kind] ?? task.point_kind}`
          : task.type_name ?? task.type_code}</Badge>
        {task.repeat_count > 1 && <Badge tone="warn">같은 조건 {task.repeat_count}개 장비에 반복</Badge>}
        <Assumed show={!!task.is_assumed} />
        <span className="sub">검토 #{task.run_id}{task.assignee && ` · 처리: ${task.assignee}`}</span>
      </header>
      <p>{task.text}</p>
      <Evidence runId={task.run_id} requirementId={task.requirement_id} locations={task.locations} />
      <div className="actions">
        {(['TODO', 'DOING', 'DONE'] as const).filter((s) => s !== task.status).map((s) => (
          <button key={s} type="button" disabled={busy} onClick={() => setStatus(s)}>{TASK_STATUS_NAMES[s]}(으)로</button>
        ))}
      </div>
      <ErrorText error={error} />
    </li>
  )
}

/** 고른 사용자 역할의 "내 할 일" (FR-11). */
export function MyTasks({ user, onOpen }: { user: User | null; onOpen: (runId: number) => void }) {
  const [hideDone, setHideDone] = useState(true)
  const { data, error, reload } = useLoad(() => (user ? api.tasks(user.user_id) : Promise.resolve(null)), [user?.user_id])
  if (!user) return <p>사용자를 고르세요.</p>
  if (!data) return <ErrorText error={error} />
  const tasks = data.assignments.filter((t) => !hideDone || t.status !== 'DONE')
  const reviewer = data.role === 'ENGINEER' || data.role === 'APPROVER'
  return (
    <section>
      <h2>내 할 일 <span className="sub">{user.user_name} · {ROLE_NAMES[data.role] ?? data.role}</span></h2>
      <ErrorText error={error} />
      {reviewer ? <ReviewCards cards={data.reviews} role={data.role} onOpen={onOpen} /> : (
        <>
          <p className="sub">유형별로 전달된 요구사항과 채택된 제안 포인트입니다. 모두 후보이며 원문 위치를 눌러 확인하세요.
            {' '}<label><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> 끝난 일 숨기기</label></p>
          {tasks.length === 0 ? <p>전달된 할 일이 없습니다.</p> : (
            <ul className="cards">
              {tasks.map((t) => <AssignmentCard key={t.assignment_id} task={t} user={user} onChanged={reload} />)}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
