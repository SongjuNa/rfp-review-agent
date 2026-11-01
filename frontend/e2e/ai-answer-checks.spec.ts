import { expect, test } from '@playwright/test'
import { ENGINEER, as, riskRun } from './helpers'

// 명세 review-workspace "버린 AI 설명 표시"의 Scenario (change update-ai-answer-checks).
// 로컬 e2e는 AI 키 없이 돌아 설명이 버려지지 않으므로, 응답에 버린 이유를 넣어 화면만 본다.

test('버린 설명 보기', async ({ page }) => {
  const run = await riskRun(page.request, `버린 설명 ${Date.now()}`)
  await page.route(`**/api/runs/${run.run_id}/risks`, async (route) => {
    const res = await route.fetch()
    const body = await res.json() as { explanation_ai: string | null; explanation_drop_reason: string | null }[]
    body[0].explanation_ai = null
    body[0].explanation_drop_reason = 'NUMBER_NOT_ALLOWED'
    await route.fulfill({ response: res, json: body })
  })
  await page.route('**/api/run-log', async (route) => {
    const res = await route.fetch()
    const body = await res.json() as { run_id: number; explanations_dropped: number }[]
    for (const r of body) if (r.run_id === run.run_id) r.explanations_dropped = 1
    await route.fulfill({ response: res, json: body })
  })
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByRole('tab', { name: '위험 조건' }).click()
  await expect(page.locator('#risk table.mini > tbody')).toContainText('AI 설명 버림 · 근거에 없는 숫자')
  await page.goto('/#/runlog')
  await expect(page.locator('tr', { hasText: run.review_no })).toContainText('AI 설명 버림 1')
})
