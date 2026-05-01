# 테스팅 가이드

이 프로젝트의 모든 테스트 레이어를 설명합니다: 실행 방법, 각 레이어의 커버리지, 상호 관계.

---

## 테스트 레이어 한눈에 보기

| 레이어 | 도구 | 범위 | 실행 시점 |
|---|---|---|---|
| API 통합 테스트 | Bruno | 전체 17개 엔드포인트 E2E | 백엔드 변경 후 |
| 백엔드 단위 테스트 | `cargo test` | 포맷 감지 등 내부 로직 | 개발 중 |
| CI 파이프라인 | GitHub Actions | 빌드, 마이그레이션, 테스트, 타입체크 | push / PR 시 |
| 수동 검증 | curl | 빠른 헬스체크, 토큰 조작 | 임시 디버깅 |

---

## 1. 로컬 개발 환경 셋업

테스트 실행 전 필수 준비입니다.

### 사전 요구사항

| 도구 | 확인 명령 |
|---|---|
| Docker & Docker Compose | `docker compose version` |
| Rust (stable) | `cargo --version` |
| psql (PostgreSQL 클라이언트) | `psql --version` |
| Python 3 + argon2-cffi | `python3 -c "import argon2"` |
| Node.js (Bruno CLI용) | `node --version` |

미설치 도구가 있으면:

```bash
pip install argon2-cffi
npm install -g @usebruno/cli
```

