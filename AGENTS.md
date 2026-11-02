# AGENTS.md

이 저장소에서 일하는 코딩 에이전트(Claude Code, Codex, Cursor 등)와 사람을 위한 작업 지침입니다.
이 저장소는 **OpenSpec 스펙 기반 개발**을 합니다. 스펙에 없는 기능은 만들지 않고, 스펙을 먼저 고칩니다.

## 1. 무엇을 만드나

수백 쪽 RFP(docx)에서 기술 요구사항과 위험 조건을 찾아 우리 제품(product_master)과 비교·판정하고,
일탈·질의 목록, 보증값 후보, 손실 환산, 기술 제안 포인트를 **근거(원문 위치)와 함께** 만드는 시스템입니다.
주 사용자는 입찰 기술 검토 엔지니어입니다. MVP 범위는 명세서 v1의 Must 12개(FR-01~10, 13, 14)이고,
목표는 RFP 1건(파일 1)을 처음부터 끝까지 돌리는 것입니다.

| 읽을 것 | 위치 |
|---|---|
| 원본 요구사항 (FR·CR·AR 번호의 출처) | `docs/reference/기능요구사항명세서_v1.md` |
| 기획 배경, 일정, 역할 | `docs/reference/프로젝트기획서_v1.4.md` |
| 공통 규칙 CR-01~12, 스택, 작성 규칙 | `openspec/config.yaml` |
| 지금 시스템이 하는 일 (확정 스펙) | `openspec/specs/<capability>/spec.md` |
| 앞으로 만들 일 | `openspec/changes/<change>/` |
| DB 스키마 | `db/migrations/*.sql` |

## 2. OpenSpec 구조

```
openspec/
  config.yaml                 공통 맥락·규칙. 모든 change에 적용
  specs/<capability>/spec.md  archive된 현재 스펙 (Requirement + Scenario)
  changes/<change>/
    proposal.md               왜, 무엇을 (관련 FR·사례 번호)
    design.md                 어떻게 (결정과 대안, 위험)
    specs/<capability>/spec.md 이 change가 더하거나 바꾸는 요구사항 (ADDED/MODIFIED/REMOVED)
    tasks.md                  구현 작업 체크리스트
  changes/archive/            끝난 change
```

현재 change와 순서 (앞 change가 archive된 뒤 다음 change를 시작):

