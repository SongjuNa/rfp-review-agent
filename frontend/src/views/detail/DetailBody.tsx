import { useState } from 'react'
import { type RunSummary } from '../../api'
import { BidTab } from './BidTab'
import { CmpTab } from './CmpTab'
import { CommTab } from './CommTab'
import { JudgeTab } from './JudgeTab'
import { LogTab } from './LogTab'
import { LossTab } from './LossTab'
import { ReadTab } from './ReadTab'
import { RiskTab } from './RiskTab'
import { SubmTab } from './SubmTab'
import { MAIN_TABS, MORE_TABS, type DetailTab } from './tabs'

// SCR-08 검토 상세 탭 (목업 v4.96 Detail .pgtabs2). 탭 5개 + "더 보기" 4개 (update-detail-header).
// 머리글·판정 진행·아래 행동 줄은 ReviewHead.tsx.

/** 탭 줄 (목업 .pgtabs2 + .more). counts: 탭 이름 옆 수 (0이면 숨김) */
export function DetailTabs({ tab, onTab, counts }: { tab: DetailTab; onTab: (t: DetailTab) => void; counts: Partial<Record<DetailTab, number>> }) {
  const [more, setMore] = useState(false)
  const picked = MORE_TABS.find(([k]) => k === tab)
  return (
    <nav className="pgtabs2" role="tablist" aria-label="검토 메뉴">
      {MAIN_TABS.map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => onTab(k)}>
          {label}{counts[k] ? <span className="tabn">{counts[k]}</span> : null}</button>
      ))}
      {picked && <button type="button" role="tab" aria-selected className="on">{picked[1]}</button>}
      <div className="more">
        <button type="button" aria-expanded={more} aria-haspopup="menu" onClick={() => setMore(!more)}>
          더 보기<span className="ms" aria-hidden="true">expand_more</span></button>
        {more && (
          <div className="mm" role="menu" onKeyDown={(e) => { if (e.key === 'Escape') setMore(false) }}>
            {MORE_TABS.map(([k, label]) => (
              <button key={k} type="button" role="menuitem" className={tab === k ? 'on' : ''} onClick={() => { onTab(k); setMore(false) }}>{label}</button>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

export function DetailBody({ run, tab, tick, onTab, onChanged }: {
  run: RunSummary; tab: DetailTab; tick: number; onTab: (t: DetailTab) => void; onChanged: () => void
}) {
  return (
    <>
      {tab === 'judge' && <JudgeTab run={run} tick={tick} onChanged={onChanged} />}
      {tab === 'read' && <ReadTab run={run} tick={tick} onChanged={onChanged} />}
      {tab === 'risk' && <RiskTab run={run} tick={tick} onChanged={onChanged} />}
      {tab === 'loss' && <LossTab run={run} tick={tick} onChanged={onChanged} onGoBid={() => onTab('bid')} />}
      {tab === 'bid' && <BidTab run={run} tick={tick} onChanged={onChanged} />}
      {tab === 'comm' && <CommTab run={run} tick={tick} onGoJudge={() => onTab('judge')} onGoLoss={() => onTab('loss')} />}
      {tab === 'cmp' && <CmpTab run={run} />}
      {tab === 'subm' && <SubmTab run={run} />}
      {tab === 'log' && <LogTab run={run} tick={tick} />}
    </>
  )
}

export type { DetailTab }
