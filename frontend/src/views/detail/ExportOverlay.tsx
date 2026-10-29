import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { saveFile } from '../../components/download'
import { EmptyDialog, type ExportKind } from './EmptyDialog'

// SCR-08-11 일탈 목록·질의서 초안 내려받기 (목업 v4.57 Detail exDev/exQ: 로딩 화면 → .docx → 알림).
// 진행 막대는 응답이 올 때까지 90 %에서 멈추고, 받으면 100 %가 된다.
// 목록에 올릴 항목(뺀 항목 제외)이 없으면 파일을 만들지 않고 안내 창을 띄운다. 백엔드도 409로 막는다.

type Kind = ExportKind
const TITLES: Record<Kind, string> = { DEVIATION: '일탈 목록 초안', QUERY: '질의서 초안' }

function stages(kind: Kind, n: number): [number, string][] {
  return kind === 'DEVIATION'
    ? [[0, `일탈 후보 ${n}건 모으는 중`], [40, '원문 위치와 일탈 문장 붙이는 중'], [75, 'Word 문서 만드는 중']]
    : [[0, `질의 후보 ${n}건 모으는 중`], [40, '원문 위치와 질의 문장 붙이는 중'], [75, 'Word 문서 만드는 중']]
}

export function useExport(runId: number) {
  const [job, setJob] = useState<{ kind: Kind; n: number; pct: number } | null>(null)
  const [empty, setEmpty] = useState<Kind | null>(null)
  const [toast, setToast] = useState('')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => { clearInterval(timer.current) }, [])

  const fail = (e: Error) => {
    clearInterval(timer.current)
    setJob(null)
    setToast(`만들지 못했습니다: ${e.message}`)
    setTimeout(() => setToast(''), 4000)
  }

  const run = (kind: Kind, n: number) => {
    setJob({ kind, n, pct: 0 })
    timer.current = window.setInterval(() => setJob((j) => j && { ...j, pct: Math.min(90, j.pct + 6) }), 90)
    api.exportOutputs(runId, kind).then(({ name, blob }) => {
      clearInterval(timer.current)
      setJob((j) => j && { ...j, pct: 100 })
      saveFile(name, blob)
      setTimeout(() => { setJob(null); setToast(`${name}를 만들었습니다.`) }, 350)
      setTimeout(() => setToast(''), 3350)
    }, (e: Error) => {
      // 확인과 내려받기 사이에 목록이 비었으면 백엔드가 409("후보가 없습니다")를 준다
      if (e.message.includes('후보가 없습니다')) {
        clearInterval(timer.current)
        setJob(null)
        setEmpty(kind)
        return
      }
      fail(e)
    })
  }

  /** 목록 항목(뺀 항목 제외)을 먼저 세고, 없으면 안내 창, 있으면 Word 파일을 만든다 */
  const start = (kind: Kind) => {
    if (job) return
    api.outputs(runId).then((items) => {
      const n = items.filter((i) => i.list_kind === kind && i.status !== 'REMOVED').length
      if (n === 0) setEmpty(kind)
      else run(kind, n)
    }, fail)
  }

  const text = job ? [...stages(job.kind, job.n)].reverse().find(([at]) => job.pct >= at)?.[1] : ''
  const view = (
    <>
      {job && (
        <div className="ldo"><div className="ldc">
          <img src="/img/spec2win-color.png" alt="Spec2Win" width={200} height={40} />
          <div className="ldrow">
            <div className="ldbar" role="progressbar" aria-label={TITLES[job.kind]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.pct}>
              <div className="ldfill" style={{ width: `${job.pct}%` }} /></div>
            <span className="ldpct">{job.pct}%</span>
          </div>
          <div className="ldtx" aria-live="polite">{text}</div>
        </div></div>
      )}
      {empty && <EmptyDialog kind={empty} onClose={() => setEmpty(null)} />}
      {toast && <div className="ltoast" role="status"><span className="ms" aria-hidden="true">check_circle</span>{toast}</div>}
    </>
  )
  return { start, view }
}
