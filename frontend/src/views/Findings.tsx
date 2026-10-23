// 요구사항 표(유형 칸, 시안 1)와 위험 조건
import { useState } from 'react'
import { api } from '../api'
import { ActionBar, Assumed, Badge, ErrorText, Evidence, More } from '../components/common'
import { RISK_NAMES, STATUS_NAMES, locationText } from '../components/labels'
import { useLoad, usePaged } from '../components/useLoad'
import type { ViewProps } from './types'

const TYPES: [string, string][] = [
  ['', '전체'], ['TECH_PERF', '기술 성능'], ['RISK', '위험 조건'], ['STANDARD_CERT', '적용 규격·인증'],
  ['COST', '비용 영향'], ['TEST', '시험'], ['MAKER_QUAL', '제조사 자격'], ['SITE_ENV', '설치 환경'],
]
const TYPE_NAMES = Object.fromEntries(TYPES)

export function Requirements({ runId }: ViewProps) {
  const [type, setType] = useState('')
  const docs = useLoad(() => api.documents(runId), [runId])
  const { rows, error, more, pageSize } = usePaged(
    (offset, limit) => api.requirements(runId, { type_code: type || undefined, offset, limit }), [runId, type])
  return (
    <section>
      <h3>문서</h3>
      <ErrorText error={docs.error} />
      <table>
        <thead><tr><th>파일</th><th>이름</th><th>묶음</th><th>종류</th><th>규격 체계</th><th>판정 대상</th><th>요구사항</th></tr></thead>
        <tbody>
          {docs.data?.map((d) => (
            <tr key={d.document_id}>
              <td>{d.file_no}</td>
              <td>{d.file_name}{!d.readable && <Badge tone="warn">판독 불가</Badge>}{d.needs_review && <Badge>분류 확인 필요</Badge>}</td>
              <td>{d.bundle}</td><td>{d.doc_kind}</td><td>{d.standard_system ?? '—'}</td>
              <td>{d.judge_target ? '예' : '아니오'}</td><td>{d.requirements}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>요구사항</h3>
      <label>유형 <select value={type} onChange={(e) => setType(e.target.value)}>
        {TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select></label>
      <ErrorText error={error} />
      <table>
        <thead><tr><th>원문</th><th>유형</th><th>값</th><th>위치</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.requirement_id}>
              <td className="text">{r.text_raw}<Assumed show={r.is_assumed} /></td>
              <td>{r.types.map((t) => (
                <Badge key={t.type_code} tone={t.is_primary ? 'primary' : ''}>{TYPE_NAMES[t.type_code] ?? t.type_code}</Badge>
              ))}</td>
              <td>{r.values.map((v) => (
                <div key={v.value_seq}>{v.raw_text}{v.unit_raw ? ` ${v.unit_raw}` : ''}
                  {v.cond_time_s ? ` (${v.cond_time_s}초)` : ''}{v.flag === 'REDACTED' && <Badge>값 없음</Badge>}</div>
              ))}</td>
              <td>{r.locations.map((l, i) => <div key={i}>{locationText(l)}</div>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <More shown={rows.length} pageSize={pageSize} onMore={more} />
    </section>
  )
}

export function Risks({ runId, actorId, editable }: ViewProps) {
  const { data, error, reload } = useLoad(() => api.risks(runId), [runId])
  return (
    <section>
      <ErrorText error={error} />
      {data?.length === 0 && <p>위험 조건 후보가 없습니다.</p>}
      <ul className="cards">
        {data?.map((r) => (
          <li key={r.risk_id} className="card">
            <header>
              <Badge tone="warn">{RISK_NAMES[r.risk_kind] ?? r.risk_kind}</Badge>
              {r.expression && <Badge>표현 “{r.expression}”</Badge>}
              <Badge>{STATUS_NAMES[r.status] ?? r.status}</Badge>
            </header>
            {r.facts && <p>{r.facts}</p>}
            {r.explanation_ai && <p className="ai">AI 설명: {r.explanation_ai}</p>}
            {r.members.map((m) => (
              <div key={m.requirement_id} className="member">
                {m.value_raw && <strong>{m.value_raw} </strong>}
                <Evidence runId={runId} requirementId={m.requirement_id} locations={m.locations} />
              </div>
            ))}
            <ActionBar runId={runId} target="risk_flag" targetId={r.risk_id} actorId={actorId}
              editable={editable} onDone={reload} />
          </li>
        ))}
      </ul>
    </section>
  )
}
