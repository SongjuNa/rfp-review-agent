import { expect, test } from '@playwright/test'
import { ENGINEER, as, deviationRun } from './helpers'

// 명세 review-workspace "지난 RFP 비교 예시 탭"의 Scenario (change update-review-screens).

test('지난 RFP 비교 거르기 예시', async ({ page, request }) => {
  const run = await deviationRun(request, `지난 비교 ${Date.now()}`)
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByRole('tab', { name: '지난 RFP 비교' }).click()
  const cmp = page.locator('#cmp')
  await expect(cmp.getByRole('note')).toContainText('예시 화면')
  const rows = cmp.locator('table.tbl tbody tr')
  await expect(rows).toHaveCount(14)
  await cmp.getByRole('button', { name: /새로 생김/ }).click()
  await expect(cmp.getByRole('button', { name: /새로 생김/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(rows).toHaveCount(5)
  await expect(rows.locator('td:first-child')).toHaveText(Array(5).fill('새로 생김'))
  await cmp.getByLabel('비교 대상').selectOption('RV-2026-008')
  await expect(cmp.getByRole('button', { name: /달라진 요구/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(rows).toHaveCount(11)
  await expect(cmp.locator('.cmph')).toContainText('BD-2026-004')
  await expect(cmp.locator('.cmfoot')).toHaveText('같은 요구 58줄은 판정이 지난번과 같아 숨겼습니다.')
})
