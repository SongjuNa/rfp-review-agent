// 예시 탭: API가 없는 탭(상업 조건, 지난 RFP 비교, 제출본). _공통규칙.md 6장 예시 화면 규칙.
// 목업 내용을 옮기는 일은 update-review-screens의 다음 묶음에서 한다 (SCR-08_공유.md).

export function ExampleBand() {
  return <div className="exband" role="note"><span className="ms" aria-hidden="true">info</span>예시 화면 · 실제 데이터와 연결되지 않음</div>
}

const NOTES: Record<string, string> = {
  comm: '상업 조건: RFP의 비용·상업 조항을 모아 영업·견적 담당에게 넘기는 탭입니다. 아직 API가 없습니다.',
  cmp: '지난 RFP 비교: 같은 고객의 지난 RFP와 요구값이 달라진 곳을 보여 주는 탭입니다. 아직 API가 없습니다.',
  subm: '제출본: 결재가 승인된 시점의 판정을 판 번호와 함께 고정해 두는 탭입니다. 아직 API가 없습니다.',
}

export function ExampleTab({ tab }: { tab: 'comm' | 'cmp' | 'subm' }) {
  return (
    <section className="sec">
      <ExampleBand />
      <p style={{ margin: 0, color: '#475467' }}>{NOTES[tab]}</p>
    </section>
  )
}
