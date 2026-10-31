import { expect, test } from '@playwright/test'
import { ENGINEER, as, deviationRun } from './helpers'

// 명세 review-workspace "상업 조건 탭"의 Scenario (change add-cost-conditions, FR-16).
// 합성 데이터시트에는 상업 조항이 없어, 비용 조건 줄은 응답을 바꿔 넣는다(상업 영향의 일탈 줄은 실제 데이터).

const LOC = { file_no: 91, section_no: '3', section_title: 'COMMERCIAL CONDITIONS', table_name: null, item_no: null, line_start: 40, line_end: 40 }
const row = (id: number, kind: string, text: string, extra: Record<string, unknown> = {}) => ({
  requirement_id: id, requirement_ids: [id], kind, text, values: [], burden: null, risk: null, primary_type: 'COST',
  primary_type_name: '비용 영향', repeat_count: 1, role: 'COST', assignment_id: id, request_status: 'TODO', mail_error: null,
  file_name: 'synthetic_judgment.docx', locations: [LOC], ...extra,
})
const CONDITIONS = [
  row(900001, '지체상금', 'Liquidated damages shall be 0.5 % of the Contract Price per week of delay.', { values: ['0.5 %'] }),
  row(900002, '책임 한도', "The Contractor's total liability shall not be limited.", { risk: '책임 한도 없음', request_status: 'DOING' }),
  row(900003, '하자 보증', 'The Defects Notification Period shall be 24 months from Taking-Over.', { values: ['24 months'] }),
  row(900004, '하자 보증', 'The warranty period for spare parts shall be 12 months after delivery.', { values: ['12 months'] }),
  row(900005, '시험 입회', 'Type Test shall be witnessed by the Employer.', { primary_type: 'TEST', primary_type_name: '시험', assignment_id: null, request_status: null }),
]

test('상업 조건 탭 열기', async ({ page, request }) => {
  const run = await deviationRun(request, `상업 조건 ${Date.now()}`)
  await page.route(`**/api/runs/${run.run_id}/cost-conditions`, async (route) => {
    const res = await route.fetch()
    const body = await res.json()
    await route.fulfill({ response: res, json: { ...body, conditions: CONDITIONS } })
  })
  await as(page, ENGINEER)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByRole('tab', { name: '상업 조건' }).click()
  const comm = page.locator('#comm')
  await expect(comm.getByRole('note')).toHaveCount(0)                           // 예시 띠 없음
  await expect(comm.locator('.sech .note')).toContainText('비용 조건 5')
  const ld = comm.locator('tr', { hasText: 'Liquidated damages' })
  await expect(ld).toContainText('지체상금')
  await expect(ld).toContainText('synthetic_judgment.docx')
  await expect(ld).toContainText('견적 담당')
  await expect(ld.locator('.st').last()).toHaveText('안 보냄')
  await expect(comm.locator('tr', { hasText: 'total liability' })).toContainText('책임 한도 없음')
  await expect(comm.locator('tr', { hasText: 'witnessed' }).locator('.st').last()).toHaveText('협조 요청 없음')
  await expect(comm.locator('tr', { hasText: '일탈 가격 영향' }).first()).toBeVisible()      // 실제 일탈 후보
})

test('종류 칩으로 거르기', async ({ page, request }) => {
  const run = await deviationRun(request, `상업 조건 칩 ${Date.now()}`)
  await page.route(`**/api/runs/${run.run_id}/cost-conditions`, async (route) => {
    const res = await route.fetch()
    await route.fulfill({ response: res, json: { ...(await res.json()), conditions: CONDITIONS } })
  })
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByRole('tab', { name: '상업 조건' }).click()
  const comm = page.locator('#comm')
  const chip = comm.getByRole('group', { name: '조항 종류' }).getByRole('button', { name: /하자 보증/ })
  await expect(chip).toContainText('2')
  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await expect(comm.locator('table.cmt').first().locator('tr')).toHaveCount(2)
  await expect(comm.locator('table.cmt').first()).not.toContainText('Liquidated damages')
})

test('비용 조건이 없는 검토', async ({ page, request }) => {
  const run = await deviationRun(request, `상업 조건 없음 ${Date.now()}`)
  await page.goto(`/#/reviews/${run.run_id}`)
  await page.getByRole('tab', { name: '상업 조건' }).click()
  const comm = page.locator('#comm')
  await expect(comm.getByText('찾은 비용 조건이 없습니다')).toBeVisible()
  await expect(comm.getByRole('button', { name: /내려받기|보내기|전달/ })).toHaveCount(0)
})
