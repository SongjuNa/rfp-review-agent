import { createContext, useContext } from 'react'

// 알림 쌓기의 공용 부분 (Toasts.tsx가 그린다)
export type ToastKind = 'success' | 'info' | 'error'
export const TOAST_MS = 4000
type Api = { show: (text: string, kind?: ToastKind) => void }

export const ToastCtx = createContext<Api>({ show: () => {} })

/** 화면에서 알림 띄우기: const toast = useToast(); toast.show('저장했습니다') */
export function useToast() {
  return useContext(ToastCtx)
}
