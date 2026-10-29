import { expect, test } from '@playwright/test'

// SCR-16 제품표, SCR-17 판정 규칙 (add-reference-views). 기준 데이터(data/seed)를 읽기만 한다.
type Product = { product_code: string; family: string; used: number }

test('제품 상세', async ({ page, request }) => {
  const list = (await (await request.get('/api/products?family=GIS&limit=100')).json()) as Product[]
  const p = list[0]
  const detail = await (await request.get(`/api/products/${p.product_code}`)).json() as { used: number }
  await page.goto('/#/products')
  await page.getByRole('button', { name: /^GIS/ }).click()
  await page.locator('tbody tr', { hasText: p.product_code }).first().click()
  const panel = page.getByRole('complementary', { name: '제품 상세' })
  await expect(panel.getByRole('heading', { name: p.product_code })).toBeVisible()
  await expect(panel.getByLabel('판정에 쓰임')).toContainText(String(detail.used))
  await panel.getByRole('tab', { name: '값' }).click()
  await expect(panel).toContainText('정격 전압')
})

test('두 제품 비교', async ({ page, request }) => {
  const list = (await (await request.get('/api/products?family=GIS&limit=100')).json()) as Product[]
  const [a, b] = list
  await page.goto('/#/products')
  await page.getByRole('button', { name: /^GIS/ }).click()
  await page.getByLabel(`${a.product_code} 비교에 넣기`).check()
  await page.getByLabel(`${b.product_code} 비교에 넣기`).check()
  await page.getByRole('button', { name: /선택한 2개 비교/ }).click()
  await expect(page.getByRole('heading', { name: /제품 비교/ })).toContainText(`${a.product_code} · ${b.product_code}`)
  const table = page.locator('table.tbl')
  await expect(table.locator('thead')).toContainText(a.product_code)
  await expect(table.locator('thead')).toContainText(b.product_code)
  await expect(table).toContainText('정격 전압')
})

test('규칙 검색', async ({ page }) => {
  await page.goto('/#/rules')
  const tabs = page.getByRole('tablist', { name: '규칙 종류' })
  await expect(tabs.getByRole('tab', { name: /비교 방향\s*39/ })).toHaveAttribute('aria-selected', 'true')
  await page.getByLabel('규칙 검색').fill('정격 전류')
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toContainText('정격 전류')
  for (const t of await rows.allInnerTexts()) expect(t).toContain('정격 전류')
  await rows.first().click()
  await expect(page.locator('tr.rx')).toContainText('rated_current')
  await page.getByLabel('규칙 검색').fill('없는 규칙 이름')
  await expect(page.getByText('조건에 맞는 규칙이 없습니다.')).toBeVisible()
  await page.getByRole('button', { name: '검색 지우기' }).click()
  await tabs.getByRole('tab', { name: /위험 표현/ }).click()
  await page.getByLabel('규칙 검색').fill('including')
  await expect(page.locator('tbody tr').first()).toContainText('including but not limited to')
})

test('문서 종류 규칙 탭', async ({ page }) => {
  // 명세 review-workspace "판정 규칙 화면" (change update-doc-kind-rules)
  await page.goto('/#/rules')
  const tabs = page.getByRole('tablist', { name: '규칙 종류' })
  await tabs.getByRole('tab', { name: /문서 종류\s*5/ }).click()
  await expect(page.locator('thead')).toContainText('파일 이름에서 찾는 표현')
  await page.getByLabel('규칙 검색').fill('bidding')
  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('입찰 양식')
  await expect(rows.first()).toContainText('bidding forms')
  await expect(rows.first()).toContainText('파일 이름만 봄')
  await expect(rows.first().locator('td').nth(3)).toHaveText('1')
  await expect(rows.first().locator('td').nth(4)).toHaveText(/^\d+개$/)
  await expect(page.getByRole('button', { name: '규칙 추가' })).toBeDisabled()
})
