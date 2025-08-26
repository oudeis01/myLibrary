#!/bin/bash

# MyLibrary 메타데이터 추출 기능 테스트 스크립트
# 작성일: 2025-08-26

echo "======================================="
echo "MyLibrary 메타데이터 추출 기능 테스트"
echo "======================================="
echo

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 서버 URL
SERVER_URL="http://localhost:8080"
BOOK_FILE="/home/choiharam/works/appdev/myLibrary/books/제3인류-1_1756158977392_1164.epub"

echo -e "${BLUE}1. 서버 상태 확인${NC}"
echo "GET $SERVER_URL/api/health"
HEALTH_RESPONSE=$(curl -s -X GET "$SERVER_URL/api/health")
echo "응답: $HEALTH_RESPONSE"

# JSON에서 status 확인
if echo "$HEALTH_RESPONSE" | grep -q '"database_connected":true'; then
    echo -e "${GREEN}✅ 서버와 데이터베이스 연결 정상${NC}"
else
    echo -e "${RED}❌ 서버 또는 데이터베이스 연결 실패${NC}"
    exit 1
fi
echo

echo -e "${BLUE}2. 기존 테스트 데이터 정리${NC}"
psql -U mylibrary_user -d mylibrary -c "DELETE FROM books WHERE title LIKE '%제3인류%' OR title LIKE '%testbook%';" 2>/dev/null
psql -U mylibrary_user -d mylibrary -c "DELETE FROM users WHERE username = 'testuser2';" 2>/dev/null
echo "기존 테스트 데이터 삭제 완료"
echo

echo -e "${BLUE}3. 새 사용자 등록${NC}"
echo "POST $SERVER_URL/api/register"
REGISTER_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/register" \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser2","password":"TestPass123!"}')
echo "응답: $REGISTER_RESPONSE"

if echo "$REGISTER_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ 사용자 등록 성공${NC}"
else
    echo -e "${YELLOW}⚠️ 사용자가 이미 존재하거나 등록 실패 - 계속 진행${NC}"
fi
echo

echo -e "${BLUE}4. 로그인${NC}"
echo "POST $SERVER_URL/api/login"
LOGIN_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser2","password":"TestPass123!"}')
echo "응답: $LOGIN_RESPONSE"

# 토큰 추출
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"session_token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✅ 로그인 성공${NC}"
    echo "세션 토큰: ${TOKEN:0:20}..."
else
    echo -e "${RED}❌ 로그인 실패${NC}"
    exit 1
fi
echo

echo -e "${BLUE}5. EPUB 파일 업로드 (메타데이터 추출 테스트)${NC}"
if [ -f "$BOOK_FILE" ]; then
    echo "파일: $BOOK_FILE"
    echo "POST $SERVER_URL/api/books/upload"
    
    UPLOAD_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/books/upload" \
        -H "X-Session-Token: $TOKEN" \
        -F "file=@$BOOK_FILE" \
        -F "title=제3인류" \
        -F "author=베르나르 베르베르")
    
    echo "응답: $UPLOAD_RESPONSE"
    
    # 업로드된 책 ID 추출
    BOOK_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"book_id":[0-9]*' | cut -d':' -f2)
    
    if [ -n "$BOOK_ID" ]; then
        echo -e "${GREEN}✅ 책 업로드 성공 (ID: $BOOK_ID)${NC}"
    else
        echo -e "${RED}❌ 책 업로드 실패${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ 테스트용 EPUB 파일이 존재하지 않습니다: $BOOK_FILE${NC}"
    exit 1
fi
echo

echo -e "${BLUE}6. 데이터베이스에서 메타데이터 확인${NC}"
echo "책 정보 조회..."
DB_RESULT=$(psql -U mylibrary_user -d mylibrary -t -c "
SELECT 
    id, 
    title, 
    author, 
    description, 
    publisher, 
    isbn, 
    language, 
    page_count, 
    metadata_extracted, 
    extraction_error,
    thumbnail_path
FROM books 
WHERE id = $BOOK_ID;
")

echo "데이터베이스 결과:"
echo "$DB_RESULT"
echo

# 메타데이터 추출 상태 확인
METADATA_EXTRACTED=$(echo "$DB_RESULT" | awk '{print $9}' | tr -d ' ')
if [ "$METADATA_EXTRACTED" = "t" ]; then
    echo -e "${GREEN}✅ 메타데이터 추출 성공${NC}"
else
    echo -e "${RED}❌ 메타데이터 추출 실패${NC}"
    EXTRACTION_ERROR=$(echo "$DB_RESULT" | awk '{print $10}')
    if [ -n "$EXTRACTION_ERROR" ] && [ "$EXTRACTION_ERROR" != "" ]; then
        echo -e "${RED}오류: $EXTRACTION_ERROR${NC}"
    fi
fi
echo

echo -e "${BLUE}7. API를 통한 책 목록 조회${NC}"
echo "GET $SERVER_URL/api/books"
BOOKS_RESPONSE=$(curl -s -X GET "$SERVER_URL/api/books" \
    -H "X-Session-Token: $TOKEN")

echo "응답:"
echo "$BOOKS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$BOOKS_RESPONSE"
echo

echo -e "${BLUE}8. 썸네일 파일 확인${NC}"
THUMBNAIL_PATH=$(echo "$DB_RESULT" | awk '{print $11}' | tr -d ' ')
if [ -n "$THUMBNAIL_PATH" ] && [ "$THUMBNAIL_PATH" != "" ]; then
    if [ -f "$THUMBNAIL_PATH" ]; then
        echo -e "${GREEN}✅ 썸네일 파일 존재: $THUMBNAIL_PATH${NC}"
        ls -la "$THUMBNAIL_PATH"
    else
        echo -e "${YELLOW}⚠️ 썸네일 경로는 설정되어 있지만 파일이 없음: $THUMBNAIL_PATH${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ 썸네일이 생성되지 않음${NC}"
fi
echo

echo -e "${BLUE}9. 메타데이터 상세 분석${NC}"
echo "추출된 메타데이터 정보:"
echo "- 제목: $(echo "$DB_RESULT" | awk '{print $2}')"
echo "- 저자: $(echo "$DB_RESULT" | awk '{print $3}')"
echo "- 설명: $(echo "$DB_RESULT" | awk '{print $4}')"
echo "- 출판사: $(echo "$DB_RESULT" | awk '{print $5}')"
echo "- ISBN: $(echo "$DB_RESULT" | awk '{print $6}')"
echo "- 언어: $(echo "$DB_RESULT" | awk '{print $7}')"
echo "- 페이지 수: $(echo "$DB_RESULT" | awk '{print $8}')"
echo

echo "======================================="
echo -e "${GREEN}테스트 완료${NC}"
echo "======================================="

# 결과 요약
echo
echo -e "${YELLOW}결과 요약:${NC}"
if [ "$METADATA_EXTRACTED" = "t" ]; then
    echo -e "${GREEN}✅ 메타데이터 추출 기능이 정상 작동합니다${NC}"
else
    echo -e "${RED}❌ 메타데이터 추출 기능에 문제가 있습니다${NC}"
    echo "- 파일 업로드: 성공"
    echo "- 데이터베이스 저장: 성공" 
    echo "- 메타데이터 추출: 실패"
    echo "확인이 필요한 항목:"
    echo "  1. BookManager::extract_epub_metadata 함수"
    echo "  2. EPUB 파일 구조 및 접근 권한"
    echo "  3. 메타데이터 추출 과정의 예외 처리"
fi