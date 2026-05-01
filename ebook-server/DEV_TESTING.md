# 개발 환경 DB 연결 테스트 가이드

로컬에서 백엔드를 직접 실행하고 API가 DB와 제대로 연결되는지 확인하는 절차입니다.  
**최초 셋업부터 책 스캔까지** 한 번만 쭉 읽으면 됩니다.

---

## 사전 요구사항

아래가 설치되어 있어야 합니다.

| 도구 | 확인 명령 |
|---|---|
| Docker & Docker Compose | `docker compose version` |
| Rust (stable) | `cargo --version` |
| psql (PostgreSQL 클라이언트) | `psql --version` |
| Python 3 + argon2-cffi | `python3 -c "import argon2"` |

`argon2-cffi`가 없다면:
```bash
pip install argon2-cffi
```

---

## 1단계: 개발 DB 시작

`ebook-server/` 디렉토리에서 실행합니다.

```bash
cd /경로/ebook-server

docker compose -f docker-compose.dev.yml up -d
```

컨테이너가 뜰 때까지 잠깐 기다린 후, 정상 기동 확인:

```bash
docker compose -f docker-compose.dev.yml ps
```

`postgres` 컨테이너 Status가 `healthy`여야 합니다.

---

## 2단계: `.env` 파일 설정

`.env.example`을 복사해서 `.env`를 만듭니다 (이미 있으면 생략).

```bash
cp .env.example .env
```

`.env`를 열어서 `JWT_SECRET`만 변경합니다.  
`DATABASE_URL`은 개발용 기본값 그대로 써도 됩니다.

```dotenv
# JWT_SECRET: 최소 32자 랜덤 문자열
# 아래 명령으로 생성할 수 있습니다:
#   openssl rand -base64 32
JWT_SECRET=여기에_32자_이상의_랜덤_문자열_입력

DATABASE_URL=postgres://ebook:devpassword@localhost:5432/ebook
BOOKS_PATH=./data/books
THUMBS_PATH=./data/thumbs
SERVER_PORT=3001
RUST_LOG=debug
```

> `.env`는 `.gitignore`에 등록되어 있어 커밋되지 않습니다.

---

## 3단계: 데이터 디렉토리 생성

책 파일과 썸네일을 저장할 디렉토리가 필요합니다.

```bash
mkdir -p data/books data/thumbs
```

---

## 4단계: 백엔드 서버 실행

```bash
cd backend
cargo run
```

> 첫 실행은 의존성 컴파일로 몇 분 걸립니다. 이후부터는 빠릅니다.

실행 성공 시 터미널에 아래와 유사한 로그가 출력됩니다:

```
2024-xx-xx ... INFO ebook_server: running migrations
2024-xx-xx ... INFO ebook_server: listening on 0.0.0.0:3001
```

마이그레이션(테이블 생성)은 서버 시작 시 자동으로 실행됩니다.

---

## 5단계: 헬스 체크

**새 터미널**을 열고 테스트합니다.

```bash
curl -s http://localhost:3001/api/health | jq
```

기대 응답:

```json
{ "status": "ok" }
```

`jq`가 없으면 `curl -s http://localhost:3001/api/health` 만 입력해도 됩니다.

---

## 6단계: 관리자 계정 생성 (최초 1회)

로그인하려면 DB에 유저가 있어야 합니다.  
가입 API는 없으므로 직접 삽입합니다.

### 6-1. argon2 해시 생성

```bash
python3 -c "
from argon2 import PasswordHasher
ph = PasswordHasher()
print(ph.hash('devpassword'))
"
```

출력 예시 (실행마다 달라집니다):

```
$argon2id$v=19$m=65536,t=3,p=4$abc123...==$xyz...==
```

이 문자열 전체를 복사해 둡니다.

### 6-2. DB에 유저 삽입

```bash
psql postgres://ebook:devpassword@localhost:5432/ebook
```

psql 프롬프트에서 아래 SQL을 실행합니다.  
`HASH_HERE` 자리에 위에서 복사한 해시를 붙여넣습니다.

```sql
INSERT INTO users (username, password_hash, role)
VALUES ('admin', 'HASH_HERE', 'admin');

-- 삽입 확인
SELECT id, username, role, created_at FROM users;

\q
```

