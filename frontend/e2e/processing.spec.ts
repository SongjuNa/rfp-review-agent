import { expect, test } from '@playwright/test'
import { ENGINEER, as, deviationRun } from './helpers'

// 명세 review-workspace "처리 상태 화면"의 Scenario (change update-review-screens).
// 합성 문서는 몇 초 만에 처리가 끝나므로, 실행 상태 응답 앞 몇 번을 "처리 중"으로 바꿔 보인다.

test('처리 중인 검토', async ({ page, request }) => {
  const run = await deviationRun(request, `처리 상태 ${Date.now()}`)
  let left = 2
  await page.route(`**/api/runs/${run.run_id}`, async (route) => {
    if (route.request().method() !== 'GET' || left <= 0) return route.continue()
    left -= 1
    const res = await route.fetch()
    const body = await res.json()
    await route.fulfill({ response: res, json: { ...body, stage: 'PROCESSING', step: 'risks', judgments: 0 } })
  })
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  const bar = page.getByRole('progressbar', { name: 'RFP 분석' })
  await expect(bar).toBeVisible()
  const pct = Number(await bar.getAttribute('aria-valuenow'))
  expect(pct).toBeGreaterThan(0)
  expect(pct).toBeLessThan(100)
  await expect(page.locator('.ldtx')).toContainText('위험 조건 찾는 중')
  await expect(page.locator('.ldtx')).toContainText('문서 1개')
  await expect(page.getByRole('tab', { name: '판정' })).toBeVisible({ timeout: 15_000 })
  await expect(bar).toHaveCount(0)
})