| 단계 | change | 내용 |
|---|---|---|
| 1 | `archive/2026-10-23-add-project-foundation` | 저장소·DB·기준 데이터 (완료) |
| 2 | `archive/2026-10-23-add-document-pipeline` | FR-01~06 문서 분류 → 구조 → 추출 → 유형 → 값 → 위험 조건 (완료) |
| 3 | `archive/2026-10-23-add-judgment-and-outputs` | FR-07·08·09·13·14 판정, 보증값, 일탈·질의 목록, 손실 환산, 제안 포인트 (완료) |
| 4 | `archive/2026-10-23-add-review-approval` | FR-10 확인·승인·이력, 화면 (완료) |
| 5 | `archive/2026-10-23-update-product-master` | 실제 제품표 바꾸기 (완료) |
| 6 | `archive/2026-10-23-add-field-history` | FR-15 현장 이력 연결 (완료) |
| 7 | `archive/2026-10-24-add-engineering-check` | FR-12 공학 규칙 검산 (완료) |
| 8 | `archive/2026-10-24-add-role-assignment` | FR-11 유형별 담당자 전달, "내 할 일" 화면 (완료) |
| 9 | `archive/2026-10-25-update-risk-dictionary` | FR-06 위험 표현 사전에 "but not limited to" 추가 (완료) |
| 10 | `archive/2026-10-28-update-app-shell` | 목업 v4.57 앱 틀: 왼쪽 메뉴, 머리글, 화면 주소 (완료) |
| 11 | `archive/2026-10-28-add-review-info` | 검토 정보(사업명·검토명·고객사·국가·마감·담당), 검토 목록·등록·상세 화면 (완료) |
| 12 | `archive/2026-10-28-update-approval-flow` | 결재자를 골라 상신, 지정 결재자만 결정, 상신 취소. 결재 상신 창·결재 대기 화면 (완료) |
| 13 | `archive/2026-10-28-update-review-screens` | 목업 v4.57 검토 화면: 검토 상세 탭 전부, 처리 상태·분석 실패, 협조 요청 현황, 홈. 예전 화면 지움 (완료) |
| 14 | `archive/2026-10-28-add-reference-views` | 제품표·판정 규칙 화면 (읽기 전용) (완료) |
| 15 | `archive/2026-10-28-add-bulk-confirm` | 판정 여러 줄 한꺼번에 확정 (완료) |
| 16 | `archive/2026-10-28-add-tbe-export` | TBE 준수표 화면과 엑셀 내려받기 (완료) |
| 17 | `archive/2026-10-28-add-datasheet-export` | 데이터시트 채우기 화면과 엑셀 내려받기 (완료) |
| 18 | `archive/2026-10-28-add-example-screens` | 백엔드 없는 메뉴 화면 12개를 예시 데이터로 (완료) |
| 19 | `archive/2026-10-29-update-api-contract` | API 응답 스키마(Pydantic), 근거 응답 위치 필수, 화면 타입 자동 생성·CI 대조 (완료) |
| 20 | `archive/2026-10-29-update-processing-progress` | 처리 중 세부 진행(AI 줄 수)·지난 시간·멈춤 안내, 검토 목록·홈 자동 새로고침 (완료) |
| 21 | `archive/2026-10-29-update-detail-layout` | 머리글 비교 제품 칸(묶음마다 한 줄, 많으면 접기), 긴 목록 페이지 번호 줄이기 (완료) |
| 22 | `archive/2026-10-29-update-document-info` | 검토 상세 머리글에 판정 묶음, "문서 n개"를 누르면 문서 표(종류·분류 방법·묶음·판정 대상) (완료) |
| 23 | `archive/2026-10-29-add-document-confirm` | 검토 등록에서 분석 전 문서 종류·묶음 추천, 사람이 확인·수정하고 시작 (완료) |
| 24 | `archive/2026-10-29-update-doc-kind-rules` | 문서 종류 규칙을 사전(CSV → DB)으로, 판정 규칙 화면 "문서 종류" 탭 (완료) |
| 25 | `archive/2026-10-29-add-rule-editing` | 판정 규칙 화면에서 규칙 추가·수정·삭제, 고침 이력, 다시 적재 때 고침 유지 (완료) |
| 26 | `archive/2026-10-30-add-project-status` | 사업 현황·사업 상세를 실제 데이터로, 검토 등록에서 사업 연결, 제출 완료 표시 (완료) |
| 27 | `archive/2026-10-31-add-claim-evidence` | AI 위험 설명을 문장마다 근거 조각·인용과 대조하고 근거 위치 저장 (완료) |
| 28 | `archive/2026-10-31-update-document-reuse` | 내용이 같은 파일만 처리 결과 재사용, 표 앞 단락 표 이름, 빈 초안 거절 (완료) |
| 29 | `archive/2026-10-31-update-comparison-assumption` | 제품표 팀 합성 비교값으로 한 판정·보증값·제품표 화면에 "팀 가정" 표시 (CR-06) (완료) |
| 30 | `archive/2026-10-31-update-rejudge-busy` | 비교 제품을 바꿔 다시 판정하는 동안 화면 가운데 "다시 판정 중" 안내, 다른 단추 막기 (완료) |
| 31 | `archive/2026-10-31-update-proposal-actions` | 입찰 영향 탭 채택·버림 단추와 알림(전달 담당·사유), 채택·버린 줄 색 (완료) |
| 32 | `archive/2026-10-31-update-sentence-josa` | 자리표시자 뒤 조사를 채운 값에 맞춰 고르기("GIS-145-40은") (완료) |
| 33 | `archive/2026-10-31-update-document-reuse-race` | 같은 파일을 거의 동시에 올려 문서 저장이 겹치면 먼저 저장된 결과를 다시 씀 (완료) |
| 34 | `archive/2026-10-31-reject-unjudged-registration` | 판정 대상(묶음 A·B) 문서가 하나도 없으면 등록 거절, 등록 화면 안내·다음 막기 (완료) |
| 35 | `archive/2026-10-31-add-run-control` | 처리 중 검토 취소, 실패·취소한 검토 다시 시도(처리한 문서는 다시 씀). 0018 (완료) |
| 36 | `archive/2026-10-31-add-run-log` | 실행 기록: 단계별 시간·AI 호출·재시도·토큰·추정 비용(팀 가정)·재사용 문서, 지식 관리 > 실행 기록 화면. 0019 (완료) |
| 37 | `archive/2026-10-31-add-product-photos` | 제품표 상세에 LS ELECTRIC 공식 제품 계열 사진과 출처 링크 (완료) |
| 38 | `archive/2026-10-31-update-role-handoff-mail` | 협조 요청을 시스템이 부서 메일로 보냄(판정 확정·채택 때, [보내기]·[다시 보내기]), 엔지니어가 회신 받음 기록, 협조 요청 화면 상태 바꿈, Mailpit. 0017 (완료) |
| 39 | `archive/2026-10-31-add-product-docs` | 제품표 상세 "문서" 탭: 공식 자료실 카탈로그·매뉴얼·시험 성적서·인증서 링크 (완료) |
| 40 | `archive/2026-10-31-add-cost-conditions` | FR-16 비용 조건 요약: 비용 영향 유형 규칙 18줄(지체상금·하자 보증·예비품·운반·시험 입회 등), 상업 조건 탭을 실제 데이터로(종류 칩, 협조 요청 상태, 손실 환산·일탈 상업 영향). 금액 계산 없음 (완료) |
| 41 | `archive/2026-10-31-add-submission-package` | 영업 인계: 데이터시트 "영업에 넘기기"(엔지니어, 후보 칸 0일 때 영업 메일), 결재 승인 뒤 인계 패키지 zip(일탈·질의 Word, TBE·데이터시트 엑셀) 내려받기·영업 메일, 넘긴 기록. 0020 (완료) |
| 42 | `archive/2026-10-31-update-check-display` | 판정 탭에 공학 검산(FR-12) 표시: 위반·확인 필요 줄 꼬리표, 위 안내 줄 수, 패널·상세 창 계산식(예: 50 kA × 2.5 = 125 kA). 화면만 (완료) |
| 43 | `archive/2026-11-01-update-read-check-empty` | 문서 읽기 점검이 0줄이면 "모든 문서를 끝까지 읽었습니다"와 살핀 것, 머리 "읽지 못한 곳 없음". 화면만 (완료) |
| 44 | `archive/2026-11-01-add-product-export` | 제품표 화면 "내보내기": 거른 제품을 엑셀로(빈 칸 그대로, 팀 가정 칸·줄 색, 시각 없음). 가져오기는 하지 않음 (완료) |
| 45 | `archive/2026-11-01-add-document-addendum` | 검토에 문서(정정본·Addendum) 추가: 담당자 확인 단계에 엔지니어가 docx를 더하면 같은 검토를 다시 분석(처리한 문서 다시 씀), 같은 줄의 확정·수정·반려·위험 조건 확인 이어받기, "문서 n개" 창 "문서 추가". 0021 (완료) |
| 46 | `archive/2026-11-01-add-past-compare` | 지난 RFP 비교 탭을 실제 데이터로: 같은 고객사의 지난 검토와 판정 줄을 설비·항목으로 짝지어 값 바뀜·새로 생김·사라짐과 판정 변화, 코드가 쓴 참고 문장. 마지막 예시 탭 없앰 (완료) |
| 47 | `archive/2026-11-01-update-llm-concurrency` | 효율 개선: AI 40줄 묶음·위험 조건 설명을 정해진 개수(기본 4, `RFP_LLM_WORKERS`)만큼 동시에 묻고 답은 순서대로, AI 요청 시간 제한(기본 120초). 결과는 차례로 할 때와 같음(NFR-10) (완료) |
| 48 | `archive/2026-11-01-update-review-list-approval` | 검토 목록 담당 범위 "내가 올린 결재": 상신한 검토를 결재 대기·반려·승인 칩과 결재자·상신 n일째로, 요약 줄 "결재 대기 n" 누르면 거름, 홈 링크. 실행 목록 응답에 가장 최근 상신 정보 (완료) |
| 49 | `archive/2026-11-01-update-review-ratio-hand-fill` | AR-03 안 1: 제품표에 연결되지 않은 보증값 빈칸(NOT_MAPPED)은 확인 필요 비율에서 빼고 "직접 작성할 칸 n개"로 요약 칸·결재 확인 줄에 표시. 판정·보증값은 그대로 (완료) |
| 50 | `archive/2026-11-01-add-evaluation` | 정답지·채점: 유형 정답지 CSV 넣기(`rfp-db load-answer-key`, Claude 초안은 "사람 확인 전"), 사람이 확정·수정한 판정과 정답지로 K4·K5·K6·K11·K12·K13·처리 시간을 코드로 재고 채점 기록(개선 전후). 정답지·채점 화면 실제화. 0022 (완료) |
| 51 | `archive/2026-11-01-add-review-memory` | 효율 개선(사람 확정 답 재사용): 같은 요구·항목·요구값·비교 제품을 다른 검토에서 사람이 확정·수정했으면 판정 탭에 "지난 확정" 힌트(판정·검토 번호·사람·사유), 다르면 "지난 확정과 다름" 칩으로 거름. 판정 값은 그대로 (완료) |
| 52 | `archive/2026-11-01-add-rule-suggestion` | 사전에 추가 제안: 위험 조건 탭에서 놓친 표현을 문서 위치와 함께 제안, 판정 규칙 화면에서 엔지니어·승인자가 반영(위험 표현 사전·고침 이력)·반려. 0023 (완료) |
| 53 | `archive/2026-11-01-add-review-assistant` | FR-17 검토 도우미(읽기 전용 에이전트): 검토 상세 "검토 도우미" 창에서 자연어로 물으면 AI가 요구사항 찾기·판정 찾기·한 줄 보기만 써서 답하고, 코드가 근거 번호·숫자를 대조해 어긋난 문장은 뺌. 답마다 원문 위치, AI 없으면 글자로 찾기 (완료) |
| 54 | `archive/2026-11-01-update-ai-answer-checks` | AI 답 검사 보강(A1~A4): 묶음 답 줄 번호로 맞춤, 초안은 자리표시자를 모두 써야 하고 아니면 그 줄만 코드 문장, 위험 설명 숫자·배수 말은 그 문장 근거 조각에서만, 버린 설명 이유 저장·실행 기록 "AI 설명 버림 n". 0024 (완료) |
| 55 | `archive/2026-11-01-update-bulk-confirm-guard` | 한꺼번에 확정 가드(A5): 검산 위반·확인 필요, 목록 문장 숫자 불일치, 비교 값이 빈 줄은 빼고 확정, 뺀 줄 수·이유 알림, 모두 빠지면 거절 (완료) |
| 56 | `archive/2026-11-01-update-type-context` | AI 유형 질문에 줄마다 절 번호·제목, 표 이름, 표 안 구분 행 제목 문맥(A6). 프롬프트 판 p3(같은 파일도 새로 분석). 전후 K13은 로컬 채점 (완료) |
| 57 | `archive/2026-11-01-update-llm-retry-kinds` | AI 오류 종류별 처리(B6): 연결·시간 초과·서버 오류만 재시도, 형식 오류는 다시 묻지 않고 묶음은 바로 나눔·설명은 FORMAT_ERROR로 버림·초안은 코드 문장, 키·모델 설정 오류는 바로 멈춤. 0025 (완료) |
| 58 | `archive/2026-11-01-add-claim-verifier` | 위험 설명 검증 에이전트(B2): AI가 쓴 위험 설명 문장마다 두 번째 AI(검증자)가 근거 조각이 문장을 뒷받침하는지 YES·NO·UNSURE로 답하고, 하나라도 아니면 "AI 검증: 확인 필요" 꼬리표·실행 기록 "검증 확인 필요 n". 판정·후보는 그대로. 0026 (완료) |
| 59 | `archive/2026-11-01-add-requirement-answer-key` | 요구사항 정답지(B1): 공급사 답안 문서의 C/D/E 표시 표 조항 줄을 코드가 정답으로(`rfp-db make-answer-key`, 코드 자동·사람 확인 전, DB에만), 합성 154 kV GIS 정답지 CSV(`data/seed/answer_keys/`, `load-answer-key --kind REQ --doc`). 채점에서 고르면 K1·K2·K3·K10, 판정 없는 검토도 채점. 0027 (완료) |
| 60 | `archive/2026-11-01-add-meaning-search` | 뜻으로 찾기(B3·B4·B5): 분석 끝에 문장 벡터(gemini-embedding-001, 768차원)를 DB에 글자 해시로 저장(새 서버 없음), 항목 연결 후보(판정 규칙 화면, 사람이 같은 뜻 표현으로 추가), 뜻이 비슷한 지난 확정(0.92), 사전 추가 후보(위험 조건 탭, 0.72). 후보·힌트만, 실패해도 분석 계속. 0028 (완료) |
| 61 | `archive/2026-11-01-add-ai-mode` | AI 사용 방식 설정(C5): `RFP_AI_MODE` gemini(외부)·local(사내 OpenAI 호환 주소)·off(규칙만, 키가 있어도 안 보냄). `/api/health`에 방식·모델·외부 전송, 검토 등록·실행 기록에 한 줄. 마이그레이션 없음 (완료) |
| 62 | `archive/2026-11-01-add-handoff-questions` | 협조 요청 메일에 부서 관점 확인 질문(C4): 메일을 보낼 때 요청마다 견적·품질·영업 관점 "확인할 점" 한 문장을 AI가 씀(숫자 금지, 틀리면 부서 기본 문장, AI 없음·실패해도 메일은 나감). 본문·엑셀·협조 요청 상세에 "AI 작성"·"기본 문장". 0029 (완료) |
| 63 | `archive/2026-11-01-add-type-examples` | 사람 유형 고치기와 확정 예시(C3, RAG): 판정 상세·협조 요청 상세에서 엔지니어·승인자가 주 유형을 고침(근거 사람, 이력, 담당 전달 다시 만듦). AI 유형 질문에 다른 문서의 사람 고친 줄 중 뜻이 가까운 것(0.80, 최대 2개)을 "사람이 고른 예"로, 정답지 문장 제외. 프롬프트 판 p4, 실행 기록 "유형 예시 n줄" (완료) |
| 64 | `archive/2026-11-01-add-ui-foundation` | 프런트 공통 기반: 디자인 토큰(`tokens.css`, lint가 색 값 막음), 공통 부품(`src/ui/` 표 순번·배지·단추 잠김 이유·창·알림 쌓기), 부품 견본 `#/dev/ui`, 프런트 원칙 문서. 화면만 (완료) |
| 65 | `archive/2026-11-01-update-header-progress` | 머리글 분석 진행 표시(SCR-00 v4.96): 처리 중 검토가 있으면 모든 화면 머리글에 "분석 n건 · p %" 단추와 작은 창(단계·막대·지난 시간·멈춤), 끝나면 알림 쌓기에 "분석이 끝났습니다"·실패는 "멈췄습니다". 화면만 (완료) |
| 66 | `archive/2026-11-01-update-graph-stops` | 흐름 안의 멈춤 지점(C2): 처리 흐름이 담당자 확인·승인 대기·반려됨에서 LangGraph interrupt로 실제로 멈추고 상신·승인·반려·상신 취소·다시 확인·문서 추가가 그 자리에서 이어 감(갈 곳은 코드 표). 흐름 상태를 단계마다 PostgreSQL에 저장(checkpoint)해 실패·취소한 검토를 다시 시도하면 멈춘 단계부터 이어서, 실행 기록 `resumed_from`. 마이그레이션 번호 없음(라이브러리 표) (완료) |
| 67 | `archive/2026-11-01-add-document-processors` | 문서 종류별 처리기(C1): 종류마다 AI 문장 구분·유형 질문에 넣는 문서 종류 설명과 처리 뒤 점검 기준을 코드 표로(추출 규칙은 같음, 프롬프트 판 p5), 점검에 걸리면 일반 처리기로 한 번만 다시 처리·확인 필요, 문서끼리 동시 처리(`RFP_DOC_WORKERS` 기본 2, 저장은 올린 순서대로라 결과 같음). 문서 표·실행 기록 칸. 0030 (완료) |
| 68 | `archive/2026-11-01-update-detail-header` | 검토 상세 머리글(SCR-08 v4.96): 제목 줄·내보내기 ▾, 정보 3묶음(검토·사업·판정 진행, 상신 권장일), 탭 5개 + 더 보기, 아래 행동 줄(준수 모두 확정·빈 작성 칸·결재 상신). 요약 칸 없앰(확인 필요 비율은 결재 상신 창). 화면만 (완료) |
| 69 | `archive/2026-11-01-add-judgment-view` | 판정 상세 화면(SCR-08-12 v4.96): 판정 줄을 누르면 `#/reviews/:id/judgments/:jid`(거르기는 주소로), 원문 그 줄 앞뒤 2줄·위치 탭(새 API `GET /runs/{id}/documents/{file_no}/lines`, 분석 때와 같은 줄 번호, 파일 없으면 저장된 줄만)·비교 방향·제품값 출처·팀 가정·찾은 방법과 신뢰도, ↑↓·Esc, 제안대로 확정(다음 판정으로)·판정 바꾸기 창. 판정 창 없앰. 마이그레이션 없음 (완료) |
| 70 | `archive/2026-11-01-update-todo-search` | 협조 요청 화면(SCR-13 v4.96): 탭 옆 부서별 건수, 검색 영역(사업·RFP 검토·회신·수신 주소·검색어)과 조건 칩, 요약 줄 누르면 거름, 회신 시각·회신 기한(지나면 빨강), 담당별·RFP별(검토마다 접는 묶음, 회신 m / n), 엔지니어 [재요청](resend), 거른 요청 엑셀 내보내기(`POST /assignments/export`). 마이그레이션 없음 (완료) |
| 71 | `archive/2026-11-01-add-product-view` | 제품표 빠른 보기와 제품 상세 화면(SCR-16·16-1 v4.96): 줄을 누르면 빠른 보기(핵심 정격, 값이 없어 막힌 판정, 지금 쓰이는 검토, 대신 쓸 수 있는 제품), 코드를 누르면 `#/products/:code`(요약 칸·사진·문서·정격·치수·쓰인 곳·현장 이력), 요구 조건으로 찾기·RFP 검토 찾기. 판정 줄에 `item_key`·`due_date`. 마이그레이션 없음 (완료) |
| 72 | `archive/2026-11-01-update-home-projects` | 홈·사업 현황·사업 상세(SCR-03·04·05 v4.96): 홈 나의 업무 세 칸·오늘 할 일(내 차례 3건, 이유·판정 확인·다시 시도·결재 보기)·나의 검토 일정(7일 달력에 제출 마감·상신 권장, 단계별·사업별)·어제 이후 바뀐 것, 실패 알림 [재시도] 켬. 사업 현황 요약 칸 설명 줄·누르면 거르기, 사업 상세 "인계 패키지 보기" 창. 화면만 (완료) |
| 73 | `archive/2026-11-01-add-revision-notice` | 개정 안내 띠(Q5): 문서를 더해 다시 판정하면 같은 줄 기준 바뀜·추가·사라짐을 `graph_state.revision`에 남김(`RunSummary`·`RunListItem.revision`, 판정 `revised`, `?revised=true`). 판정 탭 위 띠·[바뀐 줄만 보기]·닫기, "바뀜(개정)" 꼬리표, 제목 "개정 n 반영", 홈 바뀐 것에 문서 추가. 마이그레이션 없음 (완료) |
| 74 | `archive/2026-11-01-add-query-sent` | 질의 보냄 표시(Q4): 질의 후보 판정에 엔지니어가 "질의 보냄"을 표시·되돌림(`POST /actions` `QUERY_SENT`·`QUERY_UNSENT`, 담당자 확인 단계, 이력), 판정 `query_sent_at`·`query_sent_by_name`, 문서 추가 뒤에도 같은 줄로 옮김. 판정 상세 단추·판정 표 꼬리표. 0031 (완료) |
| 75 | `archive/2026-11-01-add-screen-summary` | 요약 상자(Q1): 검토 상세 제목 줄 아래·홈 나의 업무 아래 "요약" 상자("코드가 씀", 요약 시각, [다시 요약]). `GET /runs/{id}/summary`(반려·승인, 꼭 볼 것·상신 권장일, 먼저 볼 일탈 링크, 개정, 빈 작성 칸, 최대 4문장)·`GET /home/summary?user_id=`(내 차례 수 = "내가 처리할 건", 멈춘·결재 중·협조 대기, 부서는 회신 안 한 요청). 코드가 틀에 채움, AI 없음. 마이그레이션 없음 (완료) |
| 76 | `archive/2026-11-01-add-spec-trace` | 스펙 기준 검증(SDD 5단계): 추적표 `docs/추적표.md`(FR → 스펙 시나리오 → 화면 수용 기준 → 컴포넌트 → 테스트, 이름이 같으면 잇기, `npm run trace`·CI `check:trace`), 핵심 흐름 e2e "RFP 한 건 처음부터 끝까지", 목업 v4.96 26화면 나란히 찍기·영역 배치 점검(`compare-out/layout.json`). 마이그레이션 없음 (완료) |
| 77 | `archive/2026-11-02-update-partial-reprocess` | 점검에서 떨어진 부분만 다시 묻기(C1 이어서): 처리기마다 다시 물을 AI 단계(`fix`) — 요구사항 0줄 점검은 요구 문장이 다 빠진 절의 문장 구분만, 시험 유형 0줄 점검은 유형 NONE 줄만 일반 처리기로 한 번 다시 묻고 나머지는 첫 답, 표 칸·C/D/E 점검(입찰 서식·공급사 사양서)은 다시 묻지 않음. `processor`는 처음 고른 처리기, 문서 `reprocessed_lines`·실행 기록 `lines_reprocessed`. 0032 (완료) |

