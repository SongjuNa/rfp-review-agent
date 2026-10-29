import { useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react'
import { api, type DocumentChoice, type DocumentPreview, type RunSummary } from '../api'
import { DOC_KIND_NAMES } from '../components/labels'
import { useLoad } from '../components/useLoad'
import { usePageCss } from '../shell/pageCss'
import { href } from '../shell/router'
import { useSession } from '../shell/useSession'

// SCR-07 검토 등록 (목업 v4.57 Register). docs/screens/SCR-07-검토등록.md
// 목업의 자동 추출·Lot·제품 추천·결재선은 아직 없어 단계 2·3을 사람이 넣는 검토 정보로 바꿨다 (SCR-07_공유.md).
// 문서를 고르면 분석 전 분류 추천(규칙만)을 불러와 문서 종류·묶음을 사람이 확인·수정한다 (add-document-confirm).

type Info = { project_name: string; review_name: string; customer_name: string; country: string; due_date: string }
type Picked = { name: string; size: string | null; file: File | null }   // file이 없으면 서버에 둔 RFP

const STEPS: [string, string][] = [['문서 올리기', 'docx 여러 개'], ['검토 정보', '사업명 · 마감일'], ['검토 설정', '담당 엔지니어']]
const EMPTY: Info = { project_name: '', review_name: '', customer_name: '', country: '', due_date: '' }

function sizeText(bytes: number): string {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const isDocx = (name: string) => name.toLowerCase().endsWith('.docx')

type Kind = DocumentPreview['doc_kind']
type Bundle = DocumentPreview['bundle']
type Chosen = { doc_kind: Kind; bundle: Bundle }
const KINDS = Object.keys(DOC_KIND_NAMES) as Kind[]
const BUNDLES: Bundle[] = ['A', 'B', 'C', 'D']

/** 분류 추천 줄의 칸: 문서 종류·묶음 고르기, 언어, 판정 대상과 이유 */
function ClassifyCells({ p, chosen, onChange }: {
  p: DocumentPreview | 'loading' | 'error' | undefined; chosen: Chosen | undefined; onChange: (c: Chosen) => void
}) {
  if (p === undefined || p === 'loading') return <><td className="dimv" colSpan={3}>분류하는 중…</td><td /></>
  if (p === 'error') return <><td className="dimv" colSpan={3}>분석하면서 정합니다</td><td /></>
  const now = chosen ?? { doc_kind: p.doc_kind, bundle: p.bundle }
  const changed = now.doc_kind !== p.doc_kind || now.bundle !== p.bundle
  const judged = p.readable && (now.bundle === 'A' || now.bundle === 'B')
  return (
    <>
      <td><select className="fi" aria-label="문서 종류" value={now.doc_kind}
        onChange={(e) => onChange({ ...now, doc_kind: e.target.value as Kind })}>
        {KINDS.map((k) => <option key={k} value={k}>{DOC_KIND_NAMES[k]}</option>)}
      </select></td>
      <td><select className="fi" aria-label="묶음" value={now.bundle} style={{ width: 96 }}
        onChange={(e) => onChange({ ...now, bundle: e.target.value as Bundle })}>
        {BUNDLES.map((b) => <option key={b} value={b}>묶음 {b}</option>)}
      </select></td>
      <td>{p.language === 'ko' ? '한국어' : p.language === 'en' ? '영어' : p.language === 'image' ? '그림' : p.language}</td>
      <td>
        {judged ? <span className="st c-green">판정 대상</span> : <span className="st c-red">판정 안 함</span>}
        {changed && <> <span className="st c-blue">사람이 바꿈</span></>}
        <div className="en" style={{ margin: '4px 0 0' }}>{changed ? `추천: ${DOC_KIND_NAMES[p.doc_kind]} · 묶음 ${p.bundle}` : p.reason}</div>
      </td>
    </>
  )
}

function Field({ label, req, hint, children }: { label: string; req?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className="fld">
      <span className="k">{label}{req && <span className="auto req">필수</span>}</span>
      {children}
      {hint && <span className="src">{hint}</span>}
    </label>
  )
}

export function Register() {
  usePageCss('Register')
  const { user, users } = useSession()
  const library = useLoad(() => api.library(), [])
  const [step, setStep] = useState(1)
  const [picked, setPicked] = useState<Picked[]>([])
  const [showLibrary, setShowLibrary] = useState(false)
  const [info, setInfo] = useState<Info>(EMPTY)
  const [engineer, setEngineer] = useState<number | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<RunSummary | null>(null)
  const [previews, setPreviews] = useState<Record<string, DocumentPreview | 'loading' | 'error'>>({})
  const [chosen, setChosen] = useState<Record<string, Chosen>>({})
  const engineers = users.filter((u) => u.role === 'ENGINEER')
  const owner = engineer !== '' ? engineer : user?.role === 'ENGINEER' ? user.user_id : (engineers[0]?.user_id ?? '')
  const ok = picked.filter((p) => isDocx(p.name))
  const fromServer = picked.some((p) => p.file === null)

  // 아직 추천이 없는 docx만 한 번에 불러온다 (규칙만 써서 몇 초)
  const loadPreviews = (items: Picked[]) => {
    const todo = items.filter((p) => isDocx(p.name) && previews[p.name] === undefined)
    if (!todo.length) return
    const mark = (v: 'loading' | 'error') => Object.fromEntries(todo.map((p) => [p.name, v]))
    setPreviews((prev) => ({ ...prev, ...mark('loading') }))
    const call = todo[0].file === null ? api.previewLibrary(todo.map((p) => p.name)) : api.previewUpload(todo.map((p) => p.file!))
    call.then((rows) => setPreviews((prev) => ({ ...prev, ...Object.fromEntries(rows.map((r) => [r.file_name, r])) })),
      () => setPreviews((prev) => ({ ...prev, ...mark('error') })))
  }
  const addFiles = (list: FileList | null) => {
    if (!list) return
    const files = Array.from(list).map((f) => ({ name: f.name, size: sizeText(f.size), file: f }))
    // 올린 파일과 서버 파일은 한 번에 시작할 수 없어 섞지 않는다
    const added = files.filter((f) => !picked.some((p) => p.name === f.name))
    setPicked([...picked.filter((p) => p.file !== null), ...added])
    loadPreviews(added)
  }
  const toggleServer = (name: string) => {
    const has = picked.some((p) => p.name === name && p.file === null)
    setPicked(has ? picked.filter((p) => p.name !== name)
      : [...picked.filter((p) => p.file === null), { name, size: null, file: null }])
    if (!has) loadPreviews([{ name, size: null, file: null }])
  }
  const onDrop = (e: DragEvent) => { e.preventDefault(); addFiles(e.dataTransfer.files) }


  let msg = ''
  let msgCls = 'msg'
  let nextDis = false
  if (step === 1) {
    if (!ok.length) { msg = 'docx 문서를 하나 이상 올려 주세요.'; msgCls = 'msg ok'; nextDis = true }
    else if (picked.length > ok.length) msg = 'docx가 아닌 파일은 빼고 진행합니다.'
  }
  if (step === 2 && !info.due_date) { msg = '제출 마감일을 입력해 주세요.'; nextDis = true }
  if (error) msg = error

  const submit = () => {
    setBusy(true)
    setError(null)
    const start = { ...info, engineer_id: typeof owner === 'number' ? owner : null, actor_id: user?.user_id ?? null }
    // 보이는 분류를 모두 보낸다. 규칙 추천과 같은 값은 서버가 규칙 결과로 둔다.
    const choices: Record<string, DocumentChoice> = {}
    ok.forEach((p) => {
      const pv = previews[p.name]
      if (typeof pv === 'object') choices[p.name] = chosen[p.name] ?? { doc_kind: pv.doc_kind, bundle: pv.bundle }
    })
    const call = fromServer ? api.startLibrary(ok.map((p) => p.name), start, choices) : api.upload(ok.map((p) => p.file!), start, choices)
    call.then(setDone, (e: Error) => setError(e.message)).finally(() => setBusy(false))
  }

  if (done) {
    return (
      <main className="main">
        <div className="ttl"><h1>검토 등록</h1></div>
        <div className="card2 done2" role="status">
          <div className="ic"><span className="ms" aria-hidden="true">check</span></div>
          <h2>{done.review_no} 등록했습니다</h2>
          <p>문서 {ok.length}개 · 제출 마감 {info.due_date}. 요구사항 추출을 시작했습니다. 끝나면 홈의 내 할 일에 나타납니다.</p>
          <div className="acts"><a className="bo" href={href('/reviews')}>검토 목록으로</a><a className="bp" href={href('/')}>홈으로</a></div>
        </div>
      </main>
    )
  }

  const set = (k: keyof Info) => (e: ChangeEvent<HTMLInputElement>) => setInfo({ ...info, [k]: e.target.value })
  return (
    <main className="main">
      <div className="ttl"><h1>검토 등록</h1></div>
      <nav className="steps" aria-label="등록 단계">
        {STEPS.map(([label, sub], i) => {
          const n = i + 1
          const isDone = n < step
          return (
            <button key={n} type="button" className={n === step ? 'cur' : isDone ? 'done' : ''} disabled={n > step}
              aria-current={n === step ? 'step' : undefined} onClick={() => { if (n < step) setStep(n) }}>
              <span className="sn">{isDone ? '✓' : n}</span><span className="sl"><b>{label}</b><span>{sub}</span></span>
            </button>
          )
        })}
      </nav>

      {step === 1 && (
        <div className="card2">
          <h2>RFP 문서</h2>
          <p className="sub2">입찰 안내서, 기술 명세서, 가격표를 함께 올리면 정보를 더 많이 채울 수 있습니다.</p>
          <label className="drop2" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
            <span className="ms" aria-hidden="true">upload_file</span><b>docx 파일을 끌어다 놓거나 눌러서 고르기</b>
            <span>여러 개 가능 · 스캔한 문서의 글자는 읽지 않음</span>
            <input type="file" multiple accept=".docx" aria-label="docx 올리기"
              onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
          </label>
          {(library.data?.length ?? 0) > 0 && (
            <div className="alt">또는 <button type="button" className="lnk2" aria-expanded={showLibrary}
              onClick={() => setShowLibrary(!showLibrary)}>서버에 둔 RFP에서 고르기</button></div>
          )}
          {showLibrary && (
            <div className="tw ftab">
              <table className="tbl" aria-label="서버에 둔 RFP">
                <thead><tr><th style={{ width: 40 }} /><th>서버에 둔 RFP</th></tr></thead>
                <tbody>
                  {library.data!.map((name) => (
                    <tr key={name}>
                      <td><input type="checkbox" aria-label={name} checked={picked.some((p) => p.name === name && p.file === null)}
                        onChange={() => toggleServer(name)} /></td>
                      <td>{name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {picked.length > 0 && (
            <div className="tw ftab">
              <table className="tbl">
                <thead><tr><th>파일</th><th>문서 종류</th><th>묶음</th><th>언어</th><th>판정</th><th>상태</th><th /></tr></thead>
                <tbody>
                  {picked.map((p) => {
                    const bad = !isDocx(p.name)
                    return (
                      <tr key={p.name} className={bad ? 'bad2' : ''}>
                        <td style={{ fontWeight: 600 }}>{p.name}<div className="en" style={{ margin: 0 }}>{p.size ?? '서버에 둔 파일'}</div></td>
                        {bad ? <><td className="dimv" colSpan={3}>—</td><td /></>
                          : <ClassifyCells p={previews[p.name]} chosen={chosen[p.name]}
                            onChange={(c) => setChosen({ ...chosen, [p.name]: c })} />}
                        <td>{bad ? <span className="st c-red">docx 아님</span> : <span className="st c-green">올릴 준비</span>}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button type="button" className="ib" aria-label={`${p.name} 빼기`} title="빼기"
                            onClick={() => setPicked(picked.filter((x) => x !== p))}><span className="ms" aria-hidden="true">close</span></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="card2">
          <h2>검토 정보</h2>
          <p className="sub2">검토 목록과 결재 화면에 보일 정보입니다. 문서에서 자동으로 채우지 않으니 직접 넣어 주세요.</p>
          <div className="fg">
            <Field label="사업명" hint={`검토명은 "${info.project_name || '사업명'} · 설비 범위"로 보입니다`}>
              <input className="fi" value={info.project_name} onChange={set('project_name')} maxLength={200} placeholder="예: Thai Binh" />
            </Field>
            <Field label="설비 범위">
              <input className="fi" value={info.review_name} onChange={set('review_name')} maxLength={200}
                placeholder="예: 115·230 kV GIS 변전소 신설" />
            </Field>
            <Field label="고객사"><input className="fi" value={info.customer_name} onChange={set('customer_name')} maxLength={200} /></Field>
            <Field label="국가"><input className="fi" value={info.country} onChange={set('country')} maxLength={60} /></Field>
            <Field label="제출 마감일" req>
              <input className={'fi' + (info.due_date ? '' : ' bad')} type="date" value={info.due_date} onChange={set('due_date')} />
            </Field>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card2">
          <h2>{[info.project_name, info.review_name].filter(Boolean).join(' · ') || ok[0]?.name}</h2>
          <p className="sub2">문서 {ok.length}개 · 제출 마감 {info.due_date}</p>
          <Field label="담당 엔지니어">
            <select className="fi" style={{ maxWidth: 360 }} value={owner} onChange={(e) => setEngineer(Number(e.target.value))}>
              {engineers.map((u) => <option key={u.user_id} value={u.user_id}>{u.user_name}</option>)}
            </select>
          </Field>
        </div>
      )}

      <div className="foot2">
        <span className={msgCls} role={error ? 'alert' : undefined}>{msg}</span>
        {step > 1 && <button type="button" className="bo" onClick={() => setStep(step - 1)}>이전</button>}
        {step < 3 && (
          <button type="button" className="bp" disabled={nextDis} onClick={() => setStep(step + 1)}>
            다음<span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>arrow_forward</span></button>
        )}
        {step === 3 && (
          <button type="button" className="bp" disabled={busy} onClick={submit}>
            <span className="ms" aria-hidden="true" style={{ fontSize: 'var(--ic-s)' }}>play_arrow</span>{busy ? '등록하는 중…' : '등록하고 분석 시작'}</button>
        )}
      </div>
    </main>
  )
}
