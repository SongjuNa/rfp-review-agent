import { useEffect } from 'react'
import type { RunDocument, RunSummary } from '../api'
import { reviewTitle } from '../components/format'
import { CLASSIFY_BY, skipReason } from '../components/documents'
import { DOC_KIND_NAMES } from '../components/labels'
import './detail.css'

// 검토 머리글 "문서 n개"를 누르면 열리는 문서 표 창 (SCR-08, change update-document-info).
// 문서마다 종류·분류 방법·묶음·판정 대상·요구사항 수·확인 필요를 보인다. 묶음은 여기서 고치지 않는다.

export function DocumentsDialog({ run, docs, onClose }: { run: RunSummary; docs: RunDocument[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const judged = docs.filter((d) => d.judge_target).length
  const review = docs.filter((d) => d.needs_review).length
  return (
    <div className="mdo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="apw docw" role="dialog" aria-modal="true" aria-labelledby="docsTitle">
        <div className="mdh">
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div className="apid">{run.review_no} · {reviewTitle(run)}</div>
            <h2 id="docsTitle" style={{ margin: '2px 0 0', fontSize: 'var(--fs-h3)' }}>문서 {docs.length}개</h2>
          </div>
          <button type="button" className="ib" onClick={onClose} aria-label="닫기" title="닫기 (Esc)"><span className="ms" aria-hidden="true">close</span></button>
        </div>
        <div className="apb">
          <p className="docsum">판정 대상 <b>{judged}개</b> · 판정 안 함 <b className={judged < docs.length ? 'c-red' : ''}>{docs.length - judged}개</b>
            {review > 0 && <> · 확인 필요 <b className="c-ora">{review}개</b></>}</p>
          <div className="tw"><table className="tbl doct">
            <thead><tr><th>파일</th><th>파일 이름</th><th>문서 종류</th><th>분류 방법</th><th>묶음</th><th>판정</th><th>요구사항</th></tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.document_id} className={d.judge_target ? '' : 'skip'}>
                  <td>{d.file_no}</td>
                  <td className="docn">{d.file_name}</td>
                  <td>{DOC_KIND_NAMES[d.doc_kind] ?? d.doc_kind}
                    {d.needs_review && <> <span className="st c-ora">확인 필요</span></>}</td>
                  <td>{CLASSIFY_BY[d.classify_by ?? ''] ?? '—'}</td>
                  <td>묶음 {d.bundle}</td>
                  <td>{d.judge_target
                    ? <span className="st c-green">판정 대상</span>
                    : <><span className="st c-red">판정 안 함</span><div className="docwhy">{skipReason(d)}</div></>}</td>
                  <td>{d.requirements.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="aphint" style={{ color: '#667085' }}>판정은 묶음 A·B 문서만 합니다(CR-09). 문서 종류·묶음은 이 창에서 고칠 수 없습니다.</p>
        </div>
        <div className="mdf">
          <button type="button" className="bo" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
