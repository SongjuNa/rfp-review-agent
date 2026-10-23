import { useCallback, useEffect, useState } from 'react'

/** 불러오기 + 다시 불러오기. deps가 바뀌면 다시 부른다. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps)
  const reload = useCallback(() => {
    run().then((d) => { setData(d); setError(null) }, (e: Error) => setError(e.message))
  }, [run])
  useEffect(reload, [reload])
  return { data, error, reload }
}

/** offset/limit으로 나눠 받는 목록. */
export function usePaged<T>(load: (offset: number, limit: number) => Promise<T[]>, deps: unknown[],
  pageSize = 100) {
  const [rows, setRows] = useState<T[]>([])
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps)
  const reload = useCallback(() => {
    run(0, pageSize).then((d) => { setRows(d); setError(null) }, (e: Error) => setError(e.message))
  }, [run, pageSize])
  const more = () => {
    run(rows.length, pageSize).then((d) => setRows([...rows, ...d]), (e: Error) => setError(e.message))
  }
  useEffect(reload, [reload])
  return { rows, error, reload, more, pageSize }
}
