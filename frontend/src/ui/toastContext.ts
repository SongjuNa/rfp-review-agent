import { createContext, useContext } from 'react'

// 알림 쌓기의 공용 부분 (Toasts.tsx가 그린다)
export type ToastKind = 'success' | 'info' | 'error'
export const TOAST_MS = 4000
/** 알림에 붙이는 링크 하나 (예: 검토 열기). 누르면 알림이 닫힌다 */
export type ToastLink = { href: string; label: string }
type Api = { show: (text: string, kind?: ToastKind, link?: ToastLink) => void }

export const ToastCtx = createContext<Api>({ show: () => {} })

/** 화면에서 알림 띄우기: const toast = useToast(); toast.show('저장했습니다') */
export function useToast() {
  return useContext(ToastCtx)
}
