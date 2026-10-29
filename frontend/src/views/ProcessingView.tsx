import { useEffect, useState } from 'react'
import type { RunSummary } from '../api'
import { duration, progress, STALL_MS, stepText } from '../components/progress'

// SCR-02 처리 상태 (목업 v4.57 Loading). docs/screens/SCR-02-처리상태.md
// 진행률은 처리 단계 순서와 문서 읽기 단계의 세부 진행으로 센다. 남은 시간은 알 수 없어 보이지 않는다.

export function ProcessingView({ run }: { run: RunSummary }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)     // 지난 시간을 1초마다 다시 센다
    return () => clearInterval(timer)
  }, [])
  const pct = progress(run)
  const found = [run.documents && `문서 ${run.documents}개`, run.requirements && `요구사항 ${run.requirements}개`].filter(Boolean).join(' · ')
  const stalled = now - Date.parse(run.step_updated_at) > STALL_MS
  const hint = run.llm_model
    ? 'AI를 쓰는 분석은 문서가 크면 15분 넘게 걸릴 수 있어요. 이 창을 닫아도 분석은 계속됩니다.'
    : 'AI 없이 규칙으로만 분석해 보통 1분 안에 끝나요.'
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
          <div className="ldtx" aria-live="polite">{stepText(run)}{found && ` · ${found}`}</div>
          <div className="ldtx ldtime" style={{ marginTop: 4 }}>지난 시간 {duration(now - Date.parse(run.started_at))}</div>
          <div className="ldtx" style={{ marginTop: 4, fontSize: 12 }}>{hint}</div>
          {stalled && (
            <p role="alert" className="ldtx" style={{ marginTop: 12, color: '#B42318' }}>
              10분 넘게 진행이 없습니다. 분석 중에 백엔드가 꺼졌다면 이 검토는 끝나지 않으니 검토를 다시 등록해 주세요.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
