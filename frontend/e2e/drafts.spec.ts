import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { as, deviationRun, ENGINEER, exportItem } from './helpers'

// 명세 review-workspace "목록 초안 내려받기와 문장 고치기"의 Scenario (change update-review-screens).

test('일탈 목록 초안 내려받기', async ({ page }) => {
  const run = await deviationRun(page.request, `초안 내려받기 ${Date.now()}`)
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  const download = page.waitForEvent('download')
  await exportItem(page, '일탈 목록 초안 (Word)')
  await expect(page.getByRole('progressbar', { name: '일탈 목록 초안' })).toBeVisible()
  const file = await download
  // 헤드리스 Chromium은 blob 내려받기의 한글 파일 이름을 "download"로 줄 때가 있어, 이름은 알림으로 확인한다
  const head = readFileSync(await file.path()).subarray(0, 2).toString()
  expect(head).toBe('PK')                                                    // docx(zip)
  await expect(page.locator('.ltoast')).toContainText(`일탈 목록 초안_${run.review_no}.docx를 만들었습니다.`)
})

test('사유 적어 문장 고치기', async ({ page }) => {
  const run = await deviationRun(page.request, `문장 고치기 ${Date.now()}`)
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.locator('.fbar .chip', { hasText: '질의 후보' }).click()
  await page.locator('#judge .tw tbody tr').first().click()
  await page.keyboard.press('Escape')
  const panel = page.getByRole('complementary', { name: '원문과 판정' })
  const draft = panel.locator('#draft')
  await expect(draft).toBeEditable()
  await draft.fill('수정한 질의 문장입니다. 적용 값을 회신해 주십시오.')
  const save = panel.getByRole('button', { name: '문장 저장' })
  await expect(save).toBeDisabled()
  await panel.getByLabel('고친 사유').fill('발주처 표현에 맞춤')
  await save.click()
  await expect(page.locator('.toast')).toContainText('정상적으로 사유가 등록되었습니다.')
  await expect(panel.locator('label[for="draft"] .st')).toHaveText('확정')
  await expect(draft).toHaveValue('수정한 질의 문장입니다. 적용 값을 회신해 주십시오.')
})
