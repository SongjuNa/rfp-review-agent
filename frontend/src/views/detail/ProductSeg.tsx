import { useState } from 'react'
import { api, type RunSummary } from '../../api'
import { useLoad } from '../../components/useLoad'
import { useSession } from '../../shell/useSession'

// SCR-08 머리글의 비교 제품 고르기 (목업 v4.57 Detail ".seg 115 kV 비교 제품").
// 설비 묶음(표)마다 하나. 다른 제품을 누르면 그 묶음을 다시 판정한다 (PUT /equipment/{group}/product).

/** "파일 94 TS-115-GIS" → "TS-115-GIS" */
const groupName = (label: string | null) => (label ?? '').replace(/^파일 \d+\s*/, '') || '설비'

export function ProductSeg({ run, onSwitched }: { run: RunSummary; onSwitched: () => void }) {
  const { user } = useSession()
  const id = run.run_id
  const groups = useLoad(() => api.equipment(id), [id])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canEdit = run.stage === 'ENGINEER_REVIEW' && user?.role === 'ENGINEER'
  const shown = (groups.data ?? []).filter((g) => g.family && (g.candidates.length > 0 || g.products?.length))
  const choose = (group: string, code: string) => {
    setBusy(group)
    setError(null)
    api.chooseProduct(id, group, code).then(() => { groups.reload(); onSwitched() }, (e: Error) => setError(e.message))
      .finally(() => setBusy(null))
  }
  return (
    <>
      {shown.map((g) => {
        const current = g.chosen_product ?? g.products?.[0] ?? null
        const options = Array.from(new Set([...g.candidates, ...(g.products ?? [])]))
        const name = groupName(g.label)
        return (
          <span key={g.equipment_group} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--fs-sm)', color: '#667085', marginLeft: 8 }}>{name} 비교 제품</span>
            <div className="seg" role="group" aria-label={`${name} 비교 제품`}
              title={canEdit ? (g.chosen_product ? '엔지니어가 고름' : '자동으로 고름') : '담당자 확인 단계의 엔지니어만 바꿀 수 있습니다'}>
              {options.map((c) => (
                <button key={c} type="button" className={c === current ? 'on' : ''} aria-pressed={c === current}
                  disabled={!canEdit || busy !== null} onClick={() => { if (c !== current) choose(g.equipment_group, c) }}>{c}</button>
              ))}
            </div>
            {busy === g.equipment_group && <span className="en">다시 판정 중…</span>}
          </span>
        )
      })}
      {error && <span className="aphint" role="alert">{error}</span>}
    </>
  )
}
