import { expect, test } from '@playwright/test'
import { ENGINEER, as, deviationRun } from './helpers'

// 명세 review-workspace "판정 탭 한꺼번에 확정"의 Scenario (change add-bulk-confirm).

test('고른 줄 확정', async ({ page, request }) => {
  const run = await deviationRun(request, `고른 줄 확정 ${Date.now()}`)
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  const rows = page.locator('#judge tbody tr')
  const unconfirmed = rows.filter({ hasNot: page.locator('.cfm') })
  await expect(unconfirmed.first()).toBeVisible()
  const before = await rows.locator('.cfm').count()
  await unconfirmed.nth(0).getByRole('checkbox').check()
  await unconfirmed.nth(1).getByRole('checkbox').check()
  const bar = page.locator('#judge .bulk').filter({ hasText: '2줄 선택' })
  await expect(bar).toBeVisible()
  await bar.getByRole('button', { name: '제안대로 확정' }).click()
  await expect(page.getByRole('status').filter({ hasText: '판정 2줄을 제안대로 확정했습니다.' })).toBeVisible()
  await expect(rows.locator('.cfm')).toHaveCount(before + 2)
  await expect(page.locator('#judge .bulk').filter({ hasText: '줄 선택' })).toHaveCount(0)
})

test('준수 모두 확정', async ({ page, request }) => {
  const run = await deviationRun(request, `준수 모두 확정 ${Date.now()}`)
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  const quick = page.getByRole('button', { name: /준수 \d+줄 모두 확정/ })
  await expect(quick).toBeVisible()
  await quick.click()
  await expect(page.getByRole('status').filter({ hasText: /판정 \d+줄을 제안대로 확정했습니다/ })).toBeVisible()
  await expect(quick).toHaveCount(0)
  const left = await (await request.get(`/api/runs/${run.run_id}/judgments?result=COMPLY&unconfirmed=true&limit=1`)).json()
  expect(left).toEqual([])
})
