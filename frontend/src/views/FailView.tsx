import { useEffect, useState } from 'react'
import { api, type RunSummary } from '../api'
import { dday, dueText, reviewTitle, stamp } from '../components/format'
import { DOC_KIND_NAMES, STEP_NAMES } from '../components/labels'
import { useLoad } from '../components/useLoad'
import { ExampleBand } from './detail/ExampleTab'

// SCR-11 분석 실패 상세 (목업 v4.57 Fail). docs/screens/SCR-11-분석실패.md
// 멈춘 단계·오류 문장·진행 상황·문서·지금 볼 수 있는 것·문의용 정보는 실제 값.
// 다시 시도하는 API가 없어 "어떻게 계속할까요"는 예시 영역이다 (SCR-11_공유.md).

// 처리 단계(pipeline/run.py)를 목업처럼 다섯 묶음으로 보인다
const GROUPS: { label: string; steps: string[]; note: (r: RunSummary) => string }[] = [
  { label: '문서 읽기', steps: ['created', 'documents', 'pairs'], note: (r) => `문서 ${r.documents}개 · 요구사항 ${r.requirements}줄` },
  { label: '위험 조건 찾기', steps: ['risks'], note: (r) => `위험 조건 ${r.risks}건` },
  { label: '제품과 비교·판정', steps: ['judge', 'check', 'warranty', 'loss'], note: (r) => `판정 ${r.judgments}줄` },
  { label: '일탈·질의 목록', steps: ['outputs'], note: (r) => `목록 ${r.output_items}줄` },
  { label: '입찰 영향 정리', steps: ['proposals', 'assign'], note: (r) => `제안 포인트 ${r.proposals}건` },
]
const ICONS: Record<string, string> = { done: 'check', fail: 'priority_high', wait: 'more_horiz' }
// 다시 시도 방법 (예시): 목업 opts의 이름과 설명
const OPTIONS: [string, string, string][] = [
  ['retry', '다시 시도', '멈춘 단계부터 이어서 처리합니다. 앞에서 만든 결과는 그대로 둡니다.'],
  ['code', '코드 규칙만으로 계속', '남은 부분은 언어 모델 없이 코드 규칙으로만 처리합니다. 문맥을 봐야 하는 위험은 놓칠 수 있습니다.'],
  ['skip', '남은 부분은 직접 확인', '남은 부분을 "확인 필요"로 두고 검토를 엽니다. 결재 요청 사유에 올라갑니다.'],
  ['report', '시스템 담당자에게 알리기', '오른쪽 문의용 정보를 담아 IT 지원 요청을 보냅니다. 검토는 멈춘 상태로 둡니다.'],
]

/** 처리 기록의 시각: 목업처럼 시:분만 (날짜는 머리 줄과 문의용 정보에 있다) */
const hm = (iso: string) => stamp(iso).slice(-5)

function stepStates(run: RunSummary): { label: string; cls: string; note: string }[] {
  const at = GROUPS.findIndex((g) => g.steps.includes(run.failed_step ?? ''))
  return GROUPS.map((g, i) => {
    const cls = at < 0 ? 'wait' : i < at ? 'done' : i === at ? 'fail' : 'wait'
    const note = cls === 'done' ? g.note(run) : cls === 'fail' ? `${STEP_NAMES[run.failed_step ?? ''] ?? run.failed_step}에서 멈춤` : '앞 단계가 끝나야 시작'
    return { label: g.label, cls, note }
  })
}

