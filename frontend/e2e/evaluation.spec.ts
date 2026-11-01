import { expect, test } from '@playwright/test'
import { ENGINEER, as, deviationRun } from './helpers'

// 명세 review-workspace "정답지·채점 화면"의 Scenario (change add-evaluation).
// 합성 데이터시트로 검토를 만들고 판정 하나를 고친다(사람이 본 판정 줄). 지표 계산은 백엔드 tests/test_evaluation.py에서 본다.

test('지금 채점하기', async ({ page, request }) => {
  const run = await deviationRun(request, `채점 ${Date.now()}`)
  await as(page, ENGINEER)
  await page.goto('/#/eval')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('정답지·채점')
  await expect(page.getByText('예시 화면 · 실제 데이터와 연결되지 않음')).toHaveCount(0)
  await page.getByRole('tab', { name: '정답지' }).click()
  await expect(page.locator('label.gt-tr', { hasText: run.review_no })).toBeVisible()
  await page.getByLabel('유형 정답지 없이').check()
  const memo = `e2e 채점 ${Date.now()}`
  await page.getByLabel('무엇을 고쳤나').fill(memo)
  await page.getByRole('button', { name: '지금 채점하기' }).click()
  await expect(page.getByRole('status')).toContainText('채점을 마쳤습니다')
  await expect(page.getByRole('tab', { name: '채점 결과' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-code="K5"]')).toContainText('%')
  await expect(page.locator('[data-code="TIME"]')).toContainText('분')
  await page.getByRole('tab', { name: '개선 기록' }).click()
  await expect(page.locator('.lg-tr.ev-row').first()).toContainText(memo)
})

test('Claude 초안 표시', async ({ page }) => {
  await page.route('**/api/eval/keys', (route) => route.fulfill({ json: [{
    key_id: 1, key_name: '유형 정답지 100줄', key_kind: 'TYPE', made_by: 'CLAUDE_DRAFT',
    created_at: '2026-11-01T03:00:00Z', rows: 100, human_checked: 12, ambiguous: 9,
  }] }))
  await as(page, ENGINEER)
  await page.goto('/#/eval')
  await page.getByRole('tab', { name: '정답지' }).click()
  const row = page.locator('label.gt-tr', { hasText: '유형 정답지 100줄' })
  await expect(row).toContainText('Claude 초안 · 사람 확인 전')
  await expect(row).toContainText('12 / 100')
})
