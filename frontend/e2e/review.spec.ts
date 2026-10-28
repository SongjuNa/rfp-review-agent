import { expect, test } from '@playwright/test'

// 파일 1(입찰 양식)로 검토를 시작해 담당자 확인 → 승인까지 끝까지 간다 (tasks 3.1).
// 명세 review-workspace의 Scenario: 처리 중, 적합성 표의 비교 제품, 손실 환산 결과, 승인 화면.
const FILE_1 = '1. Bidding Forms_Draft'

test('파일 1을 올려 확인·승인까지', async ({ page }) => {
  await page.goto('/#/reviews')
  const library = page.getByLabel('서버에 둔 RFP')
  await library.waitFor({ timeout: 10_000 }).catch(() => undefined)
  const file = (await library.locator('option').allTextContents()).find((f) => f.includes(FILE_1))
  test.skip(!file, '서버에 파일 1 원문이 없음')
  await library.selectOption(file!)
  await page.getByRole('button', { name: '골라서 시작' }).click()

  // Scenario: 처리 중 — 실행이 시작되고 현재 단계가 보인다
  const status = page.getByRole('status').first()
  await expect(status).toContainText(/처리 중|담당자 확인/)
  await expect(status).toContainText('담당자 확인', { timeout: 240_000 })

  // Scenario: 적합성 표의 비교 제품 — 비교 제품, 제품값, 여유와 방향, 바꿔 보기
  await page.getByRole('tab', { name: '적합성 판정' }).click()
  await expect(page.getByText('설비 묶음별 비교 제품')).toBeVisible()
  const deviation = page.locator('tr', { hasText: 'GIS-245-50' }).filter({ hasText: /4,?000/ }).first()
  await expect(deviation).toContainText('일탈 후보')
  await page.getByLabel('판정').selectOption('COMPLY')
  await expect(page.locator('tr', { hasText: '시간 3배' }).first()).toContainText('강점')
  await expect(page.getByRole('combobox', { name: /TS-115-GIS.*비교 제품/ }).first()).toBeVisible()

  // Scenario: 손실 환산 결과 — 계산식, 합계, 팀 가정
  await page.getByRole('tab', { name: '손실 환산' }).click()
  const loss = page.locator('.card', { hasText: 'TRF-HV-230-360A' })
  await expect(loss).toContainText('1,240,400 $')
  await expect(loss).toContainText('팀 가정')
  await expect(loss.locator('.formula')).toContainText('4,500 × 60')

  // 일탈 목록: 4,000 A는 한 건, 원문 위치 3곳. 누락 점검이 보인다
  await page.getByRole('tab', { name: '일탈·질의 목록' }).click()
  await expect(page.getByText('제출 전 누락 점검')).toBeVisible()
  const item = page.locator('.card', { hasText: '4,000 A' }).first()
  await expect(item).toContainText('원문 위치 3곳')
  await item.getByRole('button', { name: '확정', exact: true }).click()
  await expect(item).toContainText('확정')

  // 제안 포인트 하나 채택
  await page.getByRole('tab', { name: '제안 포인트' }).click()
  const point = page.locator('.card', { hasText: '3배' }).first()
  await point.getByRole('button', { name: '채택', exact: true }).click()
  await expect(page.getByText('지금 채택 1건')).toBeVisible()

  // Scenario: 승인 화면 — 담당자 확인을 마치면 승인 대기, 걸린 기준과 누락 점검
  await page.getByRole('tab', { name: '승인' }).click()
  await page.getByRole('button', { name: '담당자 확인 마치기' }).click()
  await expect(status).toContainText('승인 대기')
  await expect(page.getByText('AR-01').first()).toBeVisible()
  await expect(page.getByText(/일탈 후보 \d+건/).first()).toBeVisible()
  await expect(page.getByText(/빠진 일탈 \d+건/)).toBeVisible()

  await page.getByRole('button', { name: '사용자 바꾸기' }).click()
  await page.getByRole('button', { name: /기본 승인자/ }).click()
  await page.getByLabel('의견').fill('일탈 4,000 A 사유 확인함')
  await page.getByRole('button', { name: '승인', exact: true }).click()
  await expect(status).toContainText('승인됨')

  await page.getByRole('tab', { name: '이력' }).click()
  await expect(page.getByRole('cell', { name: '채택' })).toBeVisible()
  await page.screenshot({ path: 'test-results/review-done.png', fullPage: true })
})
