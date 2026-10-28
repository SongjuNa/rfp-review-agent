import { useEffect, useState } from 'react'

// 화면 주소는 `#/reviews/3`처럼 # 뒤에 둔다 (SCR-00 2장). 새 의존성 없이 hashchange만 쓴다.

/** 지금 화면 주소. `#/reviews/3` → `/reviews/3`, 비어 있으면 `/`. */
export function currentPath(): string {
  const h = window.location.hash.replace(/^#/, '')
  return h.startsWith('/') ? h : '/' + h
}

export function useHashPath(): string {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const on = () => setPath(currentPath())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return path
}

export function navigate(path: string) {
  window.location.hash = path
}

export function href(path: string): string {
  return '#' + path
}