---

## 7단계: 로그인 API 테스트

```bash
curl -s -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "devpassword"}' | jq
```

기대 응답:

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...."
}
```

> `-c cookies.txt` 옵션으로 refresh_token 쿠키가 파일에 저장됩니다.  
> 이후 명령에서 `-b cookies.txt`로 재사용합니다.

토큰을 변수에 저장해 두면 편합니다:

```bash
TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "devpassword"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo $TOKEN
```

---

## 8단계: 인증 필요 API 테스트

토큰 없이 접근하면 401이 반환되는지 확인:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/libraries
# → 401
```

토큰을 포함하면 정상 응답:

```bash
curl -s http://localhost:3001/api/libraries \
  -H "Authorization: Bearer $TOKEN" | jq
# → [] (아직 라이브러리 없음)
```

---

## 9단계: 라이브러리 생성 + 스캔

### 9-1. 테스트용 책 파일 준비

```bash
# data/books/ 에 epub, pdf, cbz 파일을 복사합니다.
cp ~/Downloads/sample.epub data/books/
```

### 9-2. 라이브러리 생성

`path`에는 **서버 기준 절대경로 또는 상대경로**를 입력합니다.  
`cargo run`을 `ebook-server/backend/`에서 실행했다면 `../data/books`가 됩니다.

```bash
curl -s -X POST http://localhost:3001/api/libraries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "내 책장", "path": "../data/books"}' | jq
```

기대 응답:

```json
{
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "name": "내 책장",
  "path": "../data/books",
  "created_at": "..."
}
```

`id`를 복사해 둡니다.

### 9-3. 스캔 트리거

```bash
LIBRARY_ID="위에서 복사한 UUID"

curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3001/api/libraries/$LIBRARY_ID/scan \
  -H "Authorization: Bearer $TOKEN"
# → 202
```

스캔은 백그라운드에서 실행됩니다.  
서버 터미널에서 로그를 확인합니다:

```
INFO scan complete library_id=... added=3 skipped=0
```

---

## 10단계: 책 목록 확인

```bash
curl -s http://localhost:3001/api/books \
  -H "Authorization: Bearer $TOKEN" | jq
```

스캔한 책들이 목록에 나타나면 전체 플로우 성공입니다.

---

## 자주 쓰는 명령 모음

```bash
# DB 시작
docker compose -f docker-compose.dev.yml up -d

# DB 중지 (데이터 유지)
docker compose -f docker-compose.dev.yml stop

# DB 완전 삭제 (볼륨 포함, 처음부터 다시 시작할 때)
docker compose -f docker-compose.dev.yml down -v

# psql 접속
psql postgres://ebook:devpassword@localhost:5432/ebook

# 백엔드 실행 (코드 변경 시 자동 재시작)
cd backend && cargo watch -x run

# 프론트엔드 dev 서버
cd frontend && bun run dev
```

---

## 문제 해결

### `DATABASE_URL must be set` 오류

`.env` 파일이 없거나 `ebook-server/backend/` 에서 실행하지 않은 경우입니다.

```bash
# backend 디렉토리에서 실행해야 합니다
cd ebook-server/backend
cargo run
```

### `connection refused` 오류

DB 컨테이너가 아직 준비 안 된 경우입니다.

```bash
docker compose -f docker-compose.dev.yml ps
# Status가 healthy가 될 때까지 기다립니다
```

### 로그인 시 `401 Unauthorized`

- 유저가 DB에 없는 경우 → 6단계 다시 확인
- 비밀번호가 다른 경우 → 6-1에서 생성한 해시와 로그인 비밀번호가 일치하는지 확인

```bash
psql postgres://ebook:devpassword@localhost:5432/ebook \
  -c "SELECT username, role FROM users;"
```

### 스캔 후 책이 안 보임

- 서버 로그에서 `scan failed` 메시지 확인
- `path`가 서버 실행 위치(`backend/`) 기준으로 올바른지 확인
- 책 파일 형식이 epub/pdf/cbz인지 확인

### `cargo watch` 설치 안 됨

```bash
cargo install cargo-watch
```
