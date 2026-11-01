# 화면 명세: SCR-16 제품표

- 연결 요구사항: `reference-data` 제품표 조회·제품이 쓰인 곳, FR-07 판정 근거, FR-13 손실값, FR-15 현장 이력
- 기준 목업: `Spec2Win_목업_v4.57.html#Products`
- 구현 방식: 실제, 읽기 전용 (`add-reference-views`). 화면 CSS는 목업 Products CSS 그대로(`frontend/src/mockup/Products.css`)
- 사용 API: `GET /products?family=&q=&cards=&offset=&limit=`(X-Total-Count), `GET /products/families`, `GET /products/{code}`, `GET /rules/items`(강점 방향), `GET /products/export?family=&q=&cards=`(엑셀, X-Row-Count, `add-product-export`)
- 예정 API: 엑셀 가져오기, 요구 조건으로 찾기, 제품 고치기

## 화면 구성

| 영역 | 보이는 항목 | API 칸 | 비고 |
|---|---|---|---|
| 화면 탭(`.pgtabs`) | 제품 목록 · 비교 (n) | — | 비교 탭 수 = 고른 제품 수 |
| 식별 줄(`.idl`) | product_master, 제품 수 · 제품군 수, 적재 판 안내 | `families` | 마지막 수정자·수정일은 기록이 없어 적재 판 안내로 바꿈 |
| 제목(`.ttl`) | 제품표, 엑셀 가져오기, 내보내기, 내려받은 뒤 알림 "제품표_<제품군>.xlsx 를 내려받았습니다." | `GET /products/export` | 가져오기는 잠김. 내보내기는 지금 거르기(제품군·검색어·설계 사례 카드)대로 거른 제품 전부, 쪽 나누기 없음 (`add-product-export`) |
| 요약 칸(`.kpis`) | 비어 있는 칸(제품 n개), 팀 가정 값, 설계 사례 카드 | `empty_cells`, `with_empty`, `assumed`, `design_cards` | 비어 있는 칸 = 그 제품군에서 판정에 쓰는 칸 중 빈 칸 |
| 거르기 줄(`.fbar`) | 제품군 칩(수), 설계 사례 카드 포함, 제품 검색, 요구 조건으로 찾기, 선택한 n개 비교 | `family`, `cards`, `q` | 요구 조건으로 찾기 잠김. 비교는 3개까지 |
| 제품 표(`.tbl`) | 고르기, 제품 코드·이름·설계 사례, 제품군, 전압·전류·단시간·주파수·용량·무부하손·부하손·중량 | 목록 칸 | "—" 그 제품군에 없는 칸, "비어 있음"(주황) 빈 칸, "팀 가정" 표시. 10·20·50개씩 쪽 나눔 |
| 상세 패널 사진(`.pimg`) | 제품 계열 대표 사진, "이 모델만의 사진은 아님", 사진 출처 링크 | `source_doc`의 카탈로그 번호 | `add-product-photos`. 화면 코드의 짝(`productPhotos.ts`)으로 고름. 짝이 없으면 "공식 사진 없음" |
| 상세 패널 연결 탭 | 판정에 쓰임(검토 n건, 최근 100줄), 제안 포인트, 값의 출처, 현장 이력 | `used`, `used_runs`, `used_in`, `proposals`, `source_doc`, `field_history` | 판정 줄은 검토 상세로 연결 |
| 상세 패널 값 탭 | 주요 칸(강점 방향, 출처·팀 가정·빈 칸 설명) + 나머지 칸 | 모든 칸, `strength_direction` | 강점 방향은 항목 이름 사전 기준, 손실은 작을수록 강점 |
| 상세 패널 문서 탭 | 카탈로그·매뉴얼·시험 성적서·인증서 묶음(수), 문서 제목·날짜·언어·발행 기관, "제품표 값의 출처", "공식 자료실에 없음", 5건 넘으면 "외 n건 더 보기" | `source_doc`의 카탈로그 번호 | `add-product-docs`. 목록은 `productDocs.json`(공식 자료실 API로 만듦), 링크는 공식 내려받기 주소 |
| 비교 화면 | 제품 비교(코드들), 다른 값만 보기, 목록으로, 항목·강점 방향·제품별 값, ▲ 가장 유리한 값 | 상세 칸 | 값이 다른 줄은 노란 줄 |

## 수용 기준 (Given / When / Then)

- **Given** GIS 제품, **When** 목록에서 한 줄을 누르면, **Then** 상세 패널에 코드와 "판정에 쓰임" 수, 값 탭에 정격 전압. (제품 상세)
- **Given** GIS 제품 두 개를 고르고, **When** "선택한 2개 비교"를 누르면, **Then** 비교 표 머리에 두 코드와 정격 전압 줄. (두 제품 비교)
- **Given** 중량이 빈 제품, **When** 목록을 보면, **Then** 중량 칸은 "비어 있음"이고 빈 칸 수에 들어간다. (빈 칸은 비어 있음, API 테스트)
- **Given** GIS 제품, **When** 목록에서 한 줄을 누르면, **Then** 상세 패널에 "GIS 대표 사진"과 사진 출처 링크. (제품 상세에 계열 사진)
- **Given** GIS-145-40, **When** 상세의 "문서" 탭을 누르면, **Then** 카탈로그 "[GIS] Total Solution"(제품표 값의 출처)과 시험 성적서 링크. (제품 상세 문서 탭)
