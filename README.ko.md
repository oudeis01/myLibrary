# myLibrary

> **Work in progress.** 현재 개발 중이며 아직 사용할 수 없습니다.

자체 호스팅 전자책 서버. 오프라인 읽기, 멀티유저, 어노테이션 지원.

PDF, EPUB, CBZ 포맷 지원. 포맷별 전용 리더로 브라우저에서 렌더링. `docker compose up` 한 번으로 배포.

이 문서는 한글 요약입니다. 상세 내용은 [README.md](README.md)를 참조하세요.

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 백엔드 | Rust, Axum 0.7, SQLx, PostgreSQL 16 |
| 프론트엔드 | SvelteKit (SPA/PWA), Tailwind CSS v4 |
| 인증 | JWT (Argon2 해시, 액세스 + 리프레시 토큰) |
| 검색 | Tantivy 풀텍스트 인덱스 |
| 배포 | Docker Compose + nginx |

## 아키텍처

```mermaid
graph TB
    Client["클라이언트 (브라우저/PWA)"]
    Proxy["nginx (:80/:443)"]
    Backend["Rust + Axum (:3001)"]
    DB["PostgreSQL (:5432)"]
    FS["파일 시스템"]

    Client --> Proxy
    Proxy --> Backend
    Backend --> DB
    Backend --> FS
```

## 기능

- **포맷 지원**: PDF (pdf.js), EPUB (epub.js), CBZ (zip.js)
- **포맷 감지**: 확장자가 아닌 매직 바이트 + 내부 구조 기반 판별
- **오프라인 읽기**: PWA + Service Worker 3단계 캐싱 + IndexedDB 저장
- **멀티유저**: admin / member / guest 역할, 라이브러리별 권한 제어
- **어노테이션**: 하이라이트, 노트, 색상 태그 (PDF, EPUB). JSON/Markdown 내보내기
- **북마크**: 페이지 북마크 (모든 포맷)
- **API 테스트**: Bruno 컬렉션 포함 (17개 엔드포인트, 자동 토큰 관리)

## 빠른 시작

### 프로덕션 배포

```bash
git clone https://github.com/oudeis01/myLibrary.git
cd myLibrary

cp .env.example .env
# .env 수정: JWT_SECRET (최소 32자), DB_PASSWORD 설정

docker compose up -d
```

`http://localhost`에서 접속.

### 개발 환경

```bash
# PostgreSQL만 컨테이너로 실행
docker compose -f docker-compose.dev.yml up -d

# 환경변수 설정
cp .env.example .env

# 관리자 계정 생성 (최초 1회)
python3 -c "from argon2 import PasswordHasher; print(PasswordHasher().hash('your_password'))"
psql postgres://ebook:devpassword@localhost:5432/ebook -c \
  "INSERT INTO users (username, password_hash, role) VALUES ('admin', '<hash>', 'admin');"

# 백엔드 실행
cd backend && cargo run

# 프론트엔드 실행 (별도 터미널)
cd frontend && bun install && bun run dev
```

**주의**: `.env`의 `BOOKS_PATH`, `THUMBS_PATH`는 절대경로로 설정. `cargo run` 실행 위치(`backend/`) 기준으로 상대경로가 해석됨.

## 개발 상태

| Phase | 내용 | 상태 |
|---|---|---|
| 0 | 프로젝트 스캐폴딩 | 완료 |
| 1 | 코어 MVP (파서, API, JWT, 리더) | 완료 |
| 2 | 오프라인 읽기 + PWA | 완료 |
| 3 | 어노테이션 + 북마크 | 완료 |
| 4 | 멀티유저 + 접근 제어 | 완료 |
| 5 | Tantivy 풀텍스트 검색 | 완료 |
| 6 | 다듬기 (성능, 모바일 UX, 문서화) | 대기 |

88개 테스트 (단위 53 + 통합 35).

## 라이선스

MIT
