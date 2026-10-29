import { expect, test } from '@playwright/test'
import { ENGINEER, as, deviationRun } from './helpers'

// 명세 review-workspace "데이터시트 채우기 화면"의 Scenario (change add-datasheet-export).

test('칸 확정', async ({ page, request }) => {
  const run = await deviationRun(request, `데이터시트 ${Date.now()}`)
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByRole('link', { name: '데이터시트 채우기' }).click()
  await expect(page).toHaveURL(new RegExp(`#/reviews/${run.run_id}/datasheet$`))
  const ok = page.getByLabel('요약').locator('div', { hasText: '채움 · 확정' }).locator('b')
  await expect(page.locator('table.ds-t tbody tr').first()).toBeVisible()
  const before = Number(await ok.textContent())
  const row = page.locator('table.ds-t tbody tr', { has: page.getByRole('button', { name: '확정' }) }).first()
  const no = (await row.locator('td').first().textContent())!.trim()
  await row.getByRole('button', { name: '확정' }).click()
  await expect(page.getByRole('status')).toContainText(`칸 ${no} `)
  await expect(page.getByRole('status')).toContainText('값을 확정했습니다.')
  await expect(ok).toHaveText(String(before + 1))
})

test('확인 필요만 보기', async ({ page, request }) => {
  const run = await deviationRun(request, `데이터시트 빈칸 ${Date.now()}`)
  await page.goto(`/#/reviews/${run.run_id}/datasheet`)
  await expect(page.locator('table.ds-t tbody tr').first()).toBeVisible()
  await page.getByRole('radio', { name: '확인 필요' }).check()
  const rows = page.locator('table.ds-t tbody tr')
  await expect(rows.first()).toBeVisible()
  for (const t of await rows.allInnerTexts()) expect(t).toContain('비움')
  await expect(rows.locator('.st')).toHaveText(Array(await rows.count()).fill('확인 필요'))
})
