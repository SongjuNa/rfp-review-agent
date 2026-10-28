import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

// 명세 review-workspace "판단 동작"·"내 할 일 화면"의 Scenario (change update-approval-flow).
// 합성 데이터시트(e2e/fixtures/synthetic_judgment.docx, 백엔드 tests/docx_factory.py로 만듦, 고객 원문 아님)로
// 실행을 만들고, 판정 하나를 일탈 후보로 고쳐 AR-01이 걸리게 한다.
// 판정하려면 문서 목록에 묶음 A로 있어야 한다. 로컬 DB에 한 번 넣는다:
//   INSERT INTO document_catalog (file_no, file_key, bundle, language) VALUES (91, 'synthetic_judgment', 'A', 'en');
const DOCX = new URL('./fixtures/synthetic_judgment.docx', import.meta.url)
const ENGINEER = 1
const APPROVER = 2
const COMMENT = '질의 1건은 10-27 회신 예정'

async function deviationRun(request: APIRequestContext, name: string) {
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

async function as(page: Page, userId: number) {
  await page.addInitScript((id) => localStorage.setItem('s2w.user', String(id)), userId)
}

test('결재 상신 창', async ({ page, request }) => {
  const run = await deviationRun(request, `결재 상신 창 ${Date.now()}`)
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByRole('button', { name: '결재 상신' }).click()
  const dialog = page.getByRole('dialog', { name: '결재 상신' })
  await expect(dialog.locator('.apck li').first()).toContainText('일탈 후보 1건')      // 지금 걸리는 AR-01
  await expect(dialog.getByLabel('결재자')).toHaveValue(String(APPROVER))               // 승인자가 1명이면 미리 고름
  const send = dialog.getByRole('button', { name: '결재 상신' })
  await expect(send).toBeDisabled()                                                      // 의견 전에는 눌리지 않는다
  await dialog.getByLabel('상신 의견').fill(COMMENT)
  await expect(send).toBeEnabled()
  await send.click()
  await expect(page.getByText('기본 승인자의 결재를 기다리고 있습니다')).toBeVisible()
  await expect(page.locator('.wop')).toContainText(COMMENT)
  // 결정 전 상신 취소 → 검토 화면으로 돌아간다
  await page.getByRole('button', { name: '상신 취소' }).click()
  await expect(page.locator('.ftoast')).toContainText('상신을 취소했습니다.')
  await expect(page.locator('.ftl')).toContainText('상신 취소')
  await page.getByRole('link', { name: '검토 화면으로' }).click()
  await expect(page.getByRole('button', { name: '결재 상신' })).toBeEnabled()
})

test('승인 화면', async ({ page, request }) => {
  const run = await deviationRun(request, `승인 화면 ${Date.now()}`)
  const sent = await request.post(`/api/runs/${run.run_id}/finish-review`,
    { data: { approver_id: APPROVER, comment: COMMENT, actor_id: ENGINEER } })
  expect(sent.status()).toBe(200)
  await as(page, APPROVER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await expect(page.getByText('결재할 검토입니다')).toBeVisible()
  await expect(page.locator('.wop')).toContainText(COMMENT)                              // 상신 의견
  const checks = page.locator('.wck')
  await expect(checks).toContainText('일탈 후보 1건')                                     // 걸린 기준, 일탈 후보 수
  await expect(checks).toContainText(/일탈 목록에 \d+건/)                                  // 목록에 들어간 수
  await expect(checks).toContainText(/목록에 (빠진 일탈 없음|없는 일탈 \d+건)/)              // 빠진 일탈
  const reject = page.getByRole('button', { name: '반려' })
  await expect(reject).toBeDisabled()                                                    // 반려에는 의견이 필요하다
  await page.getByLabel('결재 의견').fill('일탈 사유를 보완할 것')
  await reject.click()
  await expect(page.locator('main .idl').first()).toContainText('반려됨')
})

test('엔지니어·승인자의 내 할 일', async ({ page, request }) => {
  const name = `내 할 일 결재 ${Date.now()}`
  const run = await deviationRun(request, name)
  await request.post(`/api/runs/${run.run_id}/finish-review`,
    { data: { approver_id: APPROVER, comment: COMMENT, actor_id: ENGINEER } })
  const mine = await (await request.get(`/api/tasks?user_id=${APPROVER}`)).json()
  const card = mine.reviews.find((c: { run_id: number }) => c.run_id === run.run_id)
  expect(card.criteria.map((c: { ar_code: string }) => c.ar_code)).toContain('AR-01')
  expect(card.approval.request_comment).toBe(COMMENT)
  await as(page, APPROVER)
  await page.goto('/#/todo')
  const shown = page.locator('.card', { hasText: `검토 #${run.run_id}` })
  await expect(shown).toContainText('AR-01')
  await shown.getByRole('button', { name: '승인하러 가기' }).click()
  await expect(page.getByText('결재할 검토입니다')).toBeVisible()
})
