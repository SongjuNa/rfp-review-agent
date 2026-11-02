import { expect, test, type Page } from '@playwright/test'
import { as, ENGINEER, lossRun, openTab, riskRun } from './helpers'

// 명세 review-workspace "손실 환산 탭"의 Scenario (change update-review-screens).

async function openLoss(page: Page, runId: number) {
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${runId}`)
  await openTab(page, '손실 환산 (참고)')
  return page.locator('#loss table.mini tbody tr')
}

test('손실 환산 표', async ({ page }) => {
  const run = await lossRun(page.request, `손실 표 ${Date.now()}`)
  const rows = await openLoss(page, run.run_id)
  test.skip(await page.getByText('손실 환산 조항이 없어').isVisible(), '합성 데이터시트가 문서 목록(묶음 A)에 없습니다')
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(0)).toContainText('무부하 손실4,500 $/kW ×')
  await expect(rows.nth(1)).toContainText('부하 손실3,200 $/kW ×')
  await expect(rows.nth(2)).toContainText('보조 손실1,300 $/kW ×')
  await expect(page.getByLabel('무부하 손실 손실값 (kW)', { exact: true })).toHaveValue('')
  await expect(rows.nth(0)).toContainText('입력 필요')
  await expect(rows.nth(3)).toHaveText(/가산액\s*—/)
  await expect(page.locator('#loss .sech .note')).toContainText(/단가 \d+~\d+행/)
})

// Scenario: 손실 환산 결과
test('손실값 넣어 다시 계산', async ({ page }) => {
  const run = await lossRun(page.request, `손실 계산 ${Date.now()}`)
  const rows = await openLoss(page, run.run_id)
  test.skip(await page.getByText('손실 환산 조항이 없어').isVisible(), '합성 데이터시트가 문서 목록(묶음 A)에 없습니다')
  await page.getByLabel('무부하 손실 손실값 (kW)', { exact: true }).fill('60')
  await page.getByLabel('부하 손실 손실값 (kW)', { exact: true }).fill('300')
  await page.getByLabel('보조 손실 손실값 (kW)', { exact: true }).fill('8')
  await page.getByLabel('보조 손실 손실값 (kW)', { exact: true }).press('Enter')
  await expect(rows.nth(0)).toContainText('$270,000')
  await expect(rows.nth(1)).toContainText('$960,000')
  await expect(rows.nth(2)).toContainText('$10,400')
  await expect(rows.nth(3)).toContainText('$1,240,400')
  await expect(page.locator('#loss')).toContainText('팀 가정')
  await expect(page.locator('.hf-k')).toContainText('$1,240,400')
})

test('조항 없는 RFP', async ({ page }) => {
  const run = await riskRun(page.request, `조항 없음 ${Date.now()}`)
  await openLoss(page, run.run_id)
  await expect(page.getByText('이 RFP에는 손실 환산 조항이 없어 계산하지 않았습니다.', { exact: false })).toBeVisible()
  await expect(page.locator('#loss table.mini')).toHaveCount(0)
})

test('견적 협조 요청 단추는 입찰 영향 탭으로 옮긴다', async ({ page }) => {
  const run = await riskRun(page.request, `협조 요청 링크 ${Date.now()}`)
  await openLoss(page, run.run_id)
  await page.getByRole('button', { name: '견적 담당에 협조 요청' }).click()
  await expect(page.getByRole('tab', { name: '입찰 영향' })).toHaveAttribute('aria-selected', 'true')
})
