# 최신 코드 받아서 켜기 (팀원용)

이미 한 번 설치해 본 팀원이 **최신 main을 받아서 화면을 켜는 방법**입니다.
처음 설치하는 사람은 먼저 [내 컴퓨터에서 설치하고 실행하기](setup-guide.md)의 1~2장(준비물, `.env`, RFP 파일 넣기)을 하고 오세요.

명령은 모두 저장소 맨 위 폴더(`RFP-agent-service`)에서 합니다. 맥은 "터미널", 윈도우는 "PowerShell"에 그대로 붙여 넣으면 됩니다.

---

## 1. 무엇이 바뀌었나 (2026-10-29 기준)

| 바뀐 것 | 내게 필요한 일 |
|---|---|
| 화면이 목업 v4.57 모양으로 바뀜(왼쪽 메뉴, 화면 24개) | 없음. 켜면 바로 보임 |
| DB 표가 3개 늘어남(검토 정보, 결재, 문서 읽기 점검. 마이그레이션 0009~0011) | Docker는 켤 때 자동. 직접 켜는 사람은 `rfp-db setup` |
| 서버 응답 모양을 정해 둠(API 스키마), 화면 타입을 자동 생성 | 서버 응답 칸을 고치는 사람만 `npm run gen:api` |

---

## 2. 방법 A: Docker로 켜기 (추천)

### 2-1. 예전에 켜 둔 것 모두 끄기

예전 컨테이너가 남아 있으면 `port is already allocated` 오류가 납니다. 먼저 끕니다.

```bash
docker compose down
docker ps                     # 남은 컨테이너가 있는지 보기
```

`docker ps`에 `8000`, `5173`, `5433`을 쓰는 컨테이너가 남아 있으면 끕니다. 폴더 이름이 달라서 `docker compose down`이 못 끈 예전 컨테이너일 수 있습니다.

```bash
docker stop <NAMES 칸의 이름>
```

직접 켜 둔 백엔드(`uvicorn`)나 화면(`npm run dev`) 창이 있으면 그 창에서 `Ctrl + C`로 끕니다.

### 2-2. 최신 코드 받기

```bash
git checkout main
git pull
```

`git pull`에서 "내 변경이 덮어씌워진다"는 오류가 나면, 내가 고친 파일이 있다는 뜻입니다. 필요 없으면 `git stash`로 치워 두고 다시 `git pull` 하세요.

### 2-3. 켜기

```bash
docker compose up --build
```

`--build`를 꼭 붙입니다. 새 코드로 백엔드 상자를 다시 만들어야 하기 때문입니다. 백엔드가 켜질 때 새 DB 표(마이그레이션)와 규칙 사전을 알아서 넣습니다.
아래 두 줄이 보이면 준비 끝입니다. 이 창은 닫지 말고 둡니다.

```
backend-1   | INFO:     Uvicorn running on http://0.0.0.0:8000
frontend-1  |   ➜  Local:   http://localhost:5173/
```

### 2-4. 제품표 넣기 (DB를 처음 만들었을 때만)

새 창을 열고 실행합니다. 이미 넣어 둔 사람은 건너뛰어도 됩니다(다시 해도 괜찮습니다).

```bash
docker compose exec backend rfp-db setup
```

### 2-5. 화면 열기

브라우저(크롬 추천)에서 <http://localhost:5173> 을 엽니다. 서버 응답 모양은 <http://localhost:8000/docs> 에서 볼 수 있습니다.

---

## 3. 방법 B: 직접 켜기 (코드를 고치는 사람용)

DB만 Docker로 켜고, 백엔드와 화면은 내 컴퓨터에서 켭니다. 창을 세 개 씁니다.

```bash
# 창 1: DB
git checkout main && git pull
docker compose up -d db

# 창 2: 백엔드
cd backend
uv sync                    # 새 Python 재료 받기
uv run rfp-db setup        # 새 DB 표(0009~0014) + 규칙 사전 + 제품표 (화면에서 고친 규칙은 남음)
uv run uvicorn rfp_agent.api.main:app --reload    # http://localhost:8000

# 창 3: 화면
cd frontend
npm install                # 새 재료 받기
npm run dev                # http://localhost:5173
```

윈도우 PowerShell에서 `.env` 없이 DB 주소를 넣으려면 창 2에서 먼저 `$env:DATABASE_URL="postgresql://rfp:rfp@localhost:5433/rfp"`를 실행합니다. 맥은 `export DATABASE_URL=postgresql://rfp:rfp@localhost:5433/rfp`입니다.

사업 현황 화면을 바로 보고 싶으면 예시 사업을 만들 수 있습니다(파일마다 분석을 한 번씩 돌립니다).

```bash
uv run rfp-db demo-businesses --business "Demo 145 kV 변전소" a.docx b.docx --business "Demo 저압 배전반" c.docx
```

