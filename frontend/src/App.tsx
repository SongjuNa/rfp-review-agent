import { useEffect, useState } from 'react'
import { fetchHealth, type Health } from './api'

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchHealth().then(setHealth, (e: Error) => setError(e.message))
  }, [])

  return (
    <main>
      <h1>RFP 기술 검토 지원</h1>
      <p>지킬 조건은 빠짐없이, 내세울 강점은 근거와 함께.</p>
      <section aria-label="시스템 상태">
        <h2>시스템 상태</h2>
        {error && <p role="alert">백엔드에 연결할 수 없습니다 ({error})</p>}
        {!error && !health && <p>확인 중…</p>}
        {health && (
          <dl>
            <dt>API</dt>
            <dd>{health.status === 'ok' ? '정상' : '일부 장애'}</dd>
            <dt>DB</dt>
            <dd>{health.database === 'ok' ? `정상 (${health.schema_version})` : '연결 안 됨'}</dd>
            <dt>언어 모델 키</dt>
            <dd>{health.llm_configured ? '설정됨' : '없음'}</dd>
          </dl>
        )}
      </section>
    </main>
  )
}
