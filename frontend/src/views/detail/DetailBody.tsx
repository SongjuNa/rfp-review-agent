import { useState } from 'react'
import { api, type RunSummary } from '../../api'
import { loadCounts, overRatio, ratioText } from '../../components/approval'
import { useLoad } from '../../components/useLoad'
import { useSession } from '../../shell/useSession'
import { Requirements } from '../Findings'
import { BidTab } from './BidTab'
import { ExampleTab } from './ExampleTab'
import { JudgeTab } from './JudgeTab'
import { LogTab } from './LogTab'
import { OutputsDialog } from './OutputsDialog'
import { LossTab } from './LossTab'
import { RiskTab } from './RiskTab'

// SCR-08 검토 상세 본문: 요약 칸 5개와 탭 9개 (목업 v4.57 Detail .kpis, .pgtabs).
// 판정·위험 조건·손실 환산·입찰 영향·이력 탭은 목업대로 만들었고, 나머지 탭은 다음 묶음에서 바꿀 때까지 예전 화면을 둔다.

const TABS = [
  ['judge', '판정'], ['read', '문서 읽기 점검'], ['risk', '위험 조건'], ['loss', '손실 환산 (참고)'], ['bid', '입찰 영향'],
  ['comm', '상업 조건'], ['cmp', '지난 RFP 비교'], ['subm', '제출본'], ['log', '이력'],
] as const
type Tab = (typeof TABS)[number][0]

// 결재 상신 단추 문구 (목업 apBtnLabel). 승인됨은 제출본이 없어 "결재 완료"로 쓴다
const SUBMIT_LABELS: Record<string, string> = { ENGINEER_REVIEW: '결재 상신', APPROVED: '결재 완료', REJECTED: '반려됨' }

export function DetailTabs({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="pgtabs" role="tablist" aria-label="검토 메뉴">
      {TABS.map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => onTab(k)}>{label}</button>
      ))}
    </nav>
  )
}

export function DetailBody({ run, tab, onChanged, onSubmit }: {
  run: RunSummary; tab: Tab; onChanged: () => void; onSubmit: () => void
}) {
  const { user } = useSession()
  const id = run.run_id
  const [tick, setTick] = useState(0)
  const [out, setOut] = useState<'DEVIATION' | 'QUERY' | null>(null)
  const changed = () => { setTick((t) => t + 1); onChanged() }
  const counts = useLoad(() => loadCounts(id), [id, tick])
  const empty = useLoad(() => api.warrantyPage(id, { status: 'EMPTY_REVIEW', limit: 1 }).then((p) => p.total), [id, tick])
  const screen = useLoad(() => api.approval(id), [id, tick])
  const losses = useLoad(() => api.losses(id), [id, tick])
  const ratio = screen.data?.review_ratio
  const c = counts.data
  const legacy = { runId: id, actorId: user?.user_id ?? null, editable: run.stage === 'ENGINEER_REVIEW', onChanged: changed }
  const head = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" className="bo" onClick={() => setOut('DEVIATION')}>일탈 목록 초안</button>
      <button type="button" className="bo" onClick={() => setOut('QUERY')}>질의서 초안</button>
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
      {tab === 'read' && <section className="sec legacy"><Requirements {...legacy} /></section>}
      {tab === 'risk' && <RiskTab run={run} tick={tick} onChanged={changed} />}
      {tab === 'loss' && <LossTab run={run} tick={tick} onChanged={changed} />}
      {tab === 'bid' && <BidTab run={run} tick={tick} onChanged={changed} />}
      {(tab === 'comm' || tab === 'cmp' || tab === 'subm') && <ExampleTab tab={tab} />}
      {tab === 'log' && <LogTab run={run} tick={tick} />}
      {out && <OutputsDialog run={run} user={user} kind={out} onClose={() => setOut(null)} onChanged={changed} />}
    </>
  )
}

export type { Tab as DetailTab }
