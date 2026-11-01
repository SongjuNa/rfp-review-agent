# requirement-extraction Specification

## Purpose
요구사항 후보를 한 줄씩 뽑고 담당이 갈리는 유형을 붙여, 엔지니어가 문서를 처음부터 읽지 않고 필요한 사람이 자기 몫만 보게 한다 (FR-03, FR-04).

## Requirements

### Requirement: 요구사항 추출
시스템은 데이터시트 표의 행을 모두 요구사항 후보로 뽑고(요구값이 빈칸이어도), 문장은 정해진 표현("shall / must / required / 하여야 / 한다")으로 1차 후보를 뽑아야 한다(SHALL). AI는 절 단위로 후보를 다듬고 작성 규칙·설명 문장을 구분한다.

#### Scenario: 데이터시트 행
- **WHEN** 파일 1의 7459행 "Rated short-time withstand current, (1 sec.) / kA / 40"을 추출하면
- **THEN** 요구사항 1줄, 출처 = 표 칸, 원문 위치 = 파일 1 TS-115-GIS 16번이다

#### Scenario: 작성 규칙
- **WHEN** 파일 1의 7419행 "'comply' not allow to use in Warranted Data column"을 추출하면
- **THEN** 요구사항이 아니라 작성 규칙으로 표시된다

#### Scenario: 공급사 표시
- **WHEN** 파일 18(262000 Electric Distribution)의 공급사 C/D/E 칸을 추출하면
- **THEN** 표시는 요구사항 내용과 섞이지 않고 별도 칸에 저장된다

### Requirement: 유형 표시
시스템은 요구사항마다 주 유형 1개와 보조 유형 0개 이상(7종)을 붙이고 판단 근거(규칙 ID 또는 AI)를 남겨야 한다(SHALL). 유형 규칙표가 먼저이고, AI는 규칙에 안 걸린 줄만 판단한다. 규칙과 AI가 다르면 둘 다 표시하고, 어느 유형도 아니면 "미분류"로 둔다(SHALL).

#### Scenario: 시험
- **WHEN** "Type Test Report / Required"에 유형을 붙이면
- **THEN** 주 유형은 시험이다

#### Scenario: 제조사 자격
- **WHEN** "ISO 9001 or equivalent certificates / Required"에 유형을 붙이면
- **THEN** 주 유형은 제조사 자격이다

#### Scenario: 손실 환산 조항
- **WHEN** 파일 1의 손실 환산 조항(8238행)에 유형을 붙이면
- **THEN** 주 유형은 비용 영향, 보조 유형은 기술 성능이다

### Requirement: AI 유형 판단의 문맥
시스템은 유형 규칙에 안 걸린 요구사항을 AI에 물을 때 줄마다 그 줄이 속한 절 번호·제목, 표 이름, 표 안 구분 행 제목을 문맥으로 함께 줘야 한다(SHALL). 문맥이 없는 줄은 문장만 준다. 유형을 정하는 규칙과 판정은 바뀌지 않는다. [제안 11-01]

#### Scenario: 표 행에 표 이름과 절 제목
- **WHEN** 유형 규칙에 안 걸린 데이터시트 표 행을 AI에 물으면
- **THEN** 묻는 글의 그 줄에 표 이름과 그 표가 속한 절 제목이 함께 들어간다

#### Scenario: 문맥이 없는 줄
- **WHEN** 절·표에 속하지 않은 문장을 AI에 물으면
- **THEN** 그 줄은 문장만 들어간다
