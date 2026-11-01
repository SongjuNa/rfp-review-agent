import { expect, test } from '@playwright/test'
import { ENGINEER, as, deviationRun } from './helpers'

// 명세 review-workspace "검토 상세 요약 칸과 탭"·"판정 표 거르기"·"판정 상세 패널"의 Scenario (change update-review-screens).

test('요약 칸', async ({ page, request }) => {
  const run = await deviationRun(request, `요약 칸 ${Date.now()}`)
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  const kpis = page.locator('.kpis')
  await expect(kpis.locator('.kpi').nth(0)).toContainText(`일탈 후보${run.deviations}`)
  await expect(kpis).toContainText('질의 후보')
  await expect(kpis).toContainText(/확인 필요 비율\d+ %기준 20 %/)
  await expect(kpis).toContainText('보증값 작성 (비어 있음)')
  await expect(kpis).toContainText('손실 환산 참고값')
})

test('탭으로 내용 바꾸기', async ({ page, request }) => {
  const run = await deviationRun(request, `탭 ${Date.now()}`)
  await page.goto(`/#/reviews/${run.run_id}`)
  const tabs = page.getByRole('tablist', { name: '검토 메뉴' })
  await expect(tabs.getByRole('tab')).toHaveText(['판정', '문서 읽기 점검', '위험 조건', '손실 환산 (참고)', '입찰 영향',
    '상업 조건', '지난 RFP 비교', '제출본', '이력'])
  await tabs.getByRole('tab', { name: '이력' }).click()
  await expect(tabs.getByRole('tab', { name: '이력' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#log')).toContainText('사유: 시험용 일탈')
})

test('예시 탭', async ({ page, request }) => {
  // 마지막 예시 탭이던 지난 RFP 비교도 실제 데이터가 되어(add-past-compare) 예시 띠가 없다
  const run = await deviationRun(request, `예시 탭 ${Date.now()}`)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByRole('tab', { name: '지난 RFP 비교' }).click()
  await expect(page.locator('#cmp h2')).toContainText('지난 RFP 비교')
  await expect(page.locator('#cmp').getByRole('note')).toHaveCount(0)
})

test('판정 칩으로 거르기', async ({ page, request }) => {
  const run = await deviationRun(request, `칩 ${Date.now()}`)
  await page.goto(`/#/reviews/${run.run_id}`)
  const chip = page.locator('.fbar .chip', { hasText: '질의 후보' })
  const n = Number(await chip.locator('.n').textContent())
  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  const rows = page.locator('#judge .tw tbody tr')
  await expect(rows).toHaveCount(n)
  await expect(rows.locator('td:nth-child(2) .st')).toHaveText(Array(n).fill('질의 후보'))
  await expect(page.locator('.tfoot')).toContainText(`${n}줄 표시`)
})

test('거른 결과가 없음', async ({ page, request }) => {
  const run = await deviationRun(request, `없음 ${Date.now()}`)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByPlaceholder('항목명, 영문, 원문 문장').fill('없는검색어zz')
  await expect(page.getByText('조건에 맞는 줄이 없습니다.')).toBeVisible()
  await page.getByRole('button', { name: '필터 지우기' }).click()
  await expect(page.locator('#judge .tw tbody tr').first()).toBeVisible()
})

test('줄을 눌러 원문 보기', async ({ page, request }) => {
  const run = await deviationRun(request, `원문 ${Date.now()}`)
  // 확정하지 않은 일탈 후보를 하나 더 만든다 (시험용 일탈은 엔지니어가 바꾼 것)
  const [j] = await (await request.get(`/api/runs/${run.run_id}/judgments?result=QUERY_CANDIDATE&limit=1`)).json()
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.locator('.fbar .chip', { hasText: '질의 후보' }).click()
  await page.locator('#judge .tw tbody tr').first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.mdpos')).toContainText('판정 1 /')
  await expect(dialog.locator('.paper')).toContainText(j.req_value_raw)            // 원문 문장
  await expect(dialog.locator('.basis')).toContainText(j.reason_text)               // 판정 근거
  await expect(dialog.locator('.pv')).toContainText('시스템 제안질의 후보')
  await expect(dialog.locator('.pv')).toContainText('아직 확정 안 함')
  await page.keyboard.press('Escape')
  const panel = page.getByRole('complementary', { name: '원문과 판정' })
  await expect(panel).toContainText('synthetic_judgment.docx · ')                   // 원문 위치 (파일 이름)
  await expect(panel.locator('.pv')).toContainText('아직 확정 안 함')
})

test('사유 없이 판정 바꾸기', async ({ page, request }) => {
  const run = await deviationRun(request, `바꾸기 ${Date.now()}`)
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.locator('.fbar .chip', { hasText: '확인 필요' }).click()
  const first = page.locator('#judge .tw tbody tr').first()
  await first.click()
  await page.keyboard.press('Escape')
  const panel = page.getByRole('complementary', { name: '원문과 판정' })
  await panel.getByLabel('새 판정').selectOption('QUERY_CANDIDATE')
  const apply = panel.getByRole('button', { name: '적용' })
  await expect(apply).toBeDisabled()
  await panel.getByLabel('바꾸는 사유').fill('발주처에 확인할 값')
  await apply.click()
  await page.locator('.fbar .chip', { hasText: '질의 후보' }).click()
  await expect(page.locator('#judge .tw tbody tr', { hasText: '바꿈' }).first()).toBeVisible()
  await page.locator('#judge .tw tbody tr', { hasText: '바꿈' }).first().click()
  await expect(page.getByRole('dialog').locator('.pv')).toContainText('기본 엔지니어')    // 담당자 확정이 바뀜
})

test('적합성 표의 비교 제품 — 여유와 강점 방향', async ({ page, request }) => {
  // 명세 review-workspace "적합성 표의 비교 제품", compliance-judgment "40 kA 1초 요구, 3초 제품"·"강점이 아닌 여유".
  // 제품표에 따라 여유 있는 준수 판정이 없을 수 있어, 준수 판정 두 줄의 여유 칸만 바꿔 끼워 화면 표시를 본다.
  const run = await deviationRun(request, `여유 방향 ${Date.now()}`)
  await page.route(/\/api\/runs\/\d+\/judgments\?/, async (r) => {
    const res = await r.fetch()
    const rows = (await res.json()) as Record<string, unknown>[]
    const comply = rows.filter((j) => j.result === 'COMPLY')
    if (comply[0]) Object.assign(comply[0], { margin_kind: 'TIME_RATIO', margin_value: '3', margin_direction: 'STRENGTH' })
    if (comply[1]) Object.assign(comply[1], { margin_kind: 'DIFF', margin_value: '15', margin_direction: 'NOT_STRENGTH' })
    await r.fulfill({ response: res, json: rows })
  })
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.locator('.fbar .chip', { hasText: '준수' }).click()
  const rows = page.locator('#judge .tw tbody tr')
  const strong = rows.filter({ hasText: '여유 시간 3배 · 강점' })
  await expect(strong).toHaveCount(1)
  await expect(strong.locator('div.c-green')).toHaveText('여유 시간 3배 · 강점')   // 강점은 초록 글자
  await expect(rows.filter({ hasText: '여유 15 · 강점 아님' })).toHaveCount(1)
  await strong.click()
  await expect(page.getByRole('dialog').locator('.basis')).toContainText('여유와 방향여유 시간 3배 · 강점')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('complementary', { name: '원문과 판정' })).toContainText('여유 시간 3배 · 강점')
  await page.unrouteAll({ behavior: 'ignoreErrors' })
})
