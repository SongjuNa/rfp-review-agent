/** 불러오기 실패 문장 (목업 오류 빨강) */
export function ErrorText({ error }: { error: string | null }) {
  return error ? <p role="alert" style={{ color: '#B42318' }}>{error}</p> : null
}
