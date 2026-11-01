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

test('요구사항 정답지로 채점', async ({ page }) => {
  // 명세 review-workspace "요구사항 정답지 고르기 화면" (add-requirement-answer-key). 지표 계산은 백엔드 테스트에서 본다.
  const now = '2026-11-01T03:00:00Z'
  await page.route('**/api/eval/keys', (route) => route.fulfill({ json: [{
    key_id: 7, key_name: '공급사 답안 262000', key_kind: 'REQ', made_by: 'AUTO', doc_name: '262000 Electric Distribution',
    created_at: now, rows: 200, human_checked: 0, ambiguous: 0,
  }] }))
  await page.route('**/api/eval/runs', (route) => route.fulfill({ json: [{
    run_id: 41, review_no: 'RV-2026-041', review_name: '배전 공급사 답안', stage: 'ENGINEER_REVIEW', reviewed: 0, reviewer: null, last_reviewed_at: null,
  }] }))
  let sent: Record<string, unknown> = {}
  const k1 = { code: 'K1', name: '요구사항 추출 재현율', measure: '정답 요구사항 줄 중 시스템이 찾은 비율', unit: '%', value: 66.5, num: 133, den: 200, target: 85, better: 'up', passed: false, note: '대상 문서 1개' }
  const score = { score_id: 1, run_ids: [41], key_id: null, key_name: null, key_made_by: null, req_key_id: 7, req_key_name: '공급사 답안 262000', req_key_made_by: 'AUTO',
    metrics: { items: [k1], types: null, requirements: null, not_measured: [] }, note: null, code_version: null, scored_by: 1, scored_by_name: '엔지니어', scored_at: now }
  await page.route('**/api/eval/scores', (route) => {
    if (route.request().method() === 'POST') {
      sent = route.request().postDataJSON()
      return route.fulfill({ json: score })
    }
    return route.fulfill({ json: Object.keys(sent).length ? [score] : [] })
  })
  await as(page, ENGINEER)
  await page.goto('/#/eval')
  await page.getByRole('tab', { name: '정답지' }).click()
  const run = page.locator('label.gt-tr', { hasText: 'RV-2026-041' })
  await expect(run).toContainText('요구사항 정답지용')
  await expect(run.locator('input')).not.toBeChecked()
  await run.locator('input').check()
  const key = page.locator('label[data-key="공급사 답안 262000"]')
  await expect(key).toContainText('코드 자동 · 사람 확인 전')
  await expect(key).toContainText('262000 Electric Distribution')
  await key.locator('input').check()
  await page.getByRole('button', { name: '지금 채점하기' }).click()
  await expect(page.getByRole('status')).toContainText('요구사항 정답지 "공급사 답안 262000"')
  expect(sent).toMatchObject({ run_ids: [41], req_key_id: 7 })
  await expect(page.locator('[data-code="K1"]')).toContainText('66.5 %')
})
