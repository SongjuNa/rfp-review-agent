# data/private

저장소에 올리지 않는 자료를 두는 곳입니다. 이 파일 말고는 모두 git에서 제외됩니다.
고객사 RFP는 교육용으로 가렸지만 식별 정보가 일부 남아 있어 저장소에 올리지 않습니다 (기획서 5-6).

| 경로 | 내용 | 어디서 받나 |
|---|---|---|
| `rfp_docx/*.docx` | RFP 원본 22개 (RFP_Cleansed_styled_v6) | 팀 공유 폴더 |

Docker Compose는 이 폴더를 백엔드 컨테이너의 `/app/data/private`에 읽기 전용으로 붙입니다.