서버 응답 칸(`backend/src/rfp_agent/api/schemas.py`)을 고쳤다면 화면 타입도 다시 만들어 함께 커밋합니다.

```bash
cd frontend && npm run gen:api
```

---

## 4. 써 보기 (5분 따라 하기)

1. 왼쪽 메뉴 **RFP 관리 → RFP 등록**을 엽니다. 등록은 세 단계입니다.
   - **문서 올리기**: docx를 끌어다 놓거나, **서버에 둔 RFP에서 고르기**로 `data/private/rfp_docx`의 파일을 고릅니다.
   - **검토 정보**: 사업명, 마감일 같은 정보를 적습니다.
   - **검토 설정**: 담당 엔지니어를 고르고 **등록하고 분석 시작**을 누릅니다.
2. **RFP 검토** 목록에서 방금 만든 검토를 엽니다. 처리 중이면 단계별 진행 상황이 보이고, 끝나면 검토 상세가 열립니다.
3. 검토 상세의 탭을 하나씩 눌러 봅니다. **판정**, **문서 읽기 점검**, **위험 조건**, **손실 환산 (참고)**, **입찰 영향** 등이 있습니다. 근거를 누르면 RFP의 원래 위치가 보입니다.
4. 판정 줄을 **확정**하거나 여러 줄을 골라 한꺼번에 확정합니다. 수정·반려할 때는 이유를 적습니다.
5. **결재 상신**을 눌러 결재자를 고르고 올립니다.
6. 오른쪽 위 사용자를 결재자로 바꾸고 그 검토를 열면 결재 대기 화면이 나옵니다. **승인** 또는 **반려**를 누릅니다.

> 입찰 이력, 정답지·채점, 팀 현황, 공지사항, 자료실 같은 화면은 아직 서버 기능이 없어 **예시 데이터**를 보여 줍니다. 눌러도 실제로 저장되지 않습니다.
> 결과는 모두 AI와 코드가 만든 **"후보"** 입니다. 사람이 확정해야 진짜 결과가 됩니다.
> Gemini 키가 없으면 AI 보조 단계만 건너뛰고 코드 규칙 결과만 나옵니다.

---

## 5. 막혔을 때

| 이런 일이 생기면 | 이렇게 해 보세요 |
|---|---|
| `Bind for 0.0.0.0:8000 failed: port is already allocated` | 다른 컨테이너가 8000번을 쓰는 중. `docker ps --format "table {{.Names}}\t{{.Ports}}"`로 찾아 `docker stop <이름>` 후 다시 `docker compose up --build` |
| 맥에서 `lsof -i :8000`을 쳤더니 `com.docker`가 나옴 | Docker 자신이 아니라 **Docker 안의 다른 컨테이너**가 쓰는 것. 위 줄처럼 컨테이너를 찾아 끕니다. Docker Desktop은 끄지 마세요 |
| 같은 오류인데 Docker가 아님 | 예전에 직접 켜 둔 백엔드·화면. 그 창에서 `Ctrl + C`, 또는 맥 `kill <PID>`, 윈도우 `taskkill /PID <PID> /F` (PID는 맥 `lsof -i :8000`, 윈도우 `netstat -ano \| findstr :8000`) |
| 5433번에서 같은 오류 | 내 컴퓨터에 PostgreSQL이 따로 켜져 있음. 끄거나 `docker-compose.yml`의 `"5433:5432"` 앞 숫자를 바꾸고 `.env` 주소도 같은 번호로 |
| 화면에 `column ... does not exist` 같은 서버 오류 | 새 DB 표가 안 들어감. Docker는 `docker compose up --build` 다시, 직접 켜는 사람은 `uv run rfp-db setup` |
| 화면이 하얗거나 "백엔드에 연결할 수 없습니다" | 첫 실행은 화면 준비(`npm ci`)에 몇 분 걸림. `Local: http://localhost:5173/`가 보인 뒤 새로 고침 |
| 판정의 비교 제품이 비어 있고 대부분 "확인 필요" | 제품표가 없음. 2-4의 `rfp-db setup` 후 검토를 새로 등록 |
| 예전 검토 결과가 이상하게 보임 | 예전 코드로 만든 결과일 수 있음. 새로 등록해서 다시 돌리기. 모두 지우려면 `docker compose down -v` (DB 안의 결과가 **모두 지워짐**) 후 2-3부터 |

그래도 안 되면 오류 문장 마지막 몇 줄을 팀 채팅에 올려 주세요. API 키와 RFP 원문 내용은 빼고 올립니다.

---

## 6. 꼭 지킬 것

1. **RFP 원문은 `data/private/` 안에만** 둡니다. GitHub에 올리지 않습니다.
2. **API 키는 `.env`에만** 둡니다. 코드나 채팅에 붙여 넣지 않습니다.
3. **결과는 모두 "후보"** 입니다. 사람이 확인·승인한 것만 바깥으로 내보냅니다.
