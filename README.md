# MyLibrary - 개인 전자책 관리 시스템

C++ + PostgreSQL + Next.js 기반의 개인 전자책 관리 서버 MVP입니다.

## 주요 기능

- **사용자 인증**: 개인별 로그인/회원가입 (BCrypt 해시 사용)
- **도서 관리**: EPUB, PDF, CBZ, CBR 파일 업로드 및 관리
- **독서 진행률 추적**: 개인별 독서 상황 데이터베이스 저장
- **웹 UI**: 반응형 웹 인터페이스를 통한 도서 업로드 및 관리

## 시스템 요구사항

### 필수 시스템 패키지
- **C++ 컴파일러**: C++20 지원 (GCC 10+ 또는 Clang 12+)
- **CMake**: 3.15 이상
- **PostgreSQL**: 12 이상 (서버 및 개발 패키지)
- **libpqxx**: PostgreSQL C++ 클라이언트 라이브러리
- **OpenSSL**: 암호화 라이브러리 (개발 패키지 포함)
- **pkg-config**: 라이브러리 감지용

### Ubuntu/Debian 시스템에서 설치
```bash
# 필수 시스템 패키지 설치
sudo apt update
sudo apt install build-essential cmake pkg-config
sudo apt install postgresql postgresql-contrib
sudo apt install libpqxx-dev libpq-dev
sudo apt install libssl-dev

# PostgreSQL 서비스 시작
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### CentOS/RHEL/Fedora 시스템에서 설치
```bash
# Fedora
sudo dnf install gcc-c++ cmake pkg-config
sudo dnf install postgresql postgresql-server postgresql-contrib
sudo dnf install libpqxx-devel postgresql-devel
sudo dnf install openssl-devel

# CentOS/RHEL (EPEL 저장소 필요)
sudo yum install gcc-c++ cmake3 pkg-config
sudo yum install postgresql-server postgresql-contrib
sudo yum install libpqxx-devel postgresql-devel
sudo yum install openssl-devel
```

### 자동 다운로드되는 종속성 (CMake FetchContent)
- **nlohmann/json**: JSON 처리 라이브러리
- **cpp-httplib**: 경량 HTTP 서버 라이브러리

## 설치 및 실행

### 1. 시스템 패키지 설치 및 PostgreSQL 설정

```bash
# Ubuntu/Debian 시스템
sudo apt update
sudo apt install build-essential cmake pkg-config
sudo apt install postgresql postgresql-contrib libpqxx-dev libpq-dev libssl-dev

# PostgreSQL 서비스 시작
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 데이터베이스 및 사용자 생성
sudo -u postgres createdb mylibrary_db
sudo -u postgres createuser mylibrary_user
sudo -u postgres psql -c "ALTER USER mylibrary_user WITH PASSWORD 'your_password_here';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mylibrary_db TO mylibrary_user;"

# 또는 제공된 스크립트 사용
sudo -u postgres psql < setup_db.sql
```

### 2. 프로젝트 빌드

```bash
# 프로젝트 디렉토리로 이동
cd /home/choiharam/works/appdev/myLibrary

# 빌드 디렉토리 생성 및 빌드
mkdir build && cd build
cmake ..
make -j$(nproc)
```

### 3. 서버 실행

```bash
# 기본 설정으로 실행
./mylibrary_server

# 사용자 정의 설정으로 실행
./mylibrary_server --port 8080 --db-password your_password_here --books-dir ./books
```

### 4. 웹 인터페이스 접속

브라우저에서 `http://localhost:8080`에 접속하여 웹 인터페이스를 사용할 수 있습니다.

## API 엔드포인트

### 인증
- `POST /api/register` - 사용자 회원가입
- `POST /api/login` - 사용자 로그인
- `POST /api/logout` - 사용자 로그아웃

### 도서 관리
- `POST /api/books/upload` - 도서 파일 업로드
- `GET /api/books` - 사용자 도서 목록 조회
- `GET /api/books/{id}/download` - 도서 파일 다운로드 (미구현)

### 독서 진행률
- `PUT /api/books/{id}/progress` - 독서 진행률 업데이트
- `GET /api/books/{id}/progress` - 독서 진행률 조회

### 시스템
- `GET /api/health` - 서버 상태 확인

