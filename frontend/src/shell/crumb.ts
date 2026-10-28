import { createContext, useContext, useEffect } from 'react'

// 화면이 불러온 뒤에야 아는 위치 이름(예: 검토 번호 RV-2026-025)을 머리글 위치 마지막 칸에 넣는다.
export const CrumbContext = createContext<(label: string | null) => void>(() => undefined)

export function useCrumbTail(label: string | null | undefined) {
  const set = useContext(CrumbContext)
  useEffect(() => {
    set(label ?? null)
    return () => set(null)
  }, [label, set])
}