## 3. 작업 흐름

### 이미 있는 change를 구현할 때

1. `openspec list`로 change를 확인하고 `openspec show <change>`로 읽는다. proposal → specs → design → tasks 순서.
2. 브랜치를 만든다: `feat/<change>` 또는 작업을 나눴으면 `feat/<change>-<묶음 번호>` (예: `feat/add-document-pipeline-3`).
3. `tasks.md`의 작업을 위에서부터 한다. 끝낸 작업은 바로 `- [x]`로 바꾼다.
4. **Scenario마다 자동 테스트가 하나 이상** 있어야 한다. 테스트 이름이나 docstring에 Scenario 이름을 적는다.
5. 구현하다가 스펙이 틀렸거나 모자라면 코드만 고치지 말고 change의 `specs/`를 먼저 고친다. 결정이 바뀌면 `design.md`에 적는다.
6. 모든 작업이 `[x]`이고 검사가 통과하면 `openspec archive <change> --yes`로 `openspec/specs/`에 반영하고 PR을 올린다.

Claude Code에서는 같은 일을 `/opsx:apply <change>`, `/opsx:archive <change>`로 할 수 있다 (`.claude/skills/openspec-*`).

### 새 기능이나 스펙 변경이 필요할 때

1. `openspec list --specs`로 비슷한 capability가 있는지 본다. 있으면 그 이름을 그대로 쓴다.
2. `openspec new change <동사-명사>` (예: `add-engineering-check`, `update-risk-dictionary`)로 만들고 proposal → specs → design → tasks를 쓴다. Claude Code에서는 `/opsx:propose`.
3. `openspec validate <change> --strict`가 통과하면, 구현 전에 PR이나 팀 확인으로 스펙부터 합의한다.

