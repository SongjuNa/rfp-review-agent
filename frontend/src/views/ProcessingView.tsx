import type { RunSummary } from '../api'
import { progress, STEPS } from '../components/progress'

// SCR-02 처리 상태 (목업 v4.57 Loading). docs/screens/SCR-02-처리상태.md
// 진행률은 처리 단계 순서로만 센다(단계 n / 전체). 남은 시간은 알 수 없어 보이지 않는다.

export function ProcessingView({ run }: { run: RunSummary }) {
  const pct = progress(run.step)
  const text = STEPS.find(([k]) => k === run.step)?.[1] ?? '처리하는 중'
  const found = [run.documents && `문서 ${run.documents}개`, run.requirements && `요구사항 ${run.requirements}개`].filter(Boolean).join(' · ')
  return (
    <div style={{ position: 'relative', minHeight: '60vh', marginTop: 20 }}>
      <div className="ldo" style={{ position: 'absolute', background: '#fff' }}>
        <div className="ldc">
          <img src="/img/spec2win-color.png" alt="Spec2Win" width={200} height={40} />
          <div className="ldrow">
            <div className="ldbar" role="progressbar" aria-label="RFP 분석" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div className="ldfill" style={{ width: `${pct}%` }} />
            </div>
            <span className="ldpct">{pct}%</span>
          </div>
          <div className="ldtx" aria-live="polite">{text}{found && ` · ${found}`}</div>
        </div>
      </div>
    </div>
  )
}
