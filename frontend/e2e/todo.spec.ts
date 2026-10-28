import { expect, test, type Page } from '@playwright/test'
import { as, riskRun } from './helpers'

// SCR-13 협조 요청 현황. 합성 사양서(tests/docx_factory.build_gis_spec)의 형식시험 줄이 품질 담당에게 간다.
const QUALITY = 4
const TYPE_TEST = /Type Test Report/

function row(page: Page, reviewNo: string) {
  return page.locator('tbody tr', { has: page.getByRole('link', { name: reviewNo, exact: true }) }).filter({ hasText: TYPE_TEST })
}

test('수신 부서별 요청 현황', async ({ page, request }) => {
  const run = await riskRun(request, `협조 요청 ${Date.now()}`)
  await page.goto('/#/todo')
  await page.getByRole('navigation', { name: '수신 부서' }).getByRole('button', { name: '품질 담당' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('품질 담당')
  const r = row(page, run.review_no)
  await expect(r).toContainText('미확인')
  await expect(r).toContainText('synthetic_154kV_GIS_spec.docx')
  await expect(page.locator('.sumline')).toContainText(/미확인\s*[1-9]/)
  await page.getByRole('navigation', { name: '수신 부서' }).getByRole('button', { name: '미분류' }).click()
  await expect(page.getByText('이 담당에게 요청 항목이 없습니다.')).toBeVisible()
})

test('24시간 넘게 미확인', async ({ page, request }) => {
  const run = await riskRun(request, `협조 요청 늦음 ${Date.now()}`)
  const old = new Date(Date.now() - 2 * 86_400_000).toISOString()
  await page.route('**/api/assignments?role=QUALITY', async (route) => {
    const res = await route.fetch()
    const rows = (await res.json()) as { run_id: number; sent_at: string }[]
    await route.fulfill({ response: res, json: rows.map((a) => (a.run_id === run.run_id ? { ...a, sent_at: old } : a)) })
  })
  await page.goto('/#/todo')
  await page.getByRole('navigation', { name: '수신 부서' }).getByRole('button', { name: '품질 담당' }).click()
  const r = row(page, run.review_no)
  await expect(r.locator('.st')).toHaveText('24시간 넘게 미확인')
  await r.click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.locator('.tl2')).toContainText('재요청 필요')
  await expect(dlg.getByRole('button', { name: '재요청' })).toBeDisabled()
})

test('받는 담당자의 확인', async ({ page, request }) => {
  const run = await riskRun(request, `협조 요청 확인 ${Date.now()}`)
  await as(page, QUALITY)
  await page.goto('/#/todo')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('품질 담당')   // 담당자는 자기 부서 탭으로 열린다
  const r = row(page, run.review_no)
  await r.click()
  await page.getByRole('dialog').getByRole('button', { name: '확인함' }).click()
  await expect(page.getByRole('status')).toContainText('확인으로 표시했습니다')
  await expect(r).toHaveClass(/dis/)
  await expect(r.locator('.st')).toHaveText('확인')
  const dlg = page.getByRole('dialog')
  await expect(dlg.locator('.tl2')).toContainText('확인')
  await expect(dlg.getByRole('button', { name: '처리 끝' })).toBeVisible()
})

test('요청하기 예시', async ({ page }) => {
  await page.goto('/#/todo')
  const count = page.locator('.sech h2 span')
  await expect(page.locator('tbody .cond').first()).toBeVisible()
  const before = await count.textContent()
  await page.getByRole('button', { name: '요청하기' }).click()
  const dlg = page.getByRole('dialog', { name: '협조 요청하기' })
  await expect(dlg.getByText('예시 화면')).toBeVisible()
  await dlg.getByRole('button', { name: '요청 보내기' }).click()
  await expect(dlg.getByText('요구사항을 입력해 주세요.')).toBeVisible()
  await dlg.getByLabel('요구사항').fill('예시 요구사항')
  await dlg.getByLabel('요청 내용').fill('예시 요청')
  await dlg.getByRole('button', { name: '요청 보내기' }).click()
  await expect(page.getByRole('status')).toHaveText(/예시 화면이라 보내지 않았습니다/)
  await expect(dlg).toBeHidden()
  await expect(count).toHaveText(before!)
})
