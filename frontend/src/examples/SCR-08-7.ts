// 지난 RFP 비교 탭의 예시 데이터 (목업 v4.57 Detail CMP). 같은 고객의 지난 검토를 찾는 API가 없어 예시로만 보여 준다 (SCR-08-7_공유.md).
// 사업 이름은 목업의 지명 대신 "예시 변전소"로 바꿨다. 실제 고객사명·원문은 넣지 않는다.

export type CmpKind = 'chg' | 'new' | 'del'
/** 판정 약자: D 일탈 후보, Q 질의 후보, R 확인 필요, W 작성 필요, C 준수, '' 없음 */
export type CmpResult = 'D' | 'Q' | 'R' | 'W' | 'C' | ''
export type CmpRow = { kind: CmpKind; item: string; before: string; after: string; from: CmpResult; to: CmpResult; note: string }
export type CmpTarget = {
  id: string; label: string; name: string; bid: string; sub: string; res: string; prod: string
  same: number; rows: CmpRow[]
}

const row = (kind: CmpKind, item: string, before: string, after: string, from: CmpResult, to: CmpResult, note: string): CmpRow =>
  ({ kind, item, before, after, from, to, note })

export const EXAMPLE_CMP: CmpTarget[] = [
  {
    id: 'RV-2025-051', label: 'RV-2025-051 · 예시 변전소 A · 230 kV GIS 변전소 (25-10)', name: '예시 변전소 A · 230 kV GIS 변전소',
    bid: 'BD-2025-031', sub: '2025-10-11', res: '수주', prod: 'LSG-245-63', same: 55,
    rows: [
      row('chg', '230 kV GIS 주모선 정격 전류', '3,150 A', '4,000 A', 'C', 'D', '요구가 올라감 · 지난번 표준 그대로 준수'),
      row('chg', '최저 주위 온도', '−25 ℃', '−30 ℃', 'C', 'D', '요구가 더 낮아짐 · 히터 옵션 검토 필요'),
      row('chg', '설치 고도', '≤ 1,000 m', '≤ 2,000 m', 'C', 'R', '고도 보정 필요'),
      row('chg', '오손 등급', '심함 (d)', '매우 심함 (e)', 'C', 'R', '부싱 크리피지 확인 필요'),
      row('chg', '예비품', '3년분', '5년분', 'R', 'R', '지난번 표준 목록 제출 · 고객 수용'),
      row('chg', '통신 프로토콜', 'IEC 61850 Ed.1', 'IEC 61850 Ed.2', 'C', 'C', '판정 같음'),
      row('chg', '운전 소음', '≤ 75 dB(A)', '≤ 72 dB(A)', 'C', 'C', '판정 같음 · 여유 3 dB 줄어듦'),
      row('new', '내진 성능', '—', 'IEEE 693 High', '', 'R', '지난번에 없던 요구'),
      row('new', '230 kV 차단기 최대 순간 전류', '—', '100 kA', '', 'Q', '지난번에 없던 요구'),
      row('new', '접지 개폐기 견딤 시간', '—', '1초 / 3초', '', 'Q', '지난번에 없던 요구'),
      row('new', '공장 입회 시험', '—', '발주처 입회', '', 'R', '지난번에 없던 요구'),
      row('new', '충격 기록계', '—', '부착', '', 'C', '지난번에 없던 요구'),
      row('del', '현지 조립 공장 사용', '현지 공장에서 최종 조립', '—', 'R', '', '이번에는 요구 없음 · 지난번 확인 필요였음'),
      row('del', '예비 차단기', '1대 공급', '—', 'W', '', '이번에는 요구 없음'),
    ],
  },
  {
    id: 'RV-2026-008', label: 'RV-2026-008 · 예시 변전소 A · 145 kV 변전소 GIS (26-05)', name: '예시 변전소 A · 145 kV 변전소 GIS',
    bid: 'BD-2026-004', sub: '2026-05-02', res: '수주', prod: 'LSG-145-40', same: 58,
    rows: [
      row('chg', '정격 단시간 견딤 전류', '40 kA (3초)', '40 kA (1초)', 'C', 'C', '판정 같음 · 지난번 3초 견딤을 강점으로 제시'),
      row('chg', '설치 고도', '≤ 1,000 m', '≤ 2,000 m', 'C', 'R', '고도 보정 필요'),
      row('chg', '최저 주위 온도', '−25 ℃', '−30 ℃', 'C', 'D', '요구가 더 낮아짐'),
      row('chg', '운전 소음', '≤ 75 dB(A)', '≤ 72 dB(A)', 'C', 'C', '판정 같음'),
      row('new', '230 kV GIS 주모선 정격 전류', '—', '4,000 A', '', 'D', '230 kV 설비가 새로 들어옴'),
      row('new', '230 kV 차단기 최대 순간 전류', '—', '100 kA', '', 'Q', '230 kV 설비가 새로 들어옴'),
      row('new', '내진 성능', '—', 'IEEE 693 High', '', 'R', '지난번에 없던 요구'),
      row('new', '접지 개폐기 견딤 시간', '—', '1초 / 3초', '', 'Q', '지난번에 없던 요구'),
      row('new', '공장 입회 시험', '—', '발주처 입회', '', 'R', '지난번에 없던 요구'),
      row('new', '충격 기록계', '—', '부착', '', 'C', '지난번에 없던 요구'),
      row('del', '현지 조립 공장 사용', '현지 공장에서 최종 조립', '—', 'R', '', '이번에는 요구 없음'),
    ],
  },
]
