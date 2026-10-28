// 예시 탭: API가 없는 탭(제출본). 상업 조건은 CommTab, 지난 RFP 비교는 CmpTab. _공통규칙.md 6장 예시 화면 규칙.
// 목업 내용을 옮기는 일은 update-review-screens의 다음 묶음에서 한다 (SCR-08_공유.md).

export function ExampleBand() {
  return <div className="exband" role="note"><span className="ms" aria-hidden="true">info</span>예시 화면 · 실제 데이터와 연결되지 않음</div>
}

const NOTES: Record<string, string> = {
  subm: '제출본: 결재가 승인된 시점의 판정을 판 번호와 함께 고정해 두는 탭입니다. 아직 API가 없습니다.',
}

export function ExampleTab({ tab }: { tab: 'subm' }) {
  return (
    <section className="sec">
      <ExampleBand />
      <p style={{ margin: 0, color: '#475467' }}>{NOTES[tab]}</p>
    </section>
  )
}
