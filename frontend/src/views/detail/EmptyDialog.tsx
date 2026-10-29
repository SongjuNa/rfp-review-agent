import { useEffect, useRef } from 'react'

// SCR-08-11 일탈 목록·질의서 초안: 목록에 올릴 항목이 없을 때 띄우는 안내 창.

export type ExportKind = 'DEVIATION' | 'QUERY'
const TITLES: Record<ExportKind, string> = { DEVIATION: '일탈 목록 초안', QUERY: '질의서 초안' }
const NOUNS: Record<ExportKind, string> = { DEVIATION: '일탈', QUERY: '질의' }

/** 목록이 비었을 때 안내 창 (Esc·바깥 누르기·확인으로 닫힘) */
export function EmptyDialog({ kind, onClose }: { kind: ExportKind; onClose: () => void }) {
  const ok = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    ok.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const noun = NOUNS[kind]
  return (
    <div className="mdo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="apw" style={{ width: 'min(440px, 100%)', height: 'auto' }} role="alertdialog" aria-modal="true"
        aria-labelledby="exEmptyTitle" aria-describedby="exEmptyText">
        <div className="mdh">
          <h2 id="exEmptyTitle" style={{ margin: 0, fontSize: 'var(--fs-h3)', flex: 1 }}>{TITLES[kind]}을 만들 수 없습니다</h2>
          <button type="button" className="ib" onClick={onClose} aria-label="닫기" title="닫기 (Esc)"><span className="ms" aria-hidden="true">close</span></button>
        </div>
        <div className="apb">
          <p id="exEmptyText" style={{ margin: 0 }}>{noun} 목록에 올릴 {noun} 후보가 없습니다.
            판정 탭에서 {noun} 후보가 있는지, 목록에서 모두 빼지 않았는지 확인해 주세요.</p>
        </div>
        <div className="mdf">
          <button ref={ok} type="button" className="bp" onClick={onClose}>확인</button>
        </div>
      </div>
    </div>
  )
}
