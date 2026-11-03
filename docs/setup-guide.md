# 내 컴퓨터에서 설치하고 실행하기

이 문서는 조원이 **자기 컴퓨터에서 RFP 기술 검토 지원 프로그램을 켜고 써 보는 방법**을 처음부터 알려 줍니다.
명령어는 그대로 복사해서 붙여 넣으면 됩니다. 순서대로만 따라 오세요.

---

## 0. 먼저 알아 두면 좋은 것

이 프로그램은 세 부분이 같이 움직입니다. 식당에 비유하면 이렇습니다.

| 부분 | 하는 일 | 식당에 비유하면 |
|---|---|---|
| **DB** (PostgreSQL) | 결과를 저장하는 곳 | 창고 |
| **백엔드** (Python) | RFP를 읽고 판정하는 곳 | 주방 |
| **화면** (React) | 우리가 보고 누르는 웹 페이지 | 홀(손님 자리) |

세 개를 하나씩 켜도 되지만, **Docker**를 쓰면 명령 한 줄로 세 개를 한꺼번에 켤 수 있습니다.
Docker는 "프로그램마다 필요한 재료를 상자에 담아 두고, 상자째로 켜 주는 도구"라고 생각하면 됩니다.
그래서 이 문서는 **방법 A (Docker)** 를 추천합니다. 코드를 직접 고치는 사람은 나중에 방법 B도 보세요.

---

## 1. 준비물

| 준비물 | 왜 필요한가 | 받는 곳 |
|---|---|---|
| **Git** | 저장소(코드)를 내려받기 | <https://git-scm.com/downloads> |
| **Docker Desktop** | DB·백엔드·화면을 한 번에 켜기 | <https://www.docker.com/products/docker-desktop/> |
| **GitHub 저장소 권한** | 비공개 저장소라서 초대를 받아야 함 | 팀장(최민정)에게 GitHub 아이디 알려 주기 |
| **RFP 원본 docx** | 검토할 문서 | 팀 공유 폴더 (`RFP_Cleansed_styled_v6.zip`) |
| Gemini API 키 (선택) | AI가 문장을 읽고 쓰는 단계 | 팀장에게 따로 받기. 없어도 실행됨 |
| Tesseract (선택, 로컬 실행만) | 스캔 PDF·그림 속 글자 읽기(OCR). Docker로 켜면 이미 들어 있음 | 맥 `brew install tesseract tesseract-lang`, 윈도우 <https://github.com/UB-Mannheim/tesseract/wiki>. 없어도 실행됨(OCR만 꺼짐) |

설치가 끝나면 **Docker Desktop을 한 번 실행**해 두세요. 고래 아이콘이 "Running(실행 중)"이 되어야 합니다.
윈도우에서 처음 설치하면 WSL 2를 설치하라는 안내가 나올 수 있는데, 안내대로 설치하고 컴퓨터를 다시 켜면 됩니다.

> **명령어는 어디에 쓰나요?**
> 맥은 "터미널" 앱, 윈도우는 "PowerShell"(시작 메뉴에서 검색)을 엽니다. 이 문서의 명령은 두 곳 모두에서 그대로 됩니다.
> 다른 부분만 따로 적어 두었습니다.

---

## 2. 방법 A: Docker로 한 번에 켜기 (추천)

### 2-1. 코드 내려받기

```bash
git clone https://github.com/skkuls-final-team/RFP-agent-service.git
cd RFP-agent-service
```

GitHub 로그인 창이 뜨면 초대받은 계정으로 로그인합니다.
`cd RFP-agent-service`는 "그 폴더 안으로 들어가기"라는 뜻입니다. 앞으로 나오는 명령은 모두 이 폴더 안에서 합니다.

### 2-2. 설정 파일 만들기

```bash
cp .env.example .env
```

`.env`는 프로그램의 비밀 메모장입니다. Gemini 키가 있으면 메모장이나 VS Code로 `.env`를 열어 이렇게 채웁니다.

