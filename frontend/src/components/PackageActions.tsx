import { useState } from 'react'
import { api } from '../api'
import { saveFile } from './download'
import { stamp } from './format'
import { useLoad } from './useLoad'
import { useSession } from '../shell/useSession'

// 인계 패키지 내려받기·영업에 넘기기 (add-submission-package). 검토 상세 제출본 탭(SCR-08-8)과
// 사업 상세 인계 패키지 창(SCR-05 v4.96)이 같이 쓴다 (update-home-projects).
// 내려받기는 누구나, 영업에 넘기기는 엔지니어만. 넘긴 기록은 /handoffs의 PACKAGE 줄.

export function PackageActions({ runId, label }: { runId: number; label?: React.ReactNode }) {
  const { user } = useSession()
  const [tick, setTick] = useState(0)
  const [busy, setBusy] = useState<'dl' | 'send' | null>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const sent = useLoad(() => api.handoffs(runId), [runId, tick])
  const last = sent.data?.find((h) => h.kind === 'PACKAGE')

  const download = () => {
    if (busy) return
    setBusy('dl')
    setNote(null)
    api.downloadPackage(runId).then(({ name, blob }) => {
      saveFile(name, blob)
      setNote({ ok: true, text: `${name} 를 내려받았습니다.` })
    }, (e: Error) => setNote({ ok: false, text: e.message })).finally(() => setBusy(null))
  }
  const send = () => {
    if (busy || !user) return
    setBusy('send')
    setNote(null)
    api.handoffPackage(runId, user.user_id).then((res) => {
      setTick((t) => t + 1)
      setNote(res.sent
        ? { ok: true, text: `영업 담당(${res.mail_to})에게 인계 패키지를 보냈습니다. 파일 ${res.files.length - 1}개와 목록.txt` }
        : { ok: false, text: res.error === '주소 없음' ? '영업 주소가 설정되지 않아 보내지 못했습니다(RFP_MAIL_SALES).' : `보내지 못했습니다: ${res.error}` })
    }, (e: Error) => setNote({ ok: false, text: e.message })).finally(() => setBusy(null))
  }

  return (
    <>
      <div className="subpk">
        <span className="grow">{label ?? <><b>인계 패키지</b> · 일탈 목록·질의서 초안, TBE 준수표, 데이터시트를 zip 하나로 묶어 영업에 넘깁니다.</>}
          {last && (last.mail_error
            ? <span className="c-red"> {stamp(last.sent_at)} 보내지 못함({last.mail_error === '주소 없음' ? '영업 주소 없음' : '발송 실패'})</span>
            : <span> {stamp(last.sent_at)} 영업 담당({last.mail_to})에게 보냄 · {last.sent_by_name}</span>)}</span>
        <button type="button" className="bo" onClick={download} disabled={busy !== null}>
          <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>download</span>{busy === 'dl' ? '만드는 중…' : '인계 패키지 내려받기'}</button>
        {user?.role === 'ENGINEER' && (
          <button type="button" className="bp" onClick={send} disabled={busy !== null}>
            <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>forward_to_inbox</span>
            {busy === 'send' ? '보내는 중…' : last && !last.mail_error ? '다시 넘기기' : '영업에 넘기기'}</button>
        )}
      </div>
      {note && <p role={note.ok ? 'status' : 'alert'} className={note.ok ? '' : 'c-red'} style={{ margin: '8px 0 0', fontSize: 'var(--fs-sm)' }}>{note.text}</p>}
    </>
  )
}