### 여러 사람이 한 change를 나눌 때

`tasks.md`의 `## N.` 묶음 단위로 나눈다. 묶음 제목 옆에 담당을 적는다 (예: `## 3. FR-02 구조 나누기 (BE 나송주)`).
같은 파일을 여러 브랜치에서 고치지 않도록, 묶음마다 `backend/src/rfp_agent/pipeline/<단계>.py`처럼 파일을 나눈다.
archive는 마지막 묶음을 끝낸 사람이 한다.

## 4. 스펙 쓰는 법

- 요구사항: `### Requirement: <이름>` + `SHALL`/`MUST` 문장(500자 이하, 한 요구사항에 한 가지 동작).
- 시나리오: `#### Scenario: <이름>` (# 네 개) + `- **WHEN** …` / `- **THEN** …`. 요구사항마다 하나 이상.
- 명세서의 수용 기준(Given–When–Then)은 빠짐없이 Scenario로 옮긴다. Given은 WHEN 문장 안에 쓴다.
- 새 capability의 delta 첫 섹션은 `## Purpose`(50자 이상).
- 스펙에는 동작만 쓴다. 클래스 이름, 라이브러리, 구현 순서는 design.md나 tasks.md에 쓴다.
- 명세서의 `[결정]`, `[제안]`, `[확인 필요]` 표시는 요구사항 끝에 남긴다.

## 5. 꼭 지킬 규칙 (명세서 2장 공통 규칙)

- **CR-01** 숫자 계산, 판정, 후보 고르기, 분기 선택은 코드로만 한다. 언어 모델(Gemini)은 문장 읽기·쓰기만 한다.
- **CR-02·03** 결과 값마다 원문 위치(파일 번호 + 절 또는 표 + 행), 신뢰도, 가정 여부를 저장한다. 위치가 없으면 내보내지 않는다.
- **CR-04·05** 없는 값은 비워 두고 "확인 필요". [REDACTED]는 "값 없음". 언어 모델이 빈칸을 채우게 하지 않는다.
- **CR-06** 팀 가정 값이 들어간 결과에는 항상 "팀 가정" 표시.
- **CR-07** 언어 모델이 쓴 문장의 숫자는 자리표시자로 받고 코드가 채운 뒤 근거 값과 대조한다.
- **CR-08** 위험 조건·일탈·질의·보증값·제안 포인트는 모두 "후보". 확정은 사람(FR-10).
- **CR-09** 판정·보증값은 묶음 A·B 문서만. **CR-10** 단위 환산 금지. **CR-11** 같은 입력이면 같은 결과. **CR-12** AI 오류는 정해진 횟수만 재시도.
- 범위 밖(만들지 않음): 가격 계산·할인, OCR, 단위 환산, 경쟁 제품 비교.

## 6. 코드 규칙

- 백엔드: Python 3.12, FastAPI, Pydantic, psycopg 3, LangGraph. 의존성은 `uv add`로 추가하고 `uv.lock`을 커밋한다.
- 프런트: React 19, Vite, TypeScript. `/api`는 Vite 프록시로 백엔드에 연결된다. 폴더·상태 관리·이름·토큰·공통 부품·오류 처리 규칙은 `docs/screens/_프런트원칙.md`(색은 `src/styles/tokens.css` 변수만).
- DB: 스키마를 바꾸면 `db/migrations/`에 **다음 번호 파일을 추가**한다. 이미 있는 마이그레이션은 고치지 않는다.
- 데이터: 사전·제품표는 `data/seed/`. 고객사 RFP 원문은 `data/private/`에만 두고 **커밋하지 않는다**. 테스트 픽스처에 원문 문장을 길게 옮기지 않는다(필요한 줄만, 고객사명·연락처·단가는 가림).
- API 응답 모양은 `backend/src/rfp_agent/api/schemas.py`의 Pydantic 모델로 정한다(명세 `api-contract`). 응답 칸을 바꾸면 `cd frontend && npm run gen:api`로 `openapi.json`·`src/api.gen.ts`를 다시 만들어 함께 커밋한다.
- 언어 모델 호출은 한 모듈(예: `rfp_agent/llm/`)에서만 하고, 테스트에서는 가짜 응답으로 바꿀 수 있게 한다. 키는 `GEMINI_API_KEY` 환경 변수로만 받는다.
- 코드 주석과 사용자에게 보이는 문구는 한국어, 식별자는 영어.

## 7. 완료 기준 (PR 올리기 전)

```bash
cd backend && uv run ruff check . && TEST_DATABASE_URL=postgresql://rfp:rfp@localhost:5433/rfp_test uv run pytest
cd frontend && npm run lint && npm run check:api && npm run check:trace && npm run build
openspec validate --all --strict
```

- 구현한 change의 `tasks.md`가 모두 `[x]`이고 archive되어 있다.
- PR 설명에 change 이름, 통과한 Scenario, 남은 `[확인 필요]`를 적는다.
- CI(`.github/workflows/ci.yml`)가 같은 검사를 돌린다.