```
GEMINI_API_KEY=여기에_받은_키
```

키가 없으면 비워 두세요. AI 보조 단계만 건너뛰고 나머지(코드 규칙으로 하는 판정)는 그대로 돌아갑니다.

> ⚠️ `.env`와 키는 **절대 GitHub에 올리지 않습니다.** (`.gitignore`가 막아 두었지만 키를 채팅이나 코드에 붙여 넣지도 마세요.)

### 2-3. RFP 파일 넣기

팀 공유 폴더의 zip을 풀어서 docx 파일들을 `data/private/rfp_docx/` 폴더에 넣습니다.

```bash
mkdir -p data/private/rfp_docx      # 맥
mkdir data\private\rfp_docx         # 윈도우 PowerShell
```

폴더를 만든 뒤 파일 탐색기(Finder)로 docx를 끌어다 넣으면 됩니다. 결과는 이런 모양이어야 합니다.

```
RFP-agent-service/
  data/private/rfp_docx/
    00지역_문서검토_1. Bidding Forms_Draft_교육용클렌징v6.docx
    ... (22개)
```

> ⚠️ RFP는 고객사 문서라 `data/private/` 밖에 두거나 GitHub에 올리면 안 됩니다. 이 폴더는 git이 무시하도록 되어 있습니다.
> 이 단계를 건너뛰어도 화면에서 docx를 직접 올려서 쓸 수 있습니다.

### 2-4. 켜기

```bash
docker compose up --build
```

처음에는 재료를 내려받느라 **5~10분** 걸립니다. 글자가 계속 올라가는 게 정상입니다.
아래 두 줄이 보이면 준비 끝입니다.

```
backend-1   | INFO:     Uvicorn running on http://0.0.0.0:8000
frontend-1  |   ➜  Local:   http://localhost:5173/
```

이 창은 **닫지 말고 그대로 둡니다.** (닫으면 프로그램도 꺼집니다.)

### 2-5. 제품표 넣기 (처음 한 번만)

새 터미널(PowerShell) 창을 하나 더 열고, 같은 폴더로 가서 실행합니다.

```bash
cd RFP-agent-service
docker compose exec backend rfp-db seed-products
```

`[제품표] product_family 4, product_master 122`처럼 나오면 성공입니다.
우리 제품 정보를 창고(DB)에 넣는 단계라서, 이걸 해야 "우리 제품과 비교·판정"이 됩니다.
규칙 사전과 DB 표는 백엔드가 켜질 때 자동으로 만들어 줍니다.

> **예전에 이미 설치한 사람은** 제품표가 바뀌었으니(2026-10-23) 코드를 새로 받은 뒤 한 번 이렇게 실행하세요.
> `docker compose exec backend rfp-db seed-products --replace`
> 예전 제품과 **예전 검토 결과가 모두 지워지고** 새 제품표만 남습니다. 그냥 `seed-products`만 하면 예전 제품이 남아 있다고 알려 줍니다.

### 2-6. 화면 열기

인터넷 브라우저(크롬 추천)에서 <http://localhost:5173> 을 엽니다.
위쪽에 **"DB 정상"** 이 보이면 모두 잘 연결된 것입니다.

---

## 3. 써 보기 (5분 따라 하기)

1. 왼쪽 메뉴 **RFP 관리 → RFP 등록**을 엽니다. 등록은 세 단계입니다.
   - **문서 올리기**: **서버에 둔 RFP에서 고르기**로 `1. Bidding Forms` 파일을 고릅니다. (2-3을 건너뛰었다면 docx를 끌어다 놓습니다)
   - **검토 정보**: 사업명, 마감일 같은 정보를 적습니다.
   - **검토 설정**: 담당 엔지니어를 고르고 **등록하고 분석 시작**을 누릅니다.
