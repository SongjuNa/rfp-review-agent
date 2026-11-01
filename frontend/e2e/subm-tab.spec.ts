import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { APPROVER, COMMENT, ENGINEER, as, deviationRun } from './helpers'

// 명세 review-workspace "제출본 탭"의 Scenario (change update-review-screens).

test('승인된 실행의 제출본', async ({ page, request }) => {
  const run = await deviationRun(request, `제출본 ${Date.now()}`)
  const url = `/api/runs/${run.run_id}`
  expect((await request.post(`${url}/finish-review`, { data: { approver_id: APPROVER, comment: COMMENT, actor_id: ENGINEER } })).status()).toBe(200)
  expect((await request.post(`${url}/approval`, { data: { decision: 'APPROVED', comment: '승인', actor_id: APPROVER } })).status()).toBe(200)
  const summary = await (await request.get(url)).json() as { judgments: number }
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await expect(page.getByRole('button', { name: '제출본 v1 확정' })).toBeDisabled()
  await page.getByRole('tab', { name: '제출본' }).click()
  const row = page.locator('#subm table.subt tbody tr')
  await expect(row).toHaveCount(1)
  await expect(row.locator('td').first()).toHaveText('v1')
  await expect(row).toContainText(`${summary.judgments}줄`)
  await expect(row).toContainText(`일탈 ${run.deviations} · 질의`)
  await expect(row).toContainText('기본 승인자')
  await expect(row.locator('.st')).toHaveText('현재 제출본')
})

test('승인 전 제출본 없음', async ({ page, request }) => {
  const run = await deviationRun(request, `제출본 없음 ${Date.now()}`)
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByRole('tab', { name: '제출본' }).click()
  await expect(page.locator('#subm .subempty')).toHaveText(/^아직 확정된 제출본이 없습니다/)
  await expect(page.locator('#subm table.subt')).toHaveCount(0)
})

test('인계 패키지 영업에 넘기기', async ({ page, request }) => {
  // change add-submission-package
  const run = await deviationRun(request, `인계 패키지 ${Date.now()}`)
  const url = `/api/runs/${run.run_id}`
  expect((await request.post(`${url}/finish-review`, { data: { approver_id: APPROVER, comment: COMMENT, actor_id: ENGINEER } })).status()).toBe(200)
  expect((await request.post(`${url}/approval`, { data: { decision: 'APPROVED', comment: '승인', actor_id: APPROVER } })).status()).toBe(200)
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByRole('tab', { name: '제출본' }).click()
  const box = page.locator('#subm .subpk')
  const dl = page.waitForEvent('download')
  await box.getByRole('button', { name: '인계 패키지 내려받기' }).click()
  // 헤드리스 Chromium은 blob 내려받기의 한글 파일 이름을 "download"로 줄 때가 있어, 이름은 알림으로 확인한다
  expect(readFileSync(await (await dl).path()).subarray(0, 2).toString()).toBe('PK')
  await expect(page.locator('#subm').getByRole('status')).toContainText(`인계패키지_${run.review_no}.zip 를 내려받았습니다.`)
  await box.getByRole('button', { name: '영업에 넘기기' }).click()
  await expect(page.locator('#subm').getByRole('status')).toContainText('인계 패키지를 보냈습니다')
  await expect(box).toContainText('에게 보냄')
  await expect(box.getByRole('button', { name: '다시 넘기기' })).toBeVisible()
})
