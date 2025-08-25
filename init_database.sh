#!/bin/bash

#============================================================================
# MyLibrary Database Initialization Script
# 
# 이 스크립트는 MyLibrary 프로젝트를 위한 PostgreSQL 데이터베이스를 
# 처음부터 완전히 설정하는 스크립트입니다.
#
# 실행 전 확인사항:
# 1. PostgreSQL이 설치되어 있어야 함
# 2. PostgreSQL 서비스가 실행 중이어야 함 (sudo systemctl start postgresql)
# 3. postgres 사용자로 실행 권한이 있어야 함
#
# 작성자: GitHub Copilot
# 날짜: 2025-08-25
#============================================================================

set -e  # 오류 발생시 스크립트 중단

# 색상 코드 정의 (출력을 예쁘게 만들기 위함)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수들 정의
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 스크립트 시작 메시지
echo "============================================================================"
log_info "MyLibrary 데이터베이스 초기화를 시작합니다..."
echo "============================================================================"

# 1단계: PostgreSQL 서비스 상태 확인
log_info "1단계: PostgreSQL 서비스 상태 확인 중..."
if sudo systemctl is-active --quiet postgresql; then
    log_success "PostgreSQL 서비스가 실행 중입니다."
else
    log_error "PostgreSQL 서비스가 실행되지 않습니다."
    log_info "서비스를 시작합니다..."
    sudo systemctl start postgresql
    sleep 2
    if sudo systemctl is-active --quiet postgresql; then
        log_success "PostgreSQL 서비스가 시작되었습니다."
    else
        log_error "PostgreSQL 서비스 시작에 실패했습니다. 수동으로 확인해주세요."
        exit 1
    fi
fi

# 2단계: 기존 데이터베이스 확인 (존재하면 경고)
log_info "2단계: 기존 데이터베이스 확인 중..."
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw mylibrary_db; then
    log_warning "mylibrary_db 데이터베이스가 이미 존재합니다."
    echo -n "기존 데이터베이스를 삭제하고 새로 만드시겠습니까? (y/N): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        log_info "기존 데이터베이스를 삭제합니다..."
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS mylibrary_db;"
        log_success "기존 데이터베이스가 삭제되었습니다."
    else
        log_info "기존 데이터베이스를 유지하고 테이블만 업데이트합니다."
    fi
fi

# 3단계: 데이터베이스 및 사용자 생성
log_info "3단계: 데이터베이스 및 사용자 생성 중..."

# 비밀번호 설정 (기본값 제공)
DB_PASSWORD="mylibrary2025!"
log_info "데이터베이스 사용자 비밀번호: $DB_PASSWORD"
log_warning "보안을 위해 나중에 이 비밀번호를 변경하는 것을 권장합니다."

# 데이터베이스 및 사용자 생성 SQL 실행
sudo -u postgres psql << EOF
-- 데이터베이스가 없으면 생성
CREATE DATABASE mylibrary_db;

-- 사용자가 없으면 생성, 있으면 비밀번호 업데이트
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'mylibrary_user') THEN
        CREATE USER mylibrary_user WITH PASSWORD '$DB_PASSWORD';
    ELSE
        ALTER USER mylibrary_user WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- 권한 부여
GRANT ALL PRIVILEGES ON DATABASE mylibrary_db TO mylibrary_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mylibrary_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mylibrary_user;

-- 연결 테스트
\c mylibrary_db;
SELECT 'Database connection successful!' as status;
EOF

if [ $? -eq 0 ]; then
    log_success "데이터베이스 및 사용자가 성공적으로 생성되었습니다."
else
    log_error "데이터베이스 생성 중 오류가 발생했습니다."
    exit 1
fi

# 4단계: 스키마 적용
log_info "4단계: 데이터베이스 스키마 적용 중..."
if [ -f "setup_db.sql" ]; then
    sudo -u postgres psql -d mylibrary_db -f setup_db.sql
    if [ $? -eq 0 ]; then
        log_success "데이터베이스 스키마가 성공적으로 적용되었습니다."
    else
        log_error "스키마 적용 중 오류가 발생했습니다."
        exit 1
    fi
else
    log_error "setup_db.sql 파일을 찾을 수 없습니다."
    exit 1
fi

# 5단계: 테이블 생성 확인
log_info "5단계: 생성된 테이블 확인 중..."
echo "생성된 테이블 목록:"
sudo -u postgres psql -d mylibrary_db -c "\dt" | grep -E "users|books|collections|user_book_progress|collection_books|collection_permissions"

# 6단계: 연결 테스트
log_info "6단계: 데이터베이스 연결 테스트 중..."
sudo -u postgres psql -d mylibrary_db -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" > /dev/null

if [ $? -eq 0 ]; then
    log_success "데이터베이스 연결 테스트 성공!"
else
    log_error "데이터베이스 연결 테스트 실패!"
    exit 1
fi

# 완료 메시지
echo "============================================================================"
log_success "MyLibrary 데이터베이스 초기화가 완료되었습니다!"
echo "============================================================================"
echo ""
log_info "데이터베이스 접속 정보:"
echo "  - 데이터베이스명: mylibrary_db"
echo "  - 사용자명: mylibrary_user"
echo "  - 비밀번호: $DB_PASSWORD"
echo "  - 호스트: localhost"
echo "  - 포트: 5432"
echo ""
log_info "C++ 코드에서 이 접속 정보를 사용하세요."
log_warning "보안을 위해 비밀번호를 환경 변수로 관리하는 것을 권장합니다."
echo ""
log_info "테스트 연결 명령어:"
echo "  sudo -u postgres psql -d mylibrary_db"
echo "============================================================================"