export function FailView({ run, approver }: { run: RunSummary; approver: string | null }) {
  const docs = useLoad(() => api.documents(run.run_id), [run.run_id])
  const others = useLoad(() => api.runs().then((rs) => rs.filter((r) => r.stage === 'FAILED' && r.run_id !== run.run_id)), [run.run_id])
  const [pick, setPick] = useState('retry')
  const [toast, setToast] = useState('')
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const stepName = STEP_NAMES[run.failed_step ?? ''] ?? run.failed_step ?? '처리'
  const failedAt = run.finished_at ?? run.started_at
  const due = run.due_date ? dday(run.due_date) : null
  const other = others.data?.[0]
  const stats: [string, number][] = [['일탈 후보', run.deviation_candidates], ['판정', run.judgments], ['위험 조건', run.risks]]
  const have = run.judgments
    ? `판정 ${run.judgments}줄은 이미 만들어져 있습니다. 멈춘 단계 뒤의 결과는 아직 없습니다.`
    : run.requirements ? `요구사항 ${run.requirements}줄을 뽑았지만 판정은 아직 없습니다.` : '아직 볼 수 있는 결과가 없습니다.'
  const tech: [string, string][] = [
    ['작업 번호', `${run.review_no} (실행 ${run.run_id})`], ['멈춘 단계', run.failed_step ?? '—'],
    ['발생', stamp(failedAt)], ['모델', run.llm_model ?? '언어 모델 없음'], ['오류', run.error_message ?? '—'],
  ]
  const copy = () => {
    navigator.clipboard?.writeText([run.review_no, ...tech.map(([k, v]) => `${k}: ${v}`)].join('\n')).catch(() => undefined)
    setToast('문의용 정보를 복사했습니다.')
  }

  return (
    <>
      <div className="fid">
        <span>{run.review_no}</span><span className="st c-red">처리 실패</span>
        {run.due_date && due && <span>마감 {dueText(run.due_date)} <b className={due.cls}>{due.text}</b></span>}
        <span>등록 {stamp(run.started_at)}</span><span>담당 {run.engineer_name ?? '없음'}</span>
        {approver && <span>결재자 {approver}</span>}
      </div>
      <div className="fh">
        <h1>{reviewTitle(run)}</h1>
        {other && <a className="fother" href={`#/reviews/${other.run_id}`}>다른 분석 실패 · {other.review_no} {other.review_name ?? ''}
          <span className="ms" aria-hidden="true" style={{ fontSize: 18 }}>chevron_right</span></a>}
      </div>
      <div className="fgrid">
        <div style={{ minWidth: 0 }}>
          <div className="falert" role="alert"><span className="ms" aria-hidden="true">error</span>
            <div><b>{stepName} 단계에서 멈췄습니다</b><div className="w">{stamp(failedAt)} · 문서 {run.documents}개</div>
              <div className="c">{run.error_message ?? '오류 문장이 없습니다.'}</div></div></div>

          <section className="fcard"><h2>진행 상황</h2>
            <ol className="fsteps">
              {stepStates(run).map((s) => (
                <li key={s.label} className={s.cls}><span className="fdot"><span className="ms" aria-hidden="true">{ICONS[s.cls]}</span></span><b>{s.label}</b><span>{s.note}</span></li>
              ))}
            </ol>
          </section>

          <section className="fcard"><h2>어떻게 계속할까요</h2>
            <ExampleBand />
            <div className="fopts">
              {OPTIONS.map(([k, label, desc]) => (
                <label key={k} className={pick === k ? 'on' : undefined}><input type="radio" name="fopt" checked={pick === k} onChange={() => setPick(k)} />
                  <span><b>{label}</b><span>{desc}</span></span></label>
              ))}
            </div>
            <div className="fact"><a className="bo" href="#/reviews">나중에</a>
              <button type="button" className="bp" onClick={() => setToast('예시 화면이라 처리하지 않았습니다.')}>{OPTIONS.find(([k]) => k === pick)?.[1]}</button></div>
          </section>
        </div>

        <aside style={{ minWidth: 0 }}>
          <section className="fcard"><h2>지금 볼 수 있는 것</h2>
            <div className="fstat">{stats.map(([k, v]) => <div key={k}><b>{v}</b>{k}</div>)}</div>
            <p className="fhave">{have}</p>
          </section>
          <section className="fcard"><h2>문서<span className="note">{docs.data?.length ?? run.documents}개</span></h2>
            <ul className="ffiles">
              {docs.data?.map((d) => {
                const [st, cls] = !d.readable ? ['읽지 못함', 'st c-ora'] : d.requirements || run.failed_step !== 'documents' ? ['읽음', 'st c-green'] : ['멈춤', 'st c-red']
                return <li key={d.document_id}><span className="ms" aria-hidden="true">description</span>
                  <span className="nm">{d.file_name}<span className="sub3">{DOC_KIND_NAMES[d.doc_kind] ?? d.doc_kind}</span></span><span className={cls}>{st}</span></li>
              })}
            </ul>
          </section>
          <section className="fcard"><h2>처리 기록</h2>
            <ul className="ftl">
              <li><span className="t">{hm(run.started_at)}</span><span>등록 · 분석 시작</span></li>
              <li><span className="t">{hm(failedAt)}</span><span className="bad">{stepName}: {run.error_message ?? '멈춤'}</span></li>
            </ul>
          </section>
          <section className="fcard"><h2>문의용 정보<span className="note">IT 담당자에게 전달할 때</span></h2>
            <dl className="ftech">{tech.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <button type="button" className="bo fcopy" onClick={copy}><span className="ms" aria-hidden="true" style={{ fontSize: 16 }}>content_copy</span>복사</button>
          </section>
        </aside>
      </div>
      {toast && <div className="ftoast" role="status"><span className="ms" aria-hidden="true">check_circle</span>{toast}</div>}
    </>
  )
}
