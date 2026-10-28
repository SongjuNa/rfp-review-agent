import { useEffect } from 'react'
import type { RunSummary, User } from '../../api'
import { reviewTitle } from '../../components/format'
import { Outputs } from '../Outputs'

// 판정 탭 머리의 "일탈 목록 초안"·"질의서 초안" 창. 창 안은 아직 예전 목록 화면이다 (SCR-08-11은 다음 묶음).

export function OutputsDialog({ run, user, kind, onClose, onChanged }: {
  run: RunSummary; user: User | null; kind: 'DEVIATION' | 'QUERY'; onClose: () => void; onChanged: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const title = kind === 'DEVIATION' ? '일탈 목록 초안' : '질의서 초안'
  return (
    <div className="mdo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="apw" role="dialog" aria-modal="true" aria-labelledby="outTitle" style={{ width: 'min(1100px, 96vw)' }}>
        <div className="mdh">
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div className="apid">{run.review_no} · {reviewTitle(run)}</div>
            <h2 id="outTitle" style={{ margin: '2px 0 0', fontSize: 'var(--fs-h3)' }}>{title}</h2>
          </div>
          <button type="button" className="ib" onClick={onClose} aria-label="닫기" title="닫기 (Esc)"><span className="ms" aria-hidden="true">close</span></button>
        </div>
        <div className="apb legacy">
          <Outputs runId={run.run_id} actorId={user?.user_id ?? null} editable={run.stage === 'ENGINEER_REVIEW'} onChanged={onChanged} />
        </div>
      </div>
    </div>
  )
}
