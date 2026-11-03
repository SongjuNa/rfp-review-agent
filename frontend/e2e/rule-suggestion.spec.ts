import { expect, test } from '@playwright/test'
import { ENGINEER, as, riskRun } from './helpers'

// 명세 review-workspace "사전 추가 제안 화면"의 Scenario (change add-rule-suggestion).
// 합성 사양서(tests/docx_factory.build_gis_spec)에 있지만 위험 표현 사전에는 없는 표현을 쓴다.
// 반영하면 공용 DB 사전에 들어가므로, 끝나면 그 규칙을 지워 다음 실행에서도 다시 제안할 수 있게 한다.
const PHRASE = "corresponding to the Employer's Requirement"

async function dropRule(request: import('@playwright/test').APIRequestContext) {
  const rules = await (await request.get('/api/rules/risk-expressions')).json() as { expr_id: number; expression: string }[]
  for (const r of rules.filter((x) => x.expression.toLowerCase() === PHRASE.toLowerCase())) {
    await request.delete(`/api/rules/risk-expressions/${r.expr_id}`, { data: { reason: 'e2e 정리', actor_id: ENGINEER } })
  }
  // 앞선 실행이 남긴 확인 대기 제안도 반려해 둔다(같은 표현은 한 번만 대기)
  const pending = await (await request.get('/api/rule-suggestions?status=PENDING')).json() as { suggestion_id: number; expression: string }[]
  for (const s of pending.filter((x) => x.expression.toLowerCase() === PHRASE.toLowerCase())) {
    await request.post(`/api/rule-suggestions/${s.suggestion_id}/decline`, { data: { reason: 'e2e 정리', actor_id: ENGINEER } })
  }
}

test.afterAll(async ({ request }) => { await dropRule(request) })

// 명세 review-workspace "위험 조건 처리 알림"의 Scenario (change update-risk-action-toasts)
test('사전 추가 제안 알림', async ({ page }) => {
  await dropRule(page.request)
  const run = await riskRun(page.request, `제안 알림 ${Date.now()}`)
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByRole('tab', { name: '위험 조건' }).click()
  const box = page.locator('#risk .rk')
  await box.getByLabel('놓친 위험 표현').fill(PHRASE)
  await box.getByRole('button', { name: '위험 표현 사전에 추가 제안' }).click()
  const toast = page.locator('.uisnk').filter({ hasText: `“${PHRASE}”: 위험 표현 사전에 추가를 제안했습니다` })
  await expect(toast).toContainText('다음 검토부터 잡힙니다')
  await expect(toast.getByRole('link', { name: '판정 규칙 보기' })).toHaveAttribute('href', /#\/rules/)
  await expect(box.getByTestId('suggestion').filter({ hasText: PHRASE })).toBeVisible()
})

test('제안하고 반영하기', async ({ page }) => {
  await dropRule(page.request)
  const run = await riskRun(page.request, `사전 제안 ${Date.now()}`)
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByRole('tab', { name: '위험 조건' }).click()
  const box = page.locator('#risk .rk')
  await expect(box.getByRole('note')).toHaveCount(0)               // 예시 띠 없음
  await box.getByLabel('놓친 위험 표현').fill(PHRASE)
  await box.getByLabel('제안 메모').fill('범위가 고객 요구에 묶임')
  await box.getByRole('button', { name: '위험 표현 사전에 추가 제안' }).click()
  const mine = box.getByTestId('suggestion').filter({ hasText: PHRASE })
  await expect(mine).toContainText('확인 대기')
  await expect(mine).toContainText('행')                          // 찾은 곳(원문 위치)
  await expect(mine).toContainText('범위가 고객 요구에 묶임')

  await page.goto('/#/rules')
  const row = page.getByTestId('rule-suggestion').filter({ hasText: PHRASE }).first()
  await expect(row).toContainText(run.review_no)
  await row.getByRole('button', { name: '반영' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('제안 반영')
  await expect(dialog.getByLabel('표현 (원문)')).toHaveValue(PHRASE)
  await dialog.getByLabel('위험 종류').selectOption('OPEN_SCOPE')
  await dialog.getByLabel('추가 사유').fill('검토에서 찾은 범위 표현')
  await dialog.getByRole('button', { name: '저장' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(row).toContainText('반영')
  await expect(row.getByRole('button', { name: '반영' })).toHaveCount(0)

  await page.getByRole('tab', { name: /위험 표현/ }).click()
  await page.getByRole('search').getByRole('textbox').fill('Employer')
  await expect(page.locator('table tbody')).toContainText(PHRASE)

  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByRole('tab', { name: '위험 조건' }).click()
  await expect(page.locator('#risk .rk').getByTestId('suggestion').filter({ hasText: PHRASE })).toContainText('반영')
})
