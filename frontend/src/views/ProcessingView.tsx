import type { RunSummary } from '../api'

// SCR-02 처리 상태 (목업 v4.57 Loading). docs/screens/SCR-02-처리상태.md
// 진행률은 처리 단계 순서로만 센다(단계 n / 전체). 남은 시간은 알 수 없어 보이지 않는다.

// 처리 단계 순서 (pipeline/run.py build_graph)와 단계마다 보이는 문장
const STEPS: [string, string][] = [
  ['created', '처리를 시작하는 중'], ['documents', '문서 읽는 중'], ['pairs', '원본·정정본 찾는 중'], ['risks', '위험 조건 찾는 중'],
  ['judge', '제품과 비교해 판정하는 중'], ['check', '공학 규칙 검산 중'], ['warranty', '보증값 후보 만드는 중'], ['loss', '손실 환산 중'],
  ['outputs', '일탈·질의 목록 만드는 중'], ['proposals', '제안 포인트 만드는 중'], ['assign', '담당자에게 나누는 중'],
]

/** 지금 단계까지 끝난 비율 (0~99). 마지막 단계가 끝나면 화면이 판정 탭으로 바뀐다 */
function progress(step: string | null): number {
  const at = Math.max(0, STEPS.findIndex(([k]) => k === step))
  return Math.min(99, Math.round((at / STEPS.length) * 100))
}

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