## 프로젝트 구조

```
myLibrary/
├── CMakeLists.txt          # CMake 빌드 설정
├── setup_db.sql           # 데이터베이스 초기화 스크립트
├── README.md              # 이 파일
├── include/               # 헤더 파일들
│   ├── database.h         # 데이터베이스 관리
│   ├── auth.h            # 인증 관리
│   ├── book_manager.h    # 도서 파일 관리
│   └── http_server.h     # HTTP 서버
├── src/                  # 소스 파일들
│   ├── main.cpp          # 메인 진입점
│   ├── database.cpp      # 데이터베이스 구현
│   ├── auth.cpp          # 인증 구현
│   ├── book_manager.cpp  # 도서 관리 구현
│   └── http_server.cpp   # HTTP 서버 구현
├── web/                  # 웹 인터페이스
│   ├── index.html        # 메인 HTML
│   └── app.js           # JavaScript 클라이언트
└── build/               # 빌드 산출물
    ├── mylibrary_server  # 실행 파일
    ├── books/           # 업로드된 도서 파일들
    └── ...
```

## 데이터베이스 스키마

### users 테이블
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### books 테이블
```sql
CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    file_path VARCHAR(500) UNIQUE NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### user_book_progress 테이블
```sql
CREATE TABLE user_book_progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    progress_details JSONB,
    PRIMARY KEY (user_id, book_id)
);
```

## 명령행 옵션

```bash
./mylibrary_server [options]

Options:
  --port PORT          서버 포트 (기본값: 8080)
  --db-host HOST       데이터베이스 호스트 (기본값: localhost)
  --db-port PORT       데이터베이스 포트 (기본값: 5432)
  --db-name NAME       데이터베이스 이름 (기본값: mylibrary_db)
  --db-user USER       데이터베이스 사용자 (기본값: mylibrary_user)
  --db-password PASS   데이터베이스 비밀번호 (기본값: your_password_here)
  --books-dir DIR      도서 저장 디렉토리 (기본값: ./books)
  --help              도움말 표시
```

## 보안 고려사항

이 MVP는 개발 및 테스트 목적으로 제작되었습니다. 프로덕션 환경에서 사용하기 전에 다음 사항들을 개선해야 합니다:

- **세션 관리**: 현재 간단한 토큰 기반 인증을 사용하며, JWT 등 보안성이 강화된 토큰 시스템으로 교체 필요
- **HTTPS**: TLS/SSL 암호화 적용
- **입력 검증**: 더 엄격한 입력 검증 및 SQL 인젝션 방지
- **파일 업로드 보안**: 파일 타입 검증 강화 및 바이러스 스캔
- **레이트 리미팅**: API 호출 제한
- **로깅**: 보안 이벤트 로깅 및 모니터링

## 향후 개발 계획

- **메타데이터 추출**: EPUB, PDF 파일의 상세 메타데이터 추출
- **도서 읽기**: 웹 기반 도서 뷰어 구현
- **검색 기능**: 도서 제목, 저자, 내용 검색
- **태그 시스템**: 도서 분류 및 태그 관리
- **백업 기능**: 데이터베이스 및 파일 백업
- **모바일 앱**: PWA 또는 네이티브 모바일 앱 개발

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 기여

버그 리포트, 기능 요청, 또는 풀 리퀘스트를 환영합니다.

## 문제 해결

### 일반적인 문제들

1. **데이터베이스 연결 실패**
   - PostgreSQL 서비스가 실행 중인지 확인
   - 데이터베이스 자격 증명이 올바른지 확인
   - 방화벽 설정 확인

2. **빌드 실패**
   - libpqxx-dev가 설치되어 있는지 확인
   - CMake 버전이 3.15 이상인지 확인
   - 컴파일러가 C++20을 지원하는지 확인

3. **포트 사용 중 오류**
   - 다른 포트 번호 사용: `--port 8081`
   - 기존 프로세스 종료: `sudo lsof -ti:8080 | xargs kill -9`

4. **파일 업로드 실패**
   - books 디렉토리 권한 확인
   - 디스크 공간 확인
   - 파일 크기 제한 확인

더 자세한 문제 해결이 필요한 경우 이슈를 생성해 주세요.