### 데이터베이스 시작

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps   # Status가 healthy여야 함
```

### 환경 설정

```bash
cp .env.example .env
```

`.env` 편집:

```dotenv
JWT_SECRET=<openssl rand -base64 32로 생성>
DATABASE_URL=postgres://ebook:devpassword@localhost:5432/ebook
BOOKS_PATH=/절대경로/data/books
THUMBS_PATH=/절대경로/data/thumbs
SERVER_PORT=3001
RUST_LOG=debug
```

> `BOOKS_PATH`, `THUMBS_PATH`는 **절대경로**로 설정하세요. 상대경로는 `cargo run` 실행 위치인 `backend/` 기준으로 해석됩니다.

### 데이터 디렉토리 생성

```bash
mkdir -p data/books data/thumbs
```

### 관리자 계정 생성

가입 API가 없으므로 직접 삽입합니다:

```bash
# argon2 해시 생성
HASH=$(python3 -c "
from argon2 import PasswordHasher
print(PasswordHasher().hash('devpassword'))
")

# DB에 삽입
psql postgres://ebook:devpassword@localhost:5432/ebook -c \
  "INSERT INTO users (username, password_hash, role) VALUES ('admin', '$HASH', 'admin');"
```

### 백엔드 실행

```bash
cd backend && cargo run
```

성공 시:

```
INFO ebook_server: running migrations
INFO ebook_server: listening on 0.0.0.0:3001
```

---

## 2. Bruno로 API 테스트

Bruno는 API 통합 테스트의 기본 도구입니다. 7개 폴더, 17개 엔드포인트를 커버합니다.

### 컬렉션 구조

```
bruno-test/
├── annotations/
│   ├── Create Annotation.bru     # POST /api/books/:id/annotations -> annotationId 저장
│   ├── Delete Annotation.bru     # DEL  /api/annotations/:id
│   ├── Export Annotations (JSON).bru
│   ├── Export Annotations (MD).bru
│   ├── List Annotations.bru      # GET  /api/books/:id/annotations
│   └── Update Annotation.bru     # PUT  /api/annotations/:id
├── auth/
│   ├── Health Check.bru          # GET  /api/health
│   ├── Login.bru                 # POST /api/auth/login          -> authToken 저장
│   ├── Logout.bru                # POST /api/auth/logout
│   └── Refresh Token.bru         # POST /api/auth/refresh
├── bookmarks/
│   ├── Create Bookmark.bru       # POST /api/books/:id/bookmarks  -> bookmarkId 저장
│   ├── Delete Bookmark.bru       # DEL  /api/bookmarks/:id
│   └── List Bookmarks.bru        # GET  /api/books/:id/bookmarks
├── books/
│   ├── Download Book.bru         # GET  /api/books/:id/download
│   ├── Get Book Detail.bru       # GET  /api/books/:id
│   └── List Books.bru            # GET  /api/books
├── bruno.json                    # 컬렉션 메타데이터
├── environments/                 # 환경 변수 (baseUrl, 자격증명)
│   └── Local.bru
├── libraries/
│   ├── Create Library.bru        # POST /api/libraries           -> libraryId 저장
│   ├── Delete Library.bru        # DEL  /api/libraries/:id
│   ├── Get Library.bru           # GET  /api/libraries/:id
│   ├── List Libraries.bru        # GET  /api/libraries
│   ├── Scan Library.bru          # POST /api/libraries/:id/scan
│   └── Update Library.bru        # PUT  /api/libraries/:id
├── progress/
│   ├── Get Progress.bru          # GET  /api/books/:id/progress
│   └── Save Progress.bru         # PUT  /api/books/:id/progress  -> bookId 저장
└── reader/
    ├── Serve Cover.bru           # GET  /api/reader/:id/cover
    └── Serve EPUB.bru            # GET  /api/reader/:id/epub
```


### 환경 변수

`environments/Local.bru`에 연결 설정과 런타임 ID를 저장합니다:

```
baseUrl    = http://localhost:3001    # 서버 주소
username   = admin                    # 테스트 유저
password   = devpassword              # 테스트 유저 비밀번호
authToken  = (Login에서 자동 저장)     # JWT 액세스 토큰
libraryId  = (Create에서 자동 저장)    # 라이브러리 UUID
bookId     = (Save에서 자동 저장)      # 책 UUID
annotationId / bookmarkId             # 리소스 ID
```

### 토큰 및 ID 자동 전파

Bruno는 `script:post-response` 블록으로 요청 간 데이터를 자동 연결합니다:

- **Login**이 `access_token`을 `authToken` 환경변수에 저장
- **Create Library**가 응답의 `id`를 `libraryId`에 저장
- **Save Progress** / **Create Annotation** / **Create Bookmark**도 동일 방식으로 ID 전파

이후 요청들은 `{{authToken}}`, `{{libraryId}}` 등으로 이 변수들을 참조합니다.

### 테스트 실행

**CLI (헤드리스)**:

```bash
cd bruno-tests
bru run --environment Local
```

각 요청의 상태코드와 어서션 결과가 출력됩니다.

**GUI (인터랙티브)**:

Bruno 데스크톱 앱에서 `bruno-tests/` 폴더를 엽니다. `Local` 환경을 선택한 뒤 개별 요청 또는 전체 컬렉션을 실행합니다.

### 실행 순서

폴더 순서대로(auth 먼저, 그 다음 libraries, books 등) 실행하세요. 폴더 내에서는 `seq` 번호를 따릅니다. 이렇게 해야:

1. Login이 인증 필요 엔드포인트보다 먼저 실행됨
2. Create가 Get / Update / Delete보다 먼저 실행됨
3. Scan이 라이브러리 생성 이후에 실행됨

### 알려진 제한사항 (CLI 3.3.0)

- `bru run`은 환경변수를 메모리에만 유지; 배치 실행 중 디스크에 기록하지 않음
- `assert` 블록에서 `$res.status` 사용 시 ReferenceError 발생; 대신 `script:post-response` + `bru.setEnvVar()` 사용
- 런타임 ID를 리셋하려면 환경 파일을 수동 편집해야 함

---

## 3. 백엔드 단위 / 통합 테스트

### 실행

```bash
cd backend
cargo test
```

프로젝트가 `sqlx` 컴파일타임 쿼리 매크로를 사용하므로 `DATABASE_URL`이 설정되어 있어야 합니다 (`.env` 또는 환경변수).

### 현재 커버리지

| 모듈 | 테스트 파일 | 테스트 수 | 커버 내용 |
|---|---|---|---|
| 포맷 감지 | `src/services/format_detector.rs` | 4 | PDF 매직 바이트, 빈 파일, 알 수 없는 포맷, 존재하지 않는 경로 |

특정 테스트만 실행:

```bash
cargo test fd_01_pdf_magic
```

### 테스트 추가 방법

백엔드 테스트는 소스 파일 내 `#[cfg(test)] mod tests` 블록으로 작성합니다:

1. 해당 소스 파일에 `#[cfg(test)] mod tests` 블록 추가
2. `Cargo.toml`의 `[dev-dependencies]`에 필요 크레이트 추가
3. `cargo test`로 검증

현재 dev-dependencies:

```toml
[dev-dependencies]
axum-test = "14"
tempfile = "3"
```

---

## 4. CI 파이프라인

GitHub Actions는 `main`/`develop` 브랜치 push 및 `main` 대상 PR에서 실행됩니다.

설정 파일: `.github/workflows/ci.yml`

### 백엔드 잡

| 단계 | 명령 | 검증 내용 |
|---|---|---|
| Rust 설치 | `dtolnay/rust-toolchain@stable` | 컴파일러 사용 가능 |
| cargo 캐시 | `actions/cache@v4` | 빌드 속도 향상 |
| sqlx-cli 설치 | `cargo install sqlx-cli` | 마이그레이션 도구 |
| 마이그레이션 실행 | `sqlx migrate run` | 스키마 정상 적용 |
| 빌드 | `cargo build --release` | 릴리즈 컴파일 |
| 테스트 | `cargo test` | 단위 / 통합 테스트 |

PostgreSQL 16 서비스 컨테이너 설정:

```
POSTGRES_DB=ebook
POSTGRES_USER=ebook
POSTGRES_PASSWORD=testpassword
```

### 프론트엔드 잡

| 단계 | 명령 | 검증 내용 |
|---|---|---|
| Bun 설치 | `oven-sh/setup-bun@v2` | 런타임 사용 가능 |
| 의존성 설치 | `bun install` | 의존성 해석 |
| 타입체크 | `bun run check` | TypeScript / Svelte 타입 |
| 빌드 | `bun run build` | 프로덕션 빌드 성공 |

### CI와 동일하게 로컬에서 실행

백엔드:

```bash
cd backend
DATABASE_URL=postgres://ebook:devpassword@localhost:5432/ebook \
  JWT_SECRET=test_jwt_secret_minimum_32_characters_long \
  BOOKS_PATH=/tmp/books \
  THUMBS_PATH=/tmp/thumbs \
  cargo test
```

프론트엔드:

```bash
cd frontend && bun install && bun run check && bun run build
```

---

## 5. 수동 API 검증 (curl)

Bruno 없이 빠르게 확인할 때 사용합니다. 백엔드가 실행 중이고 관리자 계정이 있다고 가정합니다.

### 토큰 조작

```bash
# 로그인 (refresh 쿠키를 cookies.txt에 저장)
TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "devpassword"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 갱신 (저장된 쿠키 사용)
TOKEN=$(curl -s -b cookies.txt -X POST http://localhost:3001/api/auth/refresh \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 토큰 만료 확인
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool
```

### 헬스체크

```bash
curl -s http://localhost:3001/api/health | jq
# {"status":"ok"}
```

### 인증 필요 요청

```bash
curl -s http://localhost:3001/api/libraries \
  -H "Authorization: Bearer $TOKEN" | jq
```

전체 엔드포인트 테스트는 Bruno 컬렉션을 사용하세요.

---

## 6. 자주 쓰는 명령 모음

```bash
# 데이터베이스
docker compose -f docker-compose.dev.yml up -d        # 시작
docker compose -f docker-compose.dev.yml stop          # 중지 (데이터 유지)
docker compose -f docker-compose.dev.yml down -v       # 전체 삭제

# 백엔드
cd backend && cargo run                                # 서버 실행
cd backend && cargo watch -x run                       # 코드 변경 시 자동 재시작
cd backend && cargo test                               # 테스트 실행
cd backend && cargo build --release                    # 릴리즈 빌드

# 프론트엔드
cd frontend && bun run dev                             # 개발 서버
cd frontend && bun run check                           # 타입체크
cd frontend && bun run build                           # 프로덕션 빌드

# Bruno
cd bruno-tests && bru run --environment Local          # 전체 API 테스트 실행
```

---

## 7. 문제 해결

### `DATABASE_URL must be set`

`.env` 파일이 없거나 `backend/`에서 실행하지 않은 경우:

```bash
cd backend && cargo run
```

### `connection refused`

DB 컨테이너가 아직 준비되지 않음:

```bash
docker compose -f docker-compose.dev.yml ps
# Status가 healthy가 될 때까지 대기
```

### API 호출 시 `401 Unauthorized` (토큰 만료)

액세스 토큰은 15분 후 만료됩니다:

```bash
# 재로그인
TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "devpassword"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 또는 갱신 (cookies.txt 필요)
TOKEN=$(curl -s -b cookies.txt -X POST http://localhost:3001/api/auth/refresh \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

### 로그인 시 `401 Unauthorized`

- DB에 유저가 없음 -> 1장 관리자 계정 생성 단계 재실행
- 비밀번호 불일치 -> 해시와 로그인 비밀번호가 일치하는지 확인

```bash
psql postgres://ebook:devpassword@localhost:5432/ebook \
  -c "SELECT username, role FROM users;"
```

### 스캔 후 책이 안 보임

- 서버 로그에서 `scan failed` 메시지 확인
- `path`가 `backend/` 기준으로 올바른지 확인
- 책 파일이 epub/pdf/cbz 형식인지 확인

### `cargo watch` 설치 안 됨

```bash
cargo install cargo-watch
```

### Bruno CLI에서 `ReferenceError: $res is not defined`

bru CLI 3.3.0의 알려진 버그입니다. 컬렉션은 `assert` 대신 `script:post-response` + `bru.setEnvVar()`를 사용하여 이 문제를 회피합니다. 이 에러가 보이면 `.bru` 파일에 `assert { $res.status }` 블록이 없는지 확인하세요.
