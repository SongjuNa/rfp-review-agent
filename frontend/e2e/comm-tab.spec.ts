import { expect, test } from '@playwright/test'
import { ENGINEER, as, deviationRun } from './helpers'

// 명세 review-workspace "상업 조건 예시 탭"의 Scenario (change update-review-screens).

test('상업 조건 골라서 전달 예시', async ({ page, request }) => {
  const run = await deviationRun(request, `상업 조건 ${Date.now()}`)
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByRole('tab', { name: '상업 조건' }).click()
  const comm = page.locator('#comm')
  await expect(comm.locator('.sech .note')).toHaveText('RFP 조항 9 · 기술 판단 영향 3 · 미전달 8')
  await expect(comm.locator('table.cmt').first().locator('tr')).toHaveCount(9)
  await expect(comm.locator('table.cmt').nth(1).locator('tr')).toHaveCount(3)
  const send = comm.getByRole('button', { name: '골라서 전달' })
  await expect(send).toBeDisabled()
  await comm.getByRole('checkbox', { name: '책임 한도 선택' }).check()
  await comm.getByRole('checkbox', { name: '옵션 가격 선택' }).check()
  await expect(comm.locator('.cmsel')).toHaveText('2건 선택')
  await comm.locator('tr', { hasText: '옵션 가격' }).getByLabel('담당').selectOption('sales')
  await send.click()
  await expect(comm.locator('tr', { hasText: '책임 한도' }).locator('.st').last()).toHaveText('전달')
  await expect(comm.getByRole('checkbox', { name: '책임 한도 선택' })).toBeDisabled()
  await expect(comm.getByRole('checkbox', { name: '옵션 가격 선택' })).toBeDisabled()
  await expect(comm.getByRole('status')).toHaveText(/상업 조건을 전달했습니다: 영업 담당 2건/)
  await expect(comm.locator('.sech .note')).toHaveText('RFP 조항 9 · 기술 판단 영향 3 · 미전달 6')
  await expect(comm).not.toContainText('대리')                   // 사람 이름 대신 담당 역할
})