2. **RFP 검토** 목록에서 방금 만든 검토를 엽니다. 처리 중이면 단계별 진행 상황이 보입니다. 파일 1은 AI를 쓰면 6분쯤 걸립니다(11-03 측정).
3. 검토 상세의 탭을 하나씩 눌러 봅니다.
   - **판정**: RFP가 요구하는 값과 우리 제품 값을 비교한 결과(준수·일탈·질의·확인 필요). 근거를 누르면 RFP의 원래 위치가 보입니다.
   - **위험 조건**, **문서 읽기 점검**, **상업 조건**, **이력**이 탭 줄에 있고, **더 보기**에 **손실 환산 (참고)**, **입찰 영향**(제안 포인트), **지난 RFP 비교**, **제출본**이 있습니다.
4. 판정 줄을 **확정**하거나 여러 줄을 골라 한꺼번에 확정합니다. 수정·반려할 때는 이유를 적어야 합니다.
5. 머리글의 **결재 상신**을 눌러 결재자를 고르고 올립니다.
6. 오른쪽 위 **사용자**를 "기본 승인자"로 바꾸고 그 검토를 열면 결재 대기 화면이 나옵니다. 의견을 적은 뒤 **승인** 또는 **반려**를 누릅니다.
7. **이력** 탭에서 누가 무엇을 바꿨는지 확인합니다.

> 입찰 이력, 팀 현황, 공지사항, 자료실 같은 화면은 서버 기능이 없어 **예시 데이터**를 보여 줍니다(맨 위에 "예시 화면" 띠). 눌러도 저장되지 않습니다.

> 모든 결과는 AI와 코드가 만든 **"후보"** 입니다. 사람이 확정해야 진짜 결과가 됩니다.

---

## 4. 끄기, 다시 켜기, 처음부터 다시

| 하고 싶은 것 | 명령 |
|---|---|
| 끄기 | `docker compose up`을 켠 창에서 `Ctrl + C` (또는 다른 창에서 `docker compose down`) |
| 다시 켜기 | `docker compose up` (두 번째부터는 빠릅니다) |
| 코드를 새로 받은 뒤 켜기 | `git pull` 다음에 `docker compose up --build` |
| 저장된 결과를 모두 지우고 처음부터 | `docker compose down -v` 다음에 2-4, 2-5를 다시 |

`-v`를 붙이면 창고(DB) 안의 검토 결과가 **모두 지워집니다.** 꼭 필요할 때만 쓰세요.

---

## 5. 방법 B: 직접 실행하기 (코드를 고치는 사람용)

코드를 고치면서 바로바로 확인하려면 백엔드와 화면은 내 컴퓨터에서 직접 켜고, DB만 Docker로 켜는 방법이 편합니다.

