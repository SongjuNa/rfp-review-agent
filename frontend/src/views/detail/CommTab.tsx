import { useState } from 'react'
import { api, type CommercialImpact, type CostCondition, type RunDocument, type RunSummary } from '../../api'
import { locName } from '../../components/judgment'
import { useLoad } from '../../components/useLoad'
import { href } from '../../shell/router'

// SCR-08-6 상업 조건 탭 (목업 v4.57 Detail #comm). docs/screens/SCR-08-6-상업조건.md
// FR-16 비용 조건 요약(add-cost-conditions): 비용 영향 유형이 붙은 요구사항을 조항 종류별로 모으고,
// 기술 판단에서 생긴 상업 영향(손실 환산 가산액, 일탈 후보)을 함께 보인다. 금액은 계산하지 않는다.
// 보내기는 협조 요청 현황(SCR-13)에서 한다. 이 탭은 견적 담당 협조 요청 상태만 보인다 (SCR-08-6_공유.md).

const REQ_ST: Record<string, [string, string]> = {
  TODO: ['안 보냄', 'st c-grey'], DOING: ['회신 대기', 'st c-blue'], DONE: ['회신 받음', 'st c-green'],
}
const NONE: [string, string] = ['협조 요청 없음', 'st c-grey']

const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`

/** 원문 위치: 파일 이름 + 절·표·행, 여러 곳이면 "외 n곳" */
function where(c: CostCondition | CommercialImpact, docs: RunDocument[]): string {
  const [first, ...rest] = c.locations
  return locName(first, docs) + (rest.length ? ` 외 ${rest.length}곳` : '')
}

export function CommTab({ run, tick, onGoJudge, onGoLoss }: {
  run: RunSummary; tick: number; onGoJudge: () => void; onGoLoss: () => void
}) {
  const id = run.run_id
  const data = useLoad(() => api.costConditions(id), [id, tick])
  const docs = useLoad(() => api.documents(id), [id])
  const [kind, setKind] = useState<string | null>(null)

  if (data.error) return <section className="sec" id="comm"><p role="alert">{data.error} <button type="button" className="lnk" onClick={data.reload}>다시 불러오기</button></p></section>
  if (!data.data) return <section className="sec" id="comm"><p className="dimv">불러오는 중…</p></section>

  const { conditions, impacts } = data.data
  const files = docs.data ?? []
  const kinds = [...new Map(conditions.map((c) => [c.kind, conditions.filter((x) => x.kind === c.kind).length])).entries()]
  const shown = kind ? conditions.filter((c) => c.kind === kind) : conditions
  const unsent = conditions.filter((c) => c.request_status === 'TODO').length

  return (
    <section className="sec" id="comm">
      <div className="sech">
        <h2>상업 조건<span className="note">비용 조건 {conditions.length} · 기술 판단 영향 {impacts.length}{unsent ? ` · 안 보낸 협조 요청 ${unsent}` : ''}</span></h2>
        {conditions.length > 0 && <a className="bo" href={href('/todo')}>
          <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>forward_to_inbox</span>협조 요청 현황</a>}
      </div>
      <p className="rdi">RFP에서 돈이 드는 조건과 기술 판단에서 생긴 상업 영향입니다. 모두 규칙으로 찾은 <b>후보</b>이고 금액은 계산하지 않습니다.
        받아들일지는 견적 담당이 정하고, 메일은 협조 요청 현황에서 보냅니다.</p>

      <h3 className="cmh">RFP의 비용 조건</h3>
      {conditions.length === 0
        ? <p className="dimv" style={{ margin: '8px 0' }}>찾은 비용 조건이 없습니다. 상업 조항이 요구사항으로 뽑히지 않은 문서일 수 있습니다.</p>
        : <>
          <div className="fbar" role="group" aria-label="조항 종류">
            <button type="button" className={'chip' + (kind === null ? ' on' : '')} aria-pressed={kind === null} onClick={() => setKind(null)}>전체 <span className="n">{conditions.length}</span></button>
            {kinds.map(([k, n]) => (
              <button key={k} type="button" className={'chip' + (kind === k ? ' on' : '')} aria-pressed={kind === k}
                onClick={() => setKind(k)}>{k} <span className="n">{n}</span></button>
            ))}
          </div>
          <table className="mini cmt"><tbody>
            {shown.map((c) => {
              const st = c.request_status ? REQ_ST[c.request_status] : NONE
              return (
                <tr key={c.requirement_id}>
                  <td style={{ width: 120 }}><b style={{ fontWeight: 600 }}>{c.kind}</b>
                    {c.risk && <div><span className="st c-ora" style={{ marginTop: 4 }}>{c.risk}</span></div>}
                    {c.burden && <div><span className="st c-blue" style={{ marginTop: 4 }}>{c.burden}</span></div>}</td>
                  <td>
                    {c.values.length > 0 && <div><span className="dimv">값</span> {c.values.join(' · ')}</div>}
                    <div className="en" style={{ marginTop: 2 }}>{c.text}</div>
                    <div className="dimv" style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}>
                      후보{c.primary_type_name && c.primary_type !== 'COST' ? ` · 주 유형 ${c.primary_type_name}` : ''}
                      {c.repeat_count > 1 ? ` · 같은 조건 ${c.repeat_count}곳` : ''}</div>
                  </td>
                  <td className="loc" style={{ width: 190 }}>{where(c, files)}</td>
                  <td style={{ width: 90 }}>견적 담당</td>
                  <td style={{ width: 110, textAlign: 'right' }}><span className={st[1]}>{st[0]}</span>
                    {c.mail_error && <div className="c-red" style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}>{c.mail_error === '주소 없음' ? '주소 없음' : '발송 실패'}</div>}</td>
                </tr>
              )
            })}
          </tbody></table>
        </>}

      <h3 className="cmh">기술 판단에서 생긴 상업 영향</h3>
      {impacts.length === 0
        ? <p className="dimv" style={{ margin: '8px 0' }}>손실 환산 결과와 일탈 후보가 없습니다.</p>
        : <table className="mini cmt"><tbody>
          {impacts.map((i) => (
            <tr key={`${i.kind}-${i.loss_calc_id ?? i.item_id}`}>
              <td style={{ width: 120 }}><b style={{ fontWeight: 600 }}>{i.kind === 'LOSS' ? '손실 환산 가산액' : '일탈 가격 영향'}</b></td>
              <td>
                {i.kind === 'LOSS'
                  ? <div>{i.product_code ?? '비교 제품 없음'} · 평가 가격에 {i.total_usd === null ? <span className="c-ora">확인 필요</span> : <b>{usd(i.total_usd)}</b>} 더해짐
                    {i.is_assumed && <span className="tag">팀 가정</span>}</div>
                  : <div>일탈을 받아들이거나 옵션으로 맞출 때 가격 영향 확인 <span className="en">— {i.text}</span>
                    {i.is_assumed && <span className="tag">팀 가정</span>}</div>}
                <button type="button" className="lnk" style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}
                  onClick={i.kind === 'LOSS' ? onGoLoss : onGoJudge}>{i.kind === 'LOSS' ? '손실 환산' : '판정'} →</button>
              </td>
              <td className="loc" style={{ width: 190 }}>{where(i, files)}</td>
              <td style={{ width: 90 }}>견적 담당</td>
              <td style={{ width: 110 }} />
            </tr>
          ))}
        </tbody></table>}
      <p className="cmfoot">견적 담당 협조 요청은 판정을 확정하면 메일로 나가고, <a href={href('/todo')}>협조 요청 현황</a>에서 보내기·회신을 확인할 수 있습니다.</p>
    </section>
  )
}
