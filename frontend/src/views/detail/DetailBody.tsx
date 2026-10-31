import { useState } from 'react'
import { api, type RunSummary } from '../../api'
import { loadCounts, overRatio, ratioText } from '../../components/approval'
import { useLoad } from '../../components/useLoad'
import { href } from '../../shell/router'
import { BidTab } from './BidTab'
import { CmpTab } from './CmpTab'
import { CommTab } from './CommTab'
import { JudgeTab } from './JudgeTab'
import { LogTab } from './LogTab'
import { useExport } from './ExportOverlay'
import { LossTab } from './LossTab'
import { ReadTab } from './ReadTab'
import { RiskTab } from './RiskTab'
import { SubmTab } from './SubmTab'

// SCR-08 검토 상세 본문: 요약 칸 5개와 탭 9개 (목업 v4.57 Detail .kpis, .pgtabs).
// 탭은 모두 목업대로 만들었다. 상업 조건·지난 RFP 비교는 API가 없어 예시 화면이다.

const TABS = [
  ['judge', '판정'], ['read', '문서 읽기 점검'], ['risk', '위험 조건'], ['loss', '손실 환산 (참고)'], ['bid', '입찰 영향'],
  ['comm', '상업 조건'], ['cmp', '지난 RFP 비교'], ['subm', '제출본'], ['log', '이력'],
] as const
type Tab = (typeof TABS)[number][0]

// 결재 상신 단추 문구 (목업 apBtnLabel). 승인된 실행은 승인 시점 판정이 제출본 v1이다 (SCR-08-8)
const SUBMIT_LABELS: Record<string, string> = { ENGINEER_REVIEW: '결재 상신', APPROVED: '제출본 v1 확정', REJECTED: '반려됨' }

/** 탭 이름 옆 건수 (목업 .tabn): 문서 읽기 점검은 확인 안 한 줄 수. run이 바뀌면(동작 뒤 다시 불러오면) 다시 센다 */
export function DetailTabs({ run, tab, onTab }: { run: RunSummary; tab: Tab; onTab: (t: Tab) => void }) {
  const unread = useLoad(() => api.readChecks(run.run_id).then((rows) => rows.filter((r) => !r.checked_at).length), [run])
  const counts: Partial<Record<Tab, number>> = { read: unread.data ?? 0 }
  return (
    <nav className="pgtabs" role="tablist" aria-label="검토 메뉴">
      {TABS.map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => onTab(k)}>
          {label}{counts[k] ? <span className="tabn">{counts[k]}</span> : null}</button>
      ))}
    </nav>
  )
}

export function DetailBody({ run, tab, onChanged, onSubmit }: {
  run: RunSummary; tab: Tab; onChanged: () => void; onSubmit: () => void
}) {
  const id = run.run_id
  const [tick, setTick] = useState(0)
  const exporter = useExport(id)
  const changed = () => { setTick((t) => t + 1); onChanged() }
  const counts = useLoad(() => loadCounts(id), [id, tick])
  const empty = useLoad(() => api.warrantyPage(id, { status: 'EMPTY_REVIEW', limit: 1 }).then((p) => p.total), [id, tick])
  const screen = useLoad(() => api.approval(id), [id, tick])
  const losses = useLoad(() => api.losses(id), [id, tick])
  const outputs = useLoad(() => api.outputs(id), [id, tick])
  // Word 파일에 들어갈 줄 수 (목록에서 뺀 줄은 들어가지 않는다). 0이면 내려받기를 막는다
  const listed = (kind: string) => outputs.data?.filter((i) => i.list_kind === kind && i.status !== 'REMOVED').length
  const ratio = screen.data?.review_ratio
  const c = counts.data
  const head = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <span title={listed('DEVIATION') === 0 ? '일탈 목록에 넣을 줄이 없습니다' : undefined}>
        <button type="button" className="bo" disabled={!listed('DEVIATION')} onClick={() => exporter.start('DEVIATION', listed('DEVIATION') ?? 0)}>일탈 목록 초안</button></span>
      <span title={listed('QUERY') === 0 ? '질의서에 넣을 줄이 없습니다' : undefined}>
        <button type="button" className="bo" disabled={!listed('QUERY')} onClick={() => exporter.start('QUERY', listed('QUERY') ?? 0)}>질의서 초안</button></span>
      <a className="bo" href={href(`/reviews/${id}/tbe`)}>TBE 준수표</a>
      <a className="bo" href={href(`/reviews/${id}/datasheet`)}>데이터시트 채우기</a>
      {SUBMIT_LABELS[run.stage] && (
        <button type="button" className={run.stage === 'ENGINEER_REVIEW' ? 'bp' : 'bo'} disabled={run.stage !== 'ENGINEER_REVIEW'}
          onClick={onSubmit}>{SUBMIT_LABELS[run.stage]}</button>
      )}
    </div>
  )

  return (
    <>
      <div className="kpis">
        <div className="kpi"><div className="l">일탈 후보</div><b className={c?.deviations ? 'c-red' : ''}>{c?.deviations ?? '—'}</b></div>
        <div className="kpi"><div className="l">질의 후보</div><b className={c?.queries ? 'c-ora' : ''}>{c?.queries ?? '—'}</b></div>
        <div className="kpi"><div className="l">확인 필요 비율</div><b className={ratio && overRatio(ratio) ? 'c-ora' : 'c-green'}>{ratio ? ratioText(ratio) : '—'}</b>
          <div className="s">기준 {ratio ? Math.round(ratio.threshold * 100) : 20} %</div></div>
        <div className="kpi"><div className="l">보증값 작성 (비어 있음)</div><b className={empty.data ? 'c-blue' : 'dimv'}>{empty.data ?? '—'}</b></div>
        <div className="kpi"><div className="l">손실 환산 참고값</div><b>{c?.loss ?? '—'}</b>
          <div className="s">{losses.data?.length ? `고객 요구 조항 ${losses.data.length}건` : '고객 요구 조항 없음'}</div></div>
      </div>

      {tab === 'judge' && <JudgeTab run={run} tick={tick} onChanged={changed} head={head} />}
      {tab === 'read' && <ReadTab run={run} tick={tick} onChanged={changed} />}
      {tab === 'risk' && <RiskTab run={run} tick={tick} onChanged={changed} />}
      {tab === 'loss' && <LossTab run={run} tick={tick} onChanged={changed} />}
      {tab === 'bid' && <BidTab run={run} tick={tick} onChanged={changed} />}
      {tab === 'comm' && <CommTab />}
      {tab === 'cmp' && <CmpTab />}
      {tab === 'subm' && <SubmTab run={run} />}
      {tab === 'log' && <LogTab run={run} tick={tick} />}
      {exporter.view}
    </>
  )
}

export type { Tab as DetailTab }