**추가 준비물**: [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python 3.12를 알아서 받아 줍니다), [Node.js 22](https://nodejs.org/)

```bash
# 1) DB만 켜기 (저장소 폴더에서)
docker compose up -d db

# 2) 백엔드 (새 창)
cd backend
uv sync                    # 필요한 Python 재료 설치
uv run rfp-db setup        # DB 표 만들기 + 규칙 사전 + 제품표 넣기
uv run uvicorn rfp_agent.api.main:app --reload    # http://localhost:8000

# 3) 화면 (또 새 창)
cd frontend
npm install
npm run dev                # http://localhost:5173
```

백엔드는 저장소 맨 위의 `.env`를 자동으로 읽으니 2-2에서 만든 파일을 그대로 씁니다.
Docker DB는 내 컴퓨터의 **5433번**으로 열립니다. 2026-10-23 전에 `.env`를 만들었다면 `DATABASE_URL`의 `5432`를 `5433`으로 고쳐 주세요.
`--reload` 덕분에 Python 코드를 저장하면 백엔드가 알아서 다시 켜지고, 화면도 저장하면 바로 바뀝니다.

명령으로만 검토를 돌려 볼 수도 있습니다.

```bash
cd backend
uv run rfp-review run "../data/private/rfp_docx/00지역_문서검토_1. Bidding Forms_Draft_교육용클렌징v6.docx"
uv run rfp-review status 1
```

### 테스트 돌리기 (PR 올리기 전)

테스트는 DB를 **지웠다가 다시 만들기** 때문에, 개발용 DB(`rfp`)와 다른 테스트용 DB(`rfp_test`)를 씁니다.

```bash
# 테스트용 DB 한 번 만들기
docker compose exec db createdb -U rfp rfp_test

# 백엔드 검사와 테스트
cd backend
uv run ruff check .
TEST_DATABASE_URL=postgresql://rfp:rfp@localhost:5433/rfp_test uv run pytest
```

윈도우 PowerShell에서는 마지막 줄을 이렇게 씁니다.

```powershell
$env:TEST_DATABASE_URL="postgresql://rfp:rfp@localhost:5433/rfp_test"; uv run pytest
```

화면 검사와 스펙 검사:

```bash
cd frontend && npm run lint && npm run build
npx -y @fission-ai/openspec@1.14.3 validate --all --strict      # 저장소 맨 위 폴더에서
```

코드를 고치는 규칙(스펙 먼저 쓰기, 브랜치 이름, PR 순서)은 [AGENTS.md](../AGENTS.md)에 있습니다.

---

## 6. 막혔을 때

| 이런 일이 생기면 | 이렇게 해 보세요 |
|---|---|
| `Cannot connect to the Docker daemon` / `docker: command not found` | Docker Desktop이 켜져 있는지 확인. 고래 아이콘이 "Running"이 될 때까지 기다린 뒤 다시 |
| `port is already allocated` 또는 `address already in use` (5433) | 다른 프로그램이 5433번을 쓰는 중. `lsof -nP -iTCP:5433 -sTCP:LISTEN`(맥)으로 찾아서 끄거나, `docker-compose.yml`의 `"5433:5432"` 앞 숫자를 다른 번호(예: `5434`)로 바꾸고 `.env`의 주소도 같은 번호로 |
| 같은 오류인데 8000이나 5173 | 예전에 켜 둔 컨테이너나 백엔드·화면이 그 번호를 쓰는 중. [최신 코드 받아서 켜기](pull-and-run.md)의 5장 참고 |
| `git clone`에서 `Repository not found` | 저장소 초대를 아직 수락하지 않았거나 다른 계정으로 로그인함. GitHub 메일함의 초대 수락 |
| 화면이 하얗거나 "백엔드에 연결할 수 없습니다" | 첫 실행은 화면 준비(`npm ci`)에 몇 분 걸림. `frontend-1 … Local: http://localhost:5173/`가 보일 때까지 기다린 뒤 새로 고침 |
| "서버에 둔 RFP" 목록이 안 보임 | `data/private/rfp_docx/`에 docx가 없음. 2-3 확인. 폴더 이름 철자(`rfp_docx`)도 확인 |
| 판정 탭의 비교 제품이 비어 있고 대부분 "확인 필요" | 제품표를 안 넣음. 2-5의 `seed-products` 실행 후 검토를 새로 시작 |
| 위쪽에 "언어 모델 키 없음" | 정상입니다. 키가 없으면 AI 보조 단계만 건너뜀. 키를 넣으려면 `.env` 수정 후 `docker compose up` 다시 |
| 코드를 새로 받았더니 오류 | `docker compose up --build`로 다시 만들기. 방법 B라면 `uv sync`, `npm install`, `uv run rfp-db migrate` |

그래도 안 되면 오류 문장 마지막 몇 줄을 복사해서 팀 채팅에 올려 주세요. (키나 RFP 원문 내용은 빼고요.)

---

## 7. 꼭 지킬 것 세 가지

1. **RFP 원문은 `data/private/` 안에만.** GitHub, 팀 채팅 밖, 테스트 파일에 원문을 길게 옮기지 않습니다.
2. **API 키는 `.env`에만.** 코드나 채팅에 붙여 넣지 않습니다.
3. **결과는 모두 "후보".** 사람이 확인·승인한 것만 바깥으로 내보냅니다.
