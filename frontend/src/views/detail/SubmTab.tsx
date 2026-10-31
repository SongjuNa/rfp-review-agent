import { useState } from 'react'
import { api, type RunSummary } from '../../api'
import { loadCounts } from '../../components/approval'
import { saveFile } from '../../components/download'
import { stamp } from '../../components/format'
import { useLoad } from '../../components/useLoad'
import { href } from '../../shell/router'
import { useSession } from '../../shell/useSession'

// SCR-08-8 제출본 탭 (목업 v4.57 Detail #subm). docs/screens/SCR-08-8-제출본.md
// 승인된 실행은 판정을 고칠 수 없으므로(담당자 확인 단계에서만 고침) 승인 시점의 판정이 곧 제출본 v1이다.
// 따로 사본을 저장하지 않고, 승인 기록과 지금 판정 수로 보인다.
// 인계 패키지(add-submission-package): 일탈 목록·질의서 Word, TBE(v1)·데이터시트 엑셀을 zip 하나로.
// 내려받기는 누구나, 영업에 넘기기는 엔지니어만. 넘긴 기록은 /handoffs의 PACKAGE 줄.

export function SubmTab({ run }: { run: RunSummary }) {
  const id = run.run_id
  const { user } = useSession()
  const [tick, setTick] = useState(0)
  const [busy, setBusy] = useState<'dl' | 'send' | null>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const screen = useLoad(() => api.approval(id), [id, run.stage])
  const counts = useLoad(() => loadCounts(id), [id, run.stage])
  const sheets = useLoad(() => api.datasheets(id), [id, run.stage])
  const outputs = useLoad(() => api.outputs(id), [id, run.stage])
  const sent = useLoad(() => api.handoffs(id), [id, run.stage, tick])
  const a = screen.data?.approval
  const approved = run.stage === 'APPROVED' && a?.decision === 'APPROVED'
  const c = counts.data
  const last = sent.data?.find((h) => h.kind === 'PACKAGE')
  // 첨부: 일탈·질의 목록(뺀 항목만 있으면 없음) + TBE + 데이터시트 수. 패키지와 같은 셈
  const has = (kind: string) => outputs.data?.some((o) => o.list_kind === kind && o.status !== 'REMOVED') ? 1 : 0
  const files = outputs.data && sheets.data ? has('DEVIATION') + has('QUERY') + 1 + sheets.data.length : null

  const download = () => {
    if (busy) return
    setBusy('dl')
    setNote(null)
    api.downloadPackage(id).then(({ name, blob }) => {
      saveFile(name, blob)
      setNote({ ok: true, text: `${name} 를 내려받았습니다.` })
    }, (e: Error) => setNote({ ok: false, text: e.message })).finally(() => setBusy(null))
  }
  const send = () => {
    if (busy || !user) return
    setBusy('send')
    setNote(null)
    api.handoffPackage(id, user.user_id).then((res) => {
      setTick((t) => t + 1)
      setNote(res.sent
        ? { ok: true, text: `영업 담당(${res.mail_to})에게 인계 패키지를 보냈습니다. 파일 ${res.files.length - 1}개와 목록.txt` }
        : { ok: false, text: res.error === '주소 없음' ? '영업 주소가 설정되지 않아 보내지 못했습니다(RFP_MAIL_SALES).' : `보내지 못했습니다: ${res.error}` })
    }, (e: Error) => setNote({ ok: false, text: e.message })).finally(() => setBusy(null))
  }

  return (
    <section className="sec" id="subm">
      <div className="sech">
        <h2>제출본<span className="note">결재가 승인된 시점의 판정을 고정해 둔 것입니다. 고객에게 낸 내용의 기준이 됩니다.</span></h2>
        <a className="bo" href={href(`/reviews/${id}/tbe`)}>이 판정으로 TBE 준수표 받기</a>
      </div>
      {screen.error && <p role="alert">{screen.error} <button type="button" className="lnk" onClick={screen.reload}>다시 불러오기</button></p>}
      {approved && a && (
        <>
          <table className="subt" style={{ marginTop: 12 }}>
            <thead><tr><th>버전</th><th>확정</th><th>결재자</th><th>판정</th><th>일탈 · 질의</th><th>첨부</th><th>상태</th></tr></thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 700 }}>v1</td>
                <td>{a.decided_at ? stamp(a.decided_at) : '—'}</td>
                <td>{a.approver ?? '—'}</td>
                <td>{run.judgments}줄</td>
                <td>일탈 {c?.deviations ?? '—'} · 질의 {c?.queries ?? '—'}</td>
                <td title="일탈 목록·질의서 초안(있는 것만), TBE 준수표, 데이터시트">{files === null ? '—' : `${files}개`}</td>
                <td><span className="st c-green">현재 제출본</span></td>
              </tr>
            </tbody>
          </table>
          <div className="subpk">
            <span className="grow"><b>인계 패키지</b> · 일탈 목록·질의서 초안, TBE 준수표, 데이터시트를 zip 하나로 묶어 영업에 넘깁니다.
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
      )}
      {screen.data && !approved && (
        <div className="subempty">아직 확정된 제출본이 없습니다. 결재 상신 후 결재자가 승인하면 그 시점의 판정이 제출본 v1로 저장되고 잠깁니다. 인계 패키지도 그때 만들 수 있습니다.</div>
      )}
    </section>
  )
}
