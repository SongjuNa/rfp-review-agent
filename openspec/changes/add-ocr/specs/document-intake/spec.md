## ADDED Requirements

### Requirement: OCR로 글자 읽기
시스템은 글자 층이 없는 PDF 쪽과 docx 그림을 로컬 OCR 엔진으로 읽어 단락으로 더하고 같은 단계로 처리해야 한다(SHALL). OCR 줄에서 나온 요구사항은 추출 방법 "OCR"과 낮은 신뢰도로 저장하고 그 문서는 확인 필요로 둔다. 글자 신뢰도가 기준보다 낮은 줄은 버린다(CR-04). AI는 쓰지 않는다(CR-01). 엔진이 없거나 꺼져 있으면 OCR 없이 처리한다(스캔 PDF는 판독 불가). [제안 11-02]

#### Scenario: 스캔한 PDF 사양서
- **WHEN** 글자 층 없이 "The switchgear shall be rated 145 kV." 등 요구 문장 그림만 든 PDF를 OCR 엔진과 함께 처리하면
- **THEN** 판독 가능으로 저장되고 그 문장이 추출 방법 OCR 요구사항으로 원문 위치와 함께 나오며 문서는 확인 필요다

#### Scenario: docx 그림 속 문장
- **WHEN** 본문 사이에 요구 문장이 그려진 그림이 있는 docx를 처리하면
- **THEN** 그림 위치가 저장되고 그 문장이 추출 방법 OCR 요구사항으로 나온다

#### Scenario: OCR 엔진 없음
- **WHEN** OCR을 끈 상태로 같은 스캔 PDF를 처리하면
- **THEN** 판독 불가로 저장되고 요구사항이 없다

## MODIFIED Requirements

### Requirement: 그림 위치 기록
시스템은 문서를 나눌 때 그림(그림 개체가 든 단락)이 있는 줄 번호와 그림 설명(바로 앞이나 뒤 단락이 "Fig."·"Figure"·"그림"으로 시작하면 그 문장)을 저장해야 한다(SHALL). 그림 속 글자는 OCR 엔진이 있을 때 OCR로 읽어 더하고(OCR로 글자 읽기), 그림 단락 자체는 요구사항이 아니다. 도면 기호·연결의 뜻은 읽지 않는다. [OCR: 제안 11-02]

#### Scenario: 단선도 그림 위치
- **WHEN** 본문 사이에 그림 단락이 있고 다음 단락이 "Fig. 1 Single Line Diagram"인 문서를 나누면
- **THEN** 그림 1개가 그 줄 번호와 설명 "Fig. 1 Single Line Diagram"으로 저장되고, 그림 단락은 요구사항으로 뽑히지 않는다
