import { useState } from 'react'
import { api, type Judgment, type Proposal, type RunSummary } from '../../api'
import { itemName, locShort } from '../../components/judgment'
import { POINT_KIND_NAMES, STATUS_NAMES } from '../../components/labels'
import { useLoad } from '../../components/useLoad'
import { useSession } from '../../shell/useSession'

// SCR-08-5 입찰 영향 탭 (목업 v4.57 Detail #bid). docs/screens/SCR-08-5-입찰영향.md
// 유리한 점은 제안 포인트(FR-14·15), 불리한 점은 일탈 후보·질의 후보 판정. 채택한 포인트만 영업·견적에 전달된다(AR-08).

const TONES: Record<string, string> = { CANDIDATE: 'st c-grey', ADOPTED: 'st c-green', EDITED: 'st c-green', DISCARDED: 'st c-grey' }
// 불리한 점의 대응 문장 (목업 cons)
const CONS: Record<string, [string, string]> = {
  DEVIATION_CANDIDATE: [' 미달', '일탈 목록에 올리고 대체 정격의 운전 조건을 설명'],
  QUERY_CANDIDATE: [' 값 불명확', '서면 질의로 적용 값을 확인한 뒤 판정'],
}

export function BidTab({ run, tick, onChanged }: { run: RunSummary; tick: number; onChanged: () => void }) {
  const { user } = useSession()
  const id = run.run_id
  const points = useLoad(() => api.proposals(id), [id, tick])
  const cons = useLoad(() => Promise.all(['DEVIATION_CANDIDATE', 'QUERY_CANDIDATE'].map((result) =>
    api.judgmentPage(id, { result, limit: 100 }).then((p) => p.items))).then((r) => r.flat()), [id, tick])
  const docs = useLoad(() => api.documents(id), [id])
  const canEdit = run.stage === 'ENGINEER_REVIEW' && user?.role === 'ENGINEER'
  const lock = run.stage !== 'ENGINEER_REVIEW' ? '담당자 확인 단계에서만 고칠 수 있습니다' : !canEdit ? '엔지니어만 고칠 수 있습니다' : undefined
  const tip = '설명 문장은 AI가 작성합니다. 채택한 항목만 영업과 견적 담당에 협조 요청으로 보냅니다.'

  return (
    <section className="sec" id="bid">
      <div className="sech"><h2>입찰 영향<span className="hint" tabIndex={0} role="img" aria-label={tip} title={tip}><span className="ms" aria-hidden="true">info</span></span></h2></div>
      <div className="cols">
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: '#067647', paddingBottom: 4 }}>유리한 점</div>
          {points.error && <p role="alert">{points.error}</p>}
          {points.data?.length === 0 && <p style={{ color: '#667085', margin: '10px 0' }}>내세울 강점 후보가 없습니다.</p>}
          {points.data?.map((p) => <Point key={p.point_id} runId={id} p={p} canEdit={canEdit} lock={lock} onDone={onChanged}
            where={locShort(p, docs.data ?? [])} />)}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: '#B42318', paddingBottom: 4 }}>불리한 점</div>
          {cons.error && <p role="alert">{cons.error}</p>}
          {cons.data?.map((j: Judgment) => (
            <div key={j.judgment_id} className="li">
              <span className="ms c-red" aria-hidden="true">trending_down</span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <b style={{ fontWeight: 600 }}>{itemName(j)}{CONS[j.result][0]}</b>
                <div style={{ fontSize: 'var(--fs-sm)', color: '#475467', marginTop: 2 }}>대응: {CONS[j.result][1]}</div>
                <div className="en">{locShort(j, docs.data ?? [])}</div>
              </div>
            </div>
          ))}
          {cons.data?.length === 0 && <p style={{ color: '#667085', margin: '10px 0' }}>불리한 점이 없습니다.</p>}
        </div>
      </div>
    </section>
  )
}

function Point({ runId, p, where, canEdit, lock, onDone }: {
  runId: number; p: Proposal; where: string; canEdit: boolean; lock?: string; onDone: () => void
}) {
  const { user } = useSession()
  const [dropping, setDropping] = useState(false)
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const act = (action: 'ADOPT' | 'DISCARD') => {
    setBusy(true)
    setError(null)
    api.act(runId, { target: 'proposal_point', target_id: p.point_id, action, reason: action === 'DISCARD' ? why.trim() : undefined, actor_id: user!.user_id })
      .then(() => { setDropping(false); setWhy(''); onDone() })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false))
  }
  const adopted = p.status === 'ADOPTED' || p.status === 'EDITED'
  return (
    <div className="li">
      <span className="ms c-green" aria-hidden="true">trending_up</span>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <b style={{ fontWeight: 600 }}>{p.basis}</b><span className={TONES[p.status] ?? 'st c-grey'}>{STATUS_NAMES[p.status] ?? p.status}</span>
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: '#475467', marginTop: 2 }}>{p.text_draft}</div>
        <div className="en">
          {POINT_KIND_NAMES[p.point_kind] ?? p.point_kind} · {where}
          {p.is_assumed && <span className="st c-ora" style={{ marginLeft: 6 }}>팀 가정</span>}
          {p.number_check === 'MISMATCH' && <span className="st c-red" style={{ marginLeft: 6 }}>숫자 불일치: {p.number_detail}</span>}
        </div>
        {dropping
          ? <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
              <input className="fi" aria-label="버리는 사유" placeholder="버리는 사유" value={why} autoFocus onChange={(e) => setWhy(e.target.value)} style={{ flex: 1, height: 32 }} />
              <button type="button" className="bp" disabled={busy || !why.trim()} onClick={() => act('DISCARD')}>버리기</button>
              <button type="button" className="bo" onClick={() => { setDropping(false); setWhy('') }}>취소</button>
            </div>
          : <div style={{ display: 'flex', gap: 12, marginTop: 4 }} title={lock}>
              <button type="button" className="lnk" disabled={!canEdit || busy || adopted} onClick={() => act('ADOPT')}>채택</button>
              <button type="button" className="lnk" disabled={!canEdit || busy || p.status === 'DISCARDED'} onClick={() => setDropping(true)}>버림</button>
            </div>}
        {error && <p className="aphint" role="alert">{error}</p>}
      </div>
    </div>
  )
}
