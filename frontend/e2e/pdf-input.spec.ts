import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// 명세 review-workspace "PDF 올리기"의 Scenario (change add-pdf-input).
// e2e/fixtures/synthetic_judgment.pdf는 synthetic_judgment.docx와 같은 데이터시트를 PDF로 만든 것 (문서 목록 묶음 A).
const PDF = new URL('./fixtures/synthetic_judgment.pdf', import.meta.url)
const isoAfter = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

test('PDF로 검토 등록', async ({ page, request }) => {
  await page.goto('/#/register')
  await page.getByLabel('docx 올리기').setInputFiles(fileURLToPath(PDF))
  const row = page.locator('tr', { hasText: 'synthetic_judgment.pdf' })
  await expect(row.getByLabel('묶음')).toHaveValue('A', { timeout: 10_000 })    // 분류 추천에 PDF가 보임
  await expect(row).toContainText('판정 대상')
  await page.getByRole('button', { name: /다음/ }).click()
  await page.getByLabel('설비 범위', { exact: true }).fill(`PDF 등록 ${Date.now()}`)
  await page.getByLabel('제출 마감일').fill(isoAfter(10))
  await page.getByRole('button', { name: /다음/ }).click()
  await page.getByRole('button', { name: /등록하고 분석 시작/ }).click()
  const reviewNo = (await page.getByRole('status').textContent())!.match(/RV-\d{4}-\d{3}/)![0]
  const runs = await (await request.get('/api/runs?limit=50')).json() as { run_id: number; review_no: string }[]
  const run = runs.find((r) => r.review_no === reviewNo)!
  await expect.poll(async () => (await (await request.get(`/api/runs/${run.run_id}`)).json()).stage,
    { timeout: 60_000 }).toBe('ENGINEER_REVIEW')
  const summary = await (await request.get(`/api/runs/${run.run_id}`)).json() as { judgments: number }
  expect(summary.judgments).toBeGreaterThan(0)                                       // PDF 표로 판정까지
})
