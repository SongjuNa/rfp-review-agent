import { expect, test, type Route } from '@playwright/test'

// 명세 review-workspace "검토 등록 문서 분류 확인"의 Scenario (change add-document-confirm).
// 합성 데이터시트(e2e/fixtures/synthetic_judgment.docx)는 로컬 DB 문서 목록에 묶음 A로 있다 (helpers.ts).
const DOCX = new URL('./fixtures/synthetic_judgment.docx', import.meta.url)
const isoAfter = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

test('올린 문서의 분류 추천 보기', async ({ page }) => {
  await page.goto('/#/register')
  await page.getByLabel('docx 올리기').setInputFiles(DOCX.pathname)
  const row = page.locator('tr', { hasText: 'synthetic_judgment.docx' })
  await expect(row.getByLabel('묶음')).toHaveValue('A', { timeout: 10_000 })
  await expect(row.getByLabel('문서 종류')).toBeVisible()
  await expect(row).toContainText('영어')
  await expect(row).toContainText('판정 대상')
  await expect(row).toContainText('문서 목록의 묶음 A')
})

test('묶음을 바꿔 시작', async ({ page }) => {
  // 목록에 없는 문서처럼 묶음 C로 추천받게 한다
  await page.route('**/api/runs/preview', (r: Route) => r.fulfill({ json: [{
    file_name: 'synthetic_judgment.docx', in_catalog: false, file_no: null, doc_kind: 'UNKNOWN', bundle: 'C',
    language: 'en', standard_system: null, readable: true, judge_target: false, needs_review: true,
    reason: '문서 목록에 없음 · 주 규격 체계 모름이라 판정하지 않음',
  }] }))
  await page.goto('/#/register')
  await page.getByLabel('docx 올리기').setInputFiles(DOCX.pathname)
  const row = page.locator('tr', { hasText: 'synthetic_judgment.docx' })
  await expect(row.getByLabel('묶음')).toHaveValue('C')
  await expect(row).toContainText('판정 안 함')
  await row.getByLabel('묶음').selectOption('B')
  await expect(row).toContainText('사람이 바꿈')
  await expect(row).toContainText('판정 대상')
  await page.getByRole('button', { name: /다음/ }).click()
  await page.getByLabel('제출 마감일').fill(isoAfter(10))
  await page.getByRole('button', { name: /다음/ }).click()
  const sent = page.waitForRequest((r) => r.url().endsWith('/api/runs') && r.method() === 'POST')
  await page.getByRole('button', { name: /등록하고 분석 시작/ }).click()
  const body = (await sent).postData() ?? ''
  expect(body).toContain('name="choices"')
  expect(body).toContain('"synthetic_judgment.docx":{"doc_kind"')
  expect(body).toContain('"bundle":"B"')
  await expect(page.getByRole('status')).toContainText(/RV-\d{4}-\d{3} 등록했습니다/)
})
