import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

// e2e 공용: 합성 데이터시트(e2e/fixtures/synthetic_judgment.docx, 백엔드 tests/docx_factory.py로 만듦, 고객 원문 아님)로
// 실행을 만들고, 판정 하나를 일탈 후보로 고쳐 AR-01이 걸리게 한다.
// 판정하려면 문서 목록에 묶음 A로 있어야 한다. 로컬 DB에 한 번 넣는다:
//   INSERT INTO document_catalog (file_no, file_key, bundle, language) VALUES (91, 'synthetic_judgment', 'A', 'en');
const DOCX = new URL('./fixtures/synthetic_judgment.docx', import.meta.url)
export const ENGINEER = 1
export const APPROVER = 2
export const COMMENT = '질의 1건은 10-27 회신 예정'

export async function deviationRun(request: APIRequestContext, name: string) {
  const res = await request.post('/api/runs', {
    multipart: {
      files: { name: 'synthetic_judgment.docx', mimeType: 'application/octet-stream', buffer: readFileSync(DOCX) },
      review_name: name, actor_id: String(ENGINEER),
    },
  })
  const run = await res.json() as { run_id: number; review_no: string }
  await expect.poll(async () => (await (await request.get(`/api/runs/${run.run_id}`)).json()).stage,
    { timeout: 60_000 }).toBe('ENGINEER_REVIEW')
  const [j] = await (await request.get(`/api/runs/${run.run_id}/judgments?limit=1`)).json()
  test.skip(!j, '합성 데이터시트가 문서 목록(묶음 A)에 없어 판정이 없습니다')
  const edit = await request.post(`/api/runs/${run.run_id}/actions`, {
    data: { target: 'judgment', target_id: j.judgment_id, action: 'EDIT', value: { result: 'DEVIATION_CANDIDATE' },
      reason: '시험용 일탈', actor_id: ENGINEER },
  })
  expect(edit.status()).toBe(200)
  return run
}

export async function as(page: Page, userId: number) {
  await page.addInitScript((id) => localStorage.setItem('s2w.user', String(id)), userId)
}

