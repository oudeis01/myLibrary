# 자체 호스팅 전자책 서버 — 개발 블루프린트 v2

> 작성 기준: 2025년 4월  
> 스택: Rust (Axum) + SvelteKit (SPA/PWA) + PostgreSQL + nginx  
> 목표: PDF · EPUB · CBZ 완전 지원, 오프라인 읽기, 멀티유저, 어노테이션, Docker 원샷 배포

---

## 변경 이력

| 버전 | 주요 변경 |
|---|---|
| v1 | 초기 블루프린트 |
| v2 | CBZ 어노테이션 제거(북마크만), ZIP 자동 감지 추가, CBR 제외, PostgreSQL 기본, Docker 원샷 구성, 테스트 스코프 축소·통합 |

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [전체 시스템 아키텍처](#3-전체-시스템-아키텍처)
4. [디렉터리 구조](#4-디렉터리-구조)
5. [포맷 감지 전략](#5-포맷-감지-전략)
6. [백엔드 설계 (Rust / Axum)](#6-백엔드-설계-rust--axum)
7. [프론트엔드 설계 (SvelteKit)](#7-프론트엔드-설계-sveltekit)
8. [핵심 기능 구현 계획](#8-핵심-기능-구현-계획)
9. [데이터베이스 스키마](#9-데이터베이스-스키마)
10. [PWA · 오프라인 전략](#10-pwa--오프라인-전략)
11. [멀티유저 · 권한 시스템](#11-멀티유저--권한-시스템)
12. [어노테이션 · 북마크 시스템](#12-어노테이션--북마크-시스템)
13. [Docker 배포 구성](#13-docker-배포-구성)
14. [테스트 전략](#14-테스트-전략)
15. [개발 로드맵](#15-개발-로드맵)
16. [미결 결정사항](#16-미결-결정사항)

---

## 1. 프로젝트 개요

### 동기

현존하는 자체 호스팅 전자책 서버들의 한계:

| 도구 | 문제 |
|---|---|
| Kavita | .NET 스택, 오프라인 읽기 미구현 |
| Komga | 어노테이션 없음, PWA 없음 |
| Stump | Rust 기반이나 WIP 수준, 기능 미완 |
| Booklore | 신생, 검증 부족 |

어느 도구도 PDF·EPUB·CBZ를 동등한 수준으로 지원하면서 오프라인 PWA + 어노테이션 + 멀티유저를 동시에 제공하지 않는다.

### 목표 기능

- **포맷 지원**: PDF (텍스트 레이어 포함), EPUB, CBZ. ZIP 파일은 내부 구조 기반 자동 분류
- **리더**: 포맷별 전용 리더, 웹브라우저 내 렌더링, 모바일 반응형
- **어노테이션**: PDF·EPUB에서 하이라이트·노트·색상 태그·내보내기. CBZ는 페이지 북마크만
- **오프라인**: PWA + Service Worker, 미리 다운로드 후 오프라인 읽기
- **멀티유저**: 계정 생성, 역할 기반 권한, 라이브러리별 접근 제어
- **메타데이터**: 프론트엔드에서 직접 편집
- **배포**: `docker compose up` 한 번으로 전체 스택 실행

### 명시적 제외

- CBR/RAR 지원 — RAR5 오픈소스 파서 부재, 시스템 의존성 복잡도 불필요
- CBZ 텍스트 어노테이션 — 이미지 기반 컨텐츠에 부적합
- Hypothesis 연동 — 자체 어노테이션으로 대체

---

## 2. 기술 스택

### 백엔드: Rust + Axum

**주요 크레이트**

| 용도 | 크레이트 |
|---|---|
| HTTP 서버 | `axum` |
| 비동기 런타임 | `tokio` |
| 데이터베이스 | `sqlx` (PostgreSQL) |
| PDF 파싱 | `lopdf`, `pdf-extract` |
| EPUB 파싱 | `epub` |
| ZIP/CBZ 처리 | `zip` |
| 이미지 처리 | `image` |
| 풀텍스트 검색 | `tantivy` |
| 인증 | `jsonwebtoken`, `argon2` |
| 직렬화 | `serde`, `serde_json` |
| 설정 | `config`, `dotenvy` |
| 로깅 | `tracing`, `tracing-subscriber` |

### 프론트엔드: SvelteKit (SPA/PWA)

**주요 패키지**

| 용도 | 패키지 |
|---|---|
| 프레임워크 | `@sveltejs/kit` + `@sveltejs/adapter-static` |
| PWA | `vite-plugin-pwa` |
| PDF 렌더링 | `pdfjs-dist` |
| EPUB 렌더링 | `epub.js` |
| CBZ (ZIP 해제) | `@zip.js/zip.js` |
| 오프라인 저장 | `idb` (IndexedDB wrapper) |
| HTTP 클라이언트 | `ky` |
| 아이콘 | `lucide-svelte` |
| 스타일 | Tailwind CSS v4 |

### 인프라

| 역할 | 기술 |
|---|---|
| 데이터베이스 | PostgreSQL 16 |
| 리버스 프록시 | nginx |
| 컨테이너 | Docker + Docker Compose |

---

## 3. 전체 시스템 아키텍처

```
외부 요청 (브라우저, 모바일 PWA)
          │
          ▼ :80 / :443
┌─────────────────────────────────────┐
│           nginx 컨테이너             │
│                                     │
│  GET /          → 정적 파일 서빙     │
│  (SvelteKit 빌드 결과물)             │
│                                     │
│  GET /api/*     → backend:3001      │
│  (리버스 프록시)                     │
└─────────────────────────────────────┘
          │ 내부 네트워크
          ▼ :3001
┌─────────────────────────────────────────────────────┐
│                  Rust + Axum 백엔드                  │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │  Auth    │ │ Library  │ │    Reader API      │  │
│  │  Router  │ │  Router  │ │  (페이지 스트리밍)  │  │
│  └──────────┘ └──────────┘ └────────────────────┘  │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ Metadata │ │Annotation│ │   User / Perm      │  │
│  │ Service  │ │ Service  │ │   Service          │  │
│  └──────────┘ └──────────┘ └────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │   파일 시스템 스캐너 (백그라운드 태스크)       │   │
│  │   포맷 감지 → PDF / EPUB / CBZ 분류          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────┐  ┌──────────────────────────┐    │
│  │  tantivy     │  │  파일 스토리지            │    │
│  │  검색 인덱스  │  │  (책 파일, 썸네일, 커버)  │    │
│  └──────────────┘  └──────────────────────────┘    │
└─────────────────────────────────────────────────────┘
          │ 내부 네트워크
          ▼ :5432
┌─────────────────────────────────────┐
│         PostgreSQL 컨테이너          │
└─────────────────────────────────────┘
```

### 클라이언트 레이어

```
┌─────────────────────────────────────────────────┐
│            SvelteKit SPA (PWA)                  │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │PDF 리더  │  │EPUB 리더 │  │  CBZ 리더    │  │
│  │(pdf.js)  │  │(epub.js) │  │ (zip.js +    │  │
│  │텍스트레이│  │CFI 어노테│  │  이미지)      │  │
│  │어노테이션│  │이션       │  │  북마크만    │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  Service Worker + IndexedDB             │   │
│  │  (오프라인 캐싱 · 다운로드 · 동기화)     │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  반응형 레이아웃                                  │
│  < 640px: 모바일 단일 컬럼, 하단 탭 내비게이션   │
│  640~1024px: 태블릿 사이드바 토글               │
│  > 1024px: 데스크탑 고정 사이드바               │
└─────────────────────────────────────────────────┘
```

### 데이터 흐름: 온라인 읽기

```
사용자 → 책 선택
       → GET /api/books/{id}/pages/{n}
       → Rust: 파일에서 페이지 추출 → 이미지 반환
       → 리더 렌더링
```

### 데이터 흐름: 오프라인 다운로드 및 복귀

```
[다운로드]
사용자 → "오프라인 저장" 클릭
       → GET /api/books/{id}/download
       → IndexedDB: 파일 바이너리 + 메타데이터 + 진행도 + 어노테이션 저장

[오프라인]
Service Worker → API 요청 가로채기
              → IndexedDB에서 응답

[복귀]
window 'online' 이벤트 감지
→ 오프라인 진행도 · 어노테이션 서버에 업로드
```

---

## 4. 디렉터리 구조

```
ebook-server/
│
├── backend/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── config.rs
│       ├── error.rs
│       ├── db/
│       │   ├── mod.rs
│       │   ├── migrations/
│       │   └── models.rs
│       ├── api/
│       │   ├── mod.rs
│       │   ├── auth.rs
│       │   ├── books.rs
│       │   ├── libraries.rs
│       │   ├── metadata.rs
│       │   ├── annotations.rs
│       │   ├── users.rs
│       │   └── search.rs
│       ├── services/
│       │   ├── scanner.rs          # 파일 시스템 스캔 + 포맷 감지
│       │   ├── format_detector.rs  # 매직 바이트 기반 감지
│       │   ├── parser/
│       │   │   ├── mod.rs
│       │   │   ├── pdf.rs
│       │   │   ├── epub.rs
│       │   │   └── cbz.rs
│       │   ├── thumbnail.rs
│       │   └── search_index.rs
│       └── auth/
│           ├── middleware.rs
│           └── permissions.rs
│
├── frontend/
│   ├── package.json
│   ├── svelte.config.js            # adapter-static, SPA 모드
│   ├── vite.config.js              # vite-plugin-pwa 설정
│   └── src/
│       ├── app.html
│       ├── service-worker.ts
│       ├── lib/
│       │   ├── api/
│       │   │   ├── client.ts
│       │   │   ├── books.ts
│       │   │   ├── auth.ts
│       │   │   └── annotations.ts
│       │   ├── stores/
│       │   │   ├── auth.ts
│       │   │   ├── library.ts
│       │   │   └── offline.ts
│       │   ├── readers/
│       │   │   ├── PdfReader.svelte
│       │   │   ├── EpubReader.svelte
│       │   │   └── CbzReader.svelte
│       │   ├── components/
│       │   │   ├── BookCard.svelte
│       │   │   ├── AnnotationPanel.svelte  # PDF · EPUB 전용
│       │   │   ├── BookmarkPanel.svelte    # CBZ 전용
│       │   │   ├── MetadataEditor.svelte
│       │   │   ├── UploadModal.svelte
│       │   │   └── UserManager.svelte
│       │   ├── offline/
│       │   │   ├── db.ts
│       │   │   ├── downloader.ts
│       │   │   └── sync.ts
│       │   └── utils/
│       │       ├── format.ts
│       │       └── annotations.ts
│       └── routes/
│           ├── +layout.svelte
│           ├── +page.svelte
│           ├── login/+page.svelte
│           ├── library/[id]/+page.svelte
│           ├── book/[id]/
│           │   ├── +page.svelte
│           │   └── read/+page.svelte
│           ├── admin/
│           │   ├── users/+page.svelte
│           │   └── libraries/+page.svelte
│           └── offline/+page.svelte
│
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── docker-compose.dev.yml          # 개발용 오버라이드
├── backend/Dockerfile
├── frontend/Dockerfile
├── .env.example
└── README.md
```

---

## 5. 포맷 감지 전략

확장자는 힌트로만 사용한다. 최종 판별은 **매직 바이트 + 내부 구조 검사** 기반이다.

### 감지 플로우

```
파일 입력
   │
   ├── 매직 바이트 확인
   │   ├── %PDF      → PDF 확정
   │   ├── PK\x03\x04 → ZIP 계열 (EPUB / CBZ 후보)
   │   └── 기타      → 지원 안 함, 스킵
   │
   └── ZIP 계열 → 내부 구조 검사
       ├── `mimetype` == "application/epub+zip"  → EPUB
       ├── `*.opf` 파일 존재                     → EPUB
       ├── 루트에 이미지 파일만 존재             → CBZ
       └── 판별 불가                             → 경고 로그, 스킵
```

### 구현

```rust
// src/services/format_detector.rs

use std::io::{Read, Seek};
use zip::ZipArchive;

#[derive(Debug, PartialEq)]
pub enum BookFormat {
    Pdf,
    Epub,
    Cbz,
}

pub fn detect_format<R: Read + Seek>(mut reader: R) -> Option<BookFormat> {
    let mut magic = [0u8; 4];
    reader.read_exact(&mut magic).ok()?;
    reader.seek(std::io::SeekFrom::Start(0)).ok()?;

    match &magic {
        // PDF 매직 바이트
        b if b.starts_with(b"%PDF") => Some(BookFormat::Pdf),

        // ZIP 계열: EPUB 또는 CBZ
        b if b == b"PK\x03\x04" => detect_zip_subformat(reader),

        _ => None,
    }
}

fn detect_zip_subformat<R: Read + Seek>(reader: R) -> Option<BookFormat> {
    let mut archive = ZipArchive::new(reader).ok()?;

    // 1. mimetype 파일로 EPUB 판별
    if let Ok(mut mimetype) = archive.by_name("mimetype") {
        let mut content = String::new();
        mimetype.read_to_string(&mut content).ok()?;
        if content.trim() == "application/epub+zip" {
            return Some(BookFormat::Epub);
        }
    }

    // 2. .opf 파일로 EPUB 판별
    let has_opf = (0..archive.len()).any(|i| {
        archive.by_index(i)
            .map(|f| f.name().ends_with(".opf"))
            .unwrap_or(false)
    });
    if has_opf {
        return Some(BookFormat::Epub);
    }

    // 3. 이미지 파일만 있으면 CBZ
    let image_exts = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];
    let all_images = (0..archive.len()).all(|i| {
        archive.by_index(i).map(|f| {
            let name = f.name().to_lowercase();
            // 디렉터리와 ComicInfo.xml은 허용
            f.is_dir()
                || name.ends_with("comicinfo.xml")
                || image_exts.iter().any(|ext| name.ends_with(ext))
        }).unwrap_or(false)
    });
    if all_images {
        return Some(BookFormat::Cbz);
    }

    None
}
```

### 확장자 vs. 실제 포맷 불일치 처리

| 상황 | 처리 |
|---|---|
| `.zip` 확장자, 내부가 EPUB | EPUB으로 처리, 메타데이터에 원본 확장자 기록 |
| `.zip` 확장자, 내부가 이미지 | CBZ로 처리 |
| `.cbz` 확장자, 내부가 EPUB | EPUB으로 처리, 경고 로그 |
| `.epub` 확장자, 내부가 이미지 | CBZ로 처리, 경고 로그 |
| 판별 불가 | 스킵, 사용자에게 알림 |
| CBR (RAR) | 지원 안 함, 스킵 |

---

## 6. 백엔드 설계 (Rust / Axum)

### API 엔드포인트

```
Auth
  POST   /api/auth/login
  POST   /api/auth/refresh
  POST   /api/auth/logout

Libraries
  GET    /api/libraries
  POST   /api/libraries                    (admin)
  PATCH  /api/libraries/{id}              (admin)
  DELETE /api/libraries/{id}              (admin)
  POST   /api/libraries/{id}/scan         (admin)

Books
  GET    /api/books?library={id}&page={n}&q={query}&format={fmt}
  GET    /api/books/{id}
  PATCH  /api/books/{id}/metadata
  DELETE /api/books/{id}                  (admin)
  POST   /api/books/upload
  GET    /api/books/{id}/cover
  GET    /api/books/{id}/download         (오프라인 전체 파일)

Reader
  GET    /api/books/{id}/pages            (총 페이지 수, PDF·CBZ)
  GET    /api/books/{id}/pages/{n}        (페이지 이미지, PDF·CBZ)
  GET    /api/books/{id}/epub             (EPUB 파일, epub.js용)

Progress
  GET    /api/books/{id}/progress
  PUT    /api/books/{id}/progress

Annotations                              (PDF · EPUB 전용)
  GET    /api/books/{id}/annotations
  POST   /api/books/{id}/annotations
  PATCH  /api/annotations/{id}
  DELETE /api/annotations/{id}
  GET    /api/books/{id}/annotations/export?format=json|md

Bookmarks                                (CBZ 전용, 페이지 북마크)
  GET    /api/books/{id}/bookmarks
  POST   /api/books/{id}/bookmarks
  DELETE /api/bookmarks/{id}

Users (admin)
  GET    /api/users
  POST   /api/users
  PATCH  /api/users/{id}
  DELETE /api/users/{id}
  PATCH  /api/users/{id}/permissions

Search
  GET    /api/search?q={query}&type={book|annotation}
```

### 핵심 모델

```rust
// src/db/models.rs

#[derive(sqlx::FromRow, Serialize)]
pub struct Book {
    pub id: Uuid,
    pub library_id: Uuid,
    pub title: String,
    pub authors: Vec<String>,
    pub format: BookFormat,          // Pdf | Epub | Cbz
    pub file_path: String,
    pub original_extension: String,  // 원본 확장자 기록 (.zip 등)
    pub cover_path: Option<String>,
    pub page_count: i32,
    pub file_size: i64,
    pub tags: Vec<String>,
    pub description: Option<String>,
    pub year: Option<i32>,
    pub language: Option<String>,
    pub series: Option<String>,
    pub series_index: Option<f32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(sqlx::FromRow, Serialize)]
pub struct Annotation {
    pub id: Uuid,
    pub book_id: Uuid,
    pub user_id: Uuid,
    pub page: i32,
    pub kind: AnnotationKind,        // Highlight | Note
    pub color: Option<String>,
    pub selected_text: Option<String>,
    pub note: Option<String>,
    pub position: serde_json::Value, // PDF 좌표 또는 EPUB CFI
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// CBZ 전용: 페이지 번호만
#[derive(sqlx::FromRow, Serialize)]
pub struct Bookmark {
    pub id: Uuid,
    pub book_id: Uuid,
    pub user_id: Uuid,
    pub page: i32,
    pub label: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(sqlx::FromRow, Serialize)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub password_hash: String,
    pub role: UserRole,              // Admin | Member | Guest
    pub created_at: DateTime<Utc>,
}
```

### 파서 공통 인터페이스

```rust
// src/services/parser/mod.rs

#[async_trait]
pub trait BookParser: Send + Sync {
    async fn page_count(&self, path: &Path) -> Result<u32>;
    async fn render_page(&self, path: &Path, page: u32, dpi: u32) -> Result<Vec<u8>>;
    async fn extract_metadata(&self, path: &Path) -> Result<BookMetadata>;
    async fn extract_cover(&self, path: &Path) -> Result<Option<Vec<u8>>>;
    // PDF 전용: 텍스트 레이어 여부
    fn has_text_layer(&self) -> bool { false }
}
```

---

## 7. 프론트엔드 설계 (SvelteKit)

### SPA 모드 설정

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      fallback: 'index.html',  // SPA 폴백
    }),
  },
};
```

### 라우트 구조

```
/ (루트 레이아웃: 반응형 사이드바 + 상단바)
├── /                홈 — 최근 읽은 책, 라이브러리 그리드
├── /login
├── /library/{id}    책 목록, 필터, 정렬
├── /book/{id}       책 상세 — 메타데이터, 어노테이션/북마크 목록
├── /book/{id}/read  풀스크린 리더
├── /offline         오프라인 다운로드 관리
└── /admin
    ├── /users
    └── /libraries
```

### 반응형 레이아웃

```
모바일 (< 640px)
  - 사이드바 없음
  - 하단 탭 바: 홈 / 검색 / 오프라인 / 설정
  - 책 그리드: 2열
  - 리더: 전체 화면, 탭으로 패널 전환

태블릿 (640~1024px)
  - 사이드바: 햄버거 메뉴로 토글
  - 책 그리드: 3~4열
  - 리더: 슬라이드 오버 패널

데스크탑 (> 1024px)
  - 사이드바 고정 (240px)
  - 책 그리드: 5~6열
  - 리더: 우측 고정 패널 (어노테이션)
```

### 리더 컴포넌트 구조

```
ReadPage.svelte
├── ReaderToolbar.svelte
│   └── 모바일: 하단 고정 / 데스크탑: 상단
├── PdfReader.svelte
│   ├── canvas (렌더링)
│   ├── TextLayer (선택·검색)
│   └── AnnotationLayer.svelte
├── EpubReader.svelte
│   └── epub.js iframe + AnnotationLayer
├── CbzReader.svelte
│   └── BookmarkLayer.svelte (페이지 북마크만)
└── [AnnotationPanel | BookmarkPanel].svelte
    └── 포맷에 따라 조건부 렌더링
```

### 스토어 설계

```typescript
// stores/library.ts
export const books = writable<Book[]>([]);
export const searchQuery = writable('');
export const activeFormat = writable<'all' | 'pdf' | 'epub' | 'cbz'>('all');

export const filteredBooks = derived(
  [books, searchQuery, activeFormat],
  ([$books, $q, $fmt]) =>
    $books
      .filter(b => $fmt === 'all' || b.format === $fmt)
      .filter(b =>
        b.title.toLowerCase().includes($q.toLowerCase()) ||
        b.authors.some(a => a.toLowerCase().includes($q.toLowerCase()))
      )
);
```

---

## 8. 핵심 기능 구현 계획

### 8.1 PDF 리더 (pdf.js + 텍스트 레이어)

```svelte
<!-- PdfReader.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import * as pdfjsLib from 'pdfjs-dist';
  import AnnotationLayer from './AnnotationLayer.svelte';

  export let bookId: string;
  export let page: number = 1;

  let canvas: HTMLCanvasElement;
  let textLayerDiv: HTMLDivElement;

  onMount(async () => {
    const source = await getBookSource(bookId);  // 온/오프라인 통합
    const pdfDoc = await pdfjsLib.getDocument(source).promise;
    await renderPage(pdfDoc, page);
  });

  async function renderPage(doc: pdfjsLib.PDFDocumentProxy, n: number) {
    const pdfPage = await doc.getPage(n);
    const scale = window.devicePixelRatio;
    const viewport = pdfPage.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await pdfPage.render({
      canvasContext: canvas.getContext('2d')!,
      viewport,
    }).promise;

    // 텍스트 레이어: 선택 및 어노테이션 위치 기반
    const textContent = await pdfPage.getTextContent();
    textLayerDiv.innerHTML = '';
    pdfjsLib.renderTextLayer({
      textContentSource: textContent,
      container: textLayerDiv,
      viewport,
    });
  }
</script>

<div class="relative w-full">
  <canvas bind:this={canvas} class="w-full" />
  <div bind:this={textLayerDiv} class="absolute inset-0 text-layer" />
  <AnnotationLayer {bookId} {page} />
</div>
```

### 8.2 EPUB 리더 (epub.js + CFI 어노테이션)

```svelte
<!-- EpubReader.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import ePub from 'epubjs';

  export let bookId: string;

  let container: HTMLDivElement;

  onMount(async () => {
    const blob = await getBookBlob(bookId);
    const book = ePub(blob);
    const rendition = book.renderTo(container, {
      width: '100%',
      height: '100%',
      spread: 'none',
    });

    await rendition.display();

    // 텍스트 선택 → 어노테이션 팝업
    rendition.on('selected', (cfiRange: string, contents: any) => {
      const selectedText = contents.window.getSelection()?.toString();
      if (selectedText) openAnnotationDialog(cfiRange, selectedText);
    });
  });
</script>

<div bind:this={container} class="h-full w-full" />
```

### 8.3 CBZ 리더 (zip.js + 이미지 렌더링)

CBZ는 어노테이션 없이 이미지 순차 렌더링과 페이지 북마크만 지원한다.

```typescript
// lib/readers/cbz.ts
import { BlobReader, ZipReader, BlobWriter } from '@zip.js/zip.js';

export async function extractCbzPages(blob: Blob): Promise<string[]> {
  const zipReader = new ZipReader(new BlobReader(blob));
  const entries = await zipReader.getEntries();

  const imageEntries = entries
    .filter(e => /\.(jpg|jpeg|png|webp|gif)$/i.test(e.filename))
    // 숫자 기준 자연어 정렬
    .sort((a, b) =>
      a.filename.localeCompare(b.filename, undefined, { numeric: true })
    );

  const urls: string[] = [];
  for (const entry of imageEntries) {
    const imgBlob = await entry.getData!(new BlobWriter());
    urls.push(URL.createObjectURL(imgBlob));
  }

  await zipReader.close();
  return urls;
}
```

### 8.4 어노테이션 위치 스키마

PDF와 EPUB의 위치 표현 방식이 달라 통합 JSON 스키마로 관리한다. CBZ는 이 스키마를 사용하지 않는다.

```typescript
interface AnnotationPosition {
  // PDF: 좌표 기반
  pdf?: {
    page: number;
    rects: Array<{ x: number; y: number; width: number; height: number }>;
  };
  // EPUB: CFI (Canonical Fragment Identifier) 기반
  epub?: {
    cfi: string;      // e.g. "epubcfi(/6/4[ch01]!/4/2/1:0)"
    cfiEnd?: string;  // 범위 선택 시
  };
}
```

### 8.5 어노테이션 vs. 북마크 포맷별 지원 정리

| 기능 | PDF | EPUB | CBZ |
|---|---|---|---|
| 텍스트 하이라이트 | ✅ | ✅ | ❌ |
| 텍스트 노트 | ✅ | ✅ | ❌ |
| 색상 태그 | ✅ | ✅ | ❌ |
| 어노테이션 내보내기 | ✅ | ✅ | ❌ |
| 페이지 북마크 | ✅ | ✅ | ✅ |

---

## 9. 데이터베이스 스키마

PostgreSQL 기본. `sqlx` 마이그레이션으로 관리.

```sql
-- 라이브러리
CREATE TABLE libraries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  path       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('books', 'comics', 'mixed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 책
CREATE TABLE books (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id         UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  authors            TEXT[] NOT NULL DEFAULT '{}',
  format             TEXT NOT NULL CHECK (format IN ('pdf', 'epub', 'cbz')),
  file_path          TEXT NOT NULL UNIQUE,
  original_extension TEXT NOT NULL,       -- 원본 확장자 (.zip 등)
  cover_path         TEXT,
  page_count         INTEGER,
  file_size          BIGINT NOT NULL,
  description        TEXT,
  year               INTEGER,
  language           TEXT,
  tags               TEXT[] NOT NULL DEFAULT '{}',
  series             TEXT,
  series_index       REAL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 유저
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('admin', 'member', 'guest')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 라이브러리별 접근 권한
CREATE TABLE library_permissions (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  can_read   BOOLEAN NOT NULL DEFAULT true,
  can_upload BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, library_id)
);

-- 읽기 진행도
CREATE TABLE reading_progress (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id    UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page       INTEGER NOT NULL DEFAULT 0,
  cfi        TEXT,                          -- EPUB 전용
  percent    REAL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

-- 어노테이션 (PDF · EPUB 전용)
CREATE TABLE annotations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('highlight', 'note')),
  color         TEXT,
  selected_text TEXT,
  note          TEXT,
  position      JSONB NOT NULL,             -- PDF 좌표 또는 EPUB CFI
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 북마크 (모든 포맷, CBZ는 이것만 사용)
CREATE TABLE bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id    UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page       INTEGER NOT NULL,
  label      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_books_library    ON books(library_id);
CREATE INDEX idx_books_format     ON books(format);
CREATE INDEX idx_annotations_book ON annotations(book_id, user_id);
CREATE INDEX idx_bookmarks_book   ON bookmarks(book_id, user_id);
CREATE INDEX idx_progress_user    ON reading_progress(user_id);
```

---

## 10. PWA · 오프라인 전략

### Service Worker 캐싱 레이어

```
레이어 1: App Shell (항상 캐시)
  SvelteKit 빌드 결과물 (JS, CSS, HTML), 아이콘, 폰트

레이어 2: API 응답 (Network First, 1시간 TTL)
  /api/books 목록, /api/books/{id} 메타데이터, /api/books/{id}/progress

레이어 3: 책 파일 (명시적 다운로드만)
  사용자가 "오프라인 저장" 선택 시만 IndexedDB에 저장
  자동 캐싱 없음 (용량 관리)
```

### PWA 설정

```javascript
// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    sveltekit(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.ts',
      manifest: {
        name: '전자책 서버',
        short_name: 'EbookServer',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1a1a2e',
        icons: [
          { src: '/icons/192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
};
```

### 오프라인 다운로드

```typescript
// lib/offline/downloader.ts
import { openDB } from 'idb';

export async function downloadForOffline(bookId: string) {
  const db = await openDB('ebook-offline', 1, {
    upgrade(db) {
      db.createObjectStore('books', { keyPath: 'id' });
    },
  });

  const [fileBlob, metadata, progress, annotations, bookmarks] =
    await Promise.all([
      fetch(`/api/books/${bookId}/download`).then(r => r.blob()),
      fetch(`/api/books/${bookId}`).then(r => r.json()),
      fetch(`/api/books/${bookId}/progress`).then(r => r.json()),
      fetch(`/api/books/${bookId}/annotations`).then(r => r.json()),
      fetch(`/api/books/${bookId}/bookmarks`).then(r => r.json()),
    ]);

  await db.put('books', {
    id: bookId,
    fileBlob,
    metadata,
    progress,
    annotations,
    bookmarks,
    downloadedAt: new Date(),
  });
}
```

### 온라인 복귀 동기화

```typescript
// lib/offline/sync.ts
export async function syncOnReconnect() {
  const db = await openDB('ebook-offline', 1);
  const offlineBooks = await db.getAll('books');

  for (const book of offlineBooks) {
    await Promise.allSettled([
      syncProgress(book.id, book.progress),
      syncAnnotations(book.id, book.annotations),
      syncBookmarks(book.id, book.bookmarks),
    ]);
  }
}

window.addEventListener('online', syncOnReconnect);
```

---

## 11. 멀티유저 · 권한 시스템

### 역할 정의

| 역할 | 주요 권한 |
|---|---|
| **Admin** | 전체 접근, 유저 관리, 라이브러리 관리, 책 업로드·삭제, 메타데이터 수정 |
| **Member** | 허용된 라이브러리 읽기, 본인 어노테이션·북마크 관리, 책 업로드 (설정 가능) |
| **Guest** | 허용된 라이브러리 읽기만, 어노테이션·북마크 없음 |

### 권한 매트릭스

| 액션 | Admin | Member | Guest |
|---|---|---|---|
| 책 조회 · 읽기 | ✅ | ✅ | ✅ |
| 어노테이션 생성 | ✅ | ✅ | ❌ |
| 본인 어노테이션 수정·삭제 | ✅ | ✅ | ❌ |
| 타인 어노테이션 수정·삭제 | ✅ | ❌ | ❌ |
| 북마크 관리 | ✅ | ✅ | ❌ |
| 책 업로드 | ✅ | 설정 가능 | ❌ |
| 메타데이터 수정 | ✅ | ❌ | ❌ |
| 책 삭제 | ✅ | ❌ | ❌ |
| 유저 관리 | ✅ | ❌ | ❌ |
| 라이브러리 관리 | ✅ | ❌ | ❌ |

### 인증 플로우

```
1. POST /api/auth/login
   → argon2 비밀번호 검증
   → Access Token (15분 유효, 메모리 저장)
   → Refresh Token (30일 유효, HttpOnly Cookie)

2. 모든 API: Authorization: Bearer {access_token}

3. Access Token 만료 시:
   → POST /api/auth/refresh
   → 새 Access Token 발급

4. 보안:
   - Access Token: 메모리에만 저장 (XSS 방어)
   - Refresh Token: HttpOnly Cookie (XSS 방어)
```

---

## 12. 어노테이션 · 북마크 시스템

### 어노테이션 UI 플로우 (PDF · EPUB)

```
1. 텍스트 드래그 선택
   → 선택 범위 위에 팝업 툴바 표시
   → [● 노랑] [● 초록] [● 파랑] [✏️ 노트]

2. 색상 선택 → 하이라이트 즉시 렌더링
   → POST /api/books/{id}/annotations

3. 어노테이션 클릭 → 사이드 패널에서 노트 편집
   → PATCH /api/annotations/{id}

4. 내보내기 형식:
   ## 책 제목

   ### p.42
   > 선택된 텍스트
   노트: 사용자 메모
```

### 북마크 UI 플로우 (CBZ · 전 포맷)

```
1. 툴바의 북마크 아이콘 클릭
   → POST /api/books/{id}/bookmarks { page, label? }

2. 북마크 패널에 목록 표시
   → 클릭 시 해당 페이지로 이동

3. 북마크 삭제
   → DELETE /api/bookmarks/{id}
```

### PDF 어노테이션 오버레이 렌더링

```typescript
function renderHighlights(
  annotations: Annotation[],
  viewport: pdfjsLib.PageViewport,
  currentPage: number
) {
  const svg = document.getElementById('annotation-svg')!;
  svg.innerHTML = '';

  for (const ann of annotations.filter(a => a.position.pdf?.page === currentPage)) {
    for (const rect of ann.position.pdf!.rects) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const [x, y] = viewport.convertToViewportPoint(rect.x, rect.y);
      el.setAttribute('x', String(x));
      el.setAttribute('y', String(y - rect.height * viewport.scale));
      el.setAttribute('width', String(rect.width * viewport.scale));
      el.setAttribute('height', String(rect.height * viewport.scale));
      el.setAttribute('fill', ann.color ?? '#ffeb3b');
      el.setAttribute('fill-opacity', '0.35');
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => selectAnnotation(ann.id));
      svg.appendChild(el);
    }
  }
}
```

---

## 13. Docker 배포 구성

`docker compose up -d` 한 번으로 nginx + 백엔드 + PostgreSQL이 모두 실행되고, 외부에는 80/443 포트만 노출된다.

### docker-compose.yml

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"     # TLS 사용 시
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro    # TLS 인증서
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    # 외부 포트 노출 없음 — nginx가 정적 파일 서빙

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    volumes:
      - books_data:/books
      - thumbs_data:/thumbs
      - search_index:/search
    environment:
      DATABASE_URL: postgres://ebook:${DB_PASSWORD}@postgres:5432/ebook
      BOOKS_PATH: /books
      THUMBS_PATH: /thumbs
      SEARCH_INDEX_PATH: /search
      JWT_SECRET: ${JWT_SECRET}
      SERVER_PORT: "3001"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ebook
      POSTGRES_USER: ebook
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ebook"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  books_data:
  thumbs_data:
  search_index:
  pg_data:
```

### nginx/nginx.conf

```nginx
events { worker_processes auto; }

http {
  include       mime.types;
  default_type  application/octet-stream;
  sendfile      on;
  gzip          on;
  gzip_types    text/plain text/css application/javascript application/json;

  server {
    listen 80;

    # API 요청 → 백엔드
    location /api/ {
      proxy_pass         http://backend:3001;
      proxy_set_header   Host $host;
      proxy_set_header   X-Real-IP $remote_addr;
      proxy_read_timeout 300s;  # 대용량 파일 업로드 대비
    }

    # 정적 파일 → 프론트엔드 컨테이너
    location / {
      proxy_pass http://frontend:80;

      # SPA 폴백: 404를 index.html로
      proxy_intercept_errors on;
      error_page 404 = @fallback;
    }

    location @fallback {
      proxy_pass http://frontend:80/index.html;
    }
  }
}
```

### frontend/Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 빌드 결과물을 nginx로 서빙
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```nginx
# nginx-frontend.conf (프론트엔드 컨테이너 내부)
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # SPA 폴백
  location / {
    try_files $uri $uri/ /index.html;
  }

  # 정적 자산 장기 캐시
  location ~* \.(js|css|woff2|png|webp|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

### backend/Dockerfile

```dockerfile
# 빌드
FROM rust:1.77-slim AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
# 의존성만 먼저 빌드 (캐시 활용)
RUN mkdir src && echo "fn main(){}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

COPY src ./src
RUN touch src/main.rs && cargo build --release

# 런타임 (최소 이미지)
FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y ca-certificates libssl3 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/ebook-server /usr/local/bin/
EXPOSE 3001
CMD ["ebook-server"]
```

### .env.example

```env
DB_PASSWORD=change_me_strong_password
JWT_SECRET=change_me_min_32_chars_random_string
```

### 실행 방법

```bash
cp .env.example .env
# .env 편집 후

docker compose up -d

# 로그 확인
docker compose logs -f backend

# 업데이트
docker compose pull
docker compose up -d --build
```

---

## 14. 테스트 전략

### 기본 방침

혼자 개발하는 프로젝트에서 테스트 커버리지 목표를 높게 잡는 것은 실익보다 오버헤드가 크다. 단, **런타임에서 발견하기 어렵거나, 보안과 직결되거나, 파일 포맷 다양성으로 인한 엣지케이스가 많은 영역**에는 테스트를 작성한다.

```
테스트 작성 (~20% 코드)          수동 확인 (~80% 코드)
─────────────────────────        ──────────────────────────
파서 (PDF · EPUB · CBZ)          API 엔드포인트 해피 패스
권한 매트릭스                     프론트엔드 컴포넌트 렌더링
JWT · 인증 로직                   E2E 시나리오
포맷 자동 감지                    DB 스키마 연동
```

### 14.1 파서 테스트

파일 포맷 다양성과 손상 파일 엣지케이스는 개발 중 수동으로 전부 커버하기 어렵다. 픽스처 파일을 한 번 만들어두면 이후 리팩토링·의존성 업그레이드 시 안전망이 된다.

**픽스처 파일** (`tests/fixtures/`)

```
pdf/
  single_page.pdf         1페이지, 텍스트 레이어 있음
  multi_page_100.pdf      100페이지
  scanned_only.pdf        이미지만, 텍스트 레이어 없음
  ocr_text.pdf            OCR 처리됨
  with_metadata.pdf       제목·저자·연도 포함
  no_metadata.pdf         메타데이터 없음
  korean_text.pdf         한글 텍스트
  corrupted.pdf           손상 파일
  empty.pdf               0바이트
epub/
  epub2_valid.epub
  epub3_valid.epub
  with_cover.epub
  rtl_manga.epub
  corrupted.epub
cbz/
  valid_10pages.cbz
  with_comicinfo.cbz      ComicInfo.xml 포함
  unsorted_filenames.cbz  파일명 순서 뒤섞임 (0,10,2...)
  corrupted.cbz
zip/
  epub_in_zip.zip         .zip 확장자이나 내부가 EPUB
  cbz_in_zip.zip          .zip 확장자이나 내부가 이미지
  ambiguous.zip           판별 불가 내용물
```

**PDF 파서 테스트 케이스**

| ID | 픽스처 | 검증 항목 | 기대 결과 |
|---|---|---|---|
| PDF-01 | `single_page.pdf` | `page_count()` | `1` |
| PDF-02 | `multi_page_100.pdf` | `page_count()` | `100` |
| PDF-03 | `multi_page_100.pdf` | `render_page(50)` | 바이트 > 0 |
| PDF-04 | `scanned_only.pdf` | `has_text_layer()` | `false` |
| PDF-05 | `ocr_text.pdf` | `has_text_layer()` | `true` |
| PDF-06 | `with_metadata.pdf` | `extract_metadata()` | 제목·저자 정확히 추출 |
| PDF-07 | `no_metadata.pdf` | `extract_metadata()` | `None`, 에러 없음 |
| PDF-08 | `korean_text.pdf` | `extract_metadata()` | 한글 정상 추출 |
| PDF-09 | `corrupted.pdf` | `page_count()` | `Err`, 패닉 없음 |
| PDF-10 | `empty.pdf` | `page_count()` | `Err` |
| PDF-11 | `multi_page_100.pdf` | `render_page(0)` | `Err` (1-based) |
| PDF-12 | `multi_page_100.pdf` | `render_page(101)` | `Err` |

**EPUB 파서 테스트 케이스**

| ID | 픽스처 | 검증 항목 | 기대 결과 |
|---|---|---|---|
| EPUB-01 | `epub2_valid.epub` | 파싱 | 성공 |
| EPUB-02 | `epub3_valid.epub` | 파싱 | 성공 |
| EPUB-03 | `with_cover.epub` | `extract_cover()` | 바이트 반환 |
| EPUB-04 | `epub2_valid.epub` | `extract_cover()` | `None`, 에러 없음 |
| EPUB-05 | `with_cover.epub` | 메타데이터 추출 | 제목·저자·언어 |
| EPUB-06 | `rtl_manga.epub` | 읽기 방향 감지 | `rtl` |
| EPUB-07 | `corrupted.epub` | 파싱 | `Err`, 패닉 없음 |

**CBZ 파서 테스트 케이스**

| ID | 픽스처 | 검증 항목 | 기대 결과 |
|---|---|---|---|
| CBZ-01 | `valid_10pages.cbz` | `page_count()` | `10` |
| CBZ-02 | `valid_10pages.cbz` | `render_page(1)` | 바이트 반환 |
| CBZ-03 | `unsorted_filenames.cbz` | 페이지 순서 | 숫자 기준 정렬 |
| CBZ-04 | `with_comicinfo.cbz` | 메타데이터 추출 | ComicInfo.xml 파싱 |
| CBZ-05 | `corrupted.cbz` | 파싱 | `Err`, 패닉 없음 |

---

### 14.2 포맷 감지 테스트

| ID | 입력 | 기대 결과 | 비고 |
|---|---|---|---|
| FD-01 | `valid.pdf` | `Pdf` | |
| FD-02 | `epub_in_zip.zip` | `Epub` | .zip 확장자이나 내부가 EPUB |
| FD-03 | `cbz_in_zip.zip` | `Cbz` | .zip 확장자이나 내부가 이미지 |
| FD-04 | `valid.cbz` | `Cbz` | |
| FD-05 | `valid.epub` | `Epub` | |
| FD-06 | `cbz_named.epub` | `Cbz` | .epub 확장자이나 내부가 이미지 |
| FD-07 | `ambiguous.zip` | `None` | 판별 불가 |
| FD-08 | `file.txt` | `None` | |
| FD-09 | `BOOK.PDF` | `Pdf` | 대소문자 |
| FD-10 | `corrupted_zip.cbz` | `None` | ZIP 파싱 실패 |
| FD-11 | `empty.pdf` | `None` | 0바이트 |

---

### 14.3 권한 테스트

권한 구멍은 보안 버그로 이어지고, Admin·Member·Guest × 각 액션의 조합을 수동으로 매번 확인하기 어렵다. 기능 추가 때마다 이 테스트가 회귀를 방어한다.

```rust
// tests/integration/permissions.rs

#[sqlx::test]
async fn member_cannot_delete_book(pool: PgPool) {
    let member_token = create_user_and_token(&pool, UserRole::Member).await;
    let book_id = insert_test_book(&pool).await;

    let response = delete_book(&pool, &member_token, book_id).await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[sqlx::test]
async fn guest_cannot_create_annotation(pool: PgPool) {
    let guest_token = create_user_and_token(&pool, UserRole::Guest).await;
    let book_id = insert_test_book(&pool).await;

    let response = create_annotation(&pool, &guest_token, book_id).await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[sqlx::test]
async fn member_cannot_edit_others_annotation(pool: PgPool) {
    let user1_token = create_user_and_token(&pool, UserRole::Member).await;
    let user2_token = create_user_and_token(&pool, UserRole::Member).await;
    let book_id = insert_test_book(&pool).await;

    let annotation_id = create_annotation_as(&pool, &user1_token, book_id).await;
    let response = edit_annotation(&pool, &user2_token, annotation_id).await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[sqlx::test]
async fn user_cannot_access_restricted_library(pool: PgPool) {
    let user = create_user_and_token(&pool, UserRole::Member).await;
    let library_id = create_library_without_permission(&pool, user.id).await;

    let response = get_books_in_library(&pool, &user.token, library_id).await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}
```

**커버할 권한 케이스 목록**

| ID | 역할 | 액션 | 기대 |
|---|---|---|---|
| P-01 | Member | 책 삭제 | 403 |
| P-02 | Guest | 어노테이션 생성 | 403 |
| P-03 | Guest | 북마크 생성 | 403 |
| P-04 | Member | 타인 어노테이션 수정 | 403 |
| P-05 | Member | 타인 어노테이션 삭제 | 403 |
| P-06 | Member | 유저 생성 | 403 |
| P-07 | Member | 라이브러리 생성 | 403 |
| P-08 | Member | 메타데이터 수정 | 403 |
| P-09 | 비인증 | 책 조회 | 401 |
| P-10 | Member | 비허용 라이브러리 접근 | 403 |
| P-11 | Admin | 모든 액션 | 200 |
| P-12 | Member | 본인 어노테이션 수정 | 200 |

---

### 14.4 JWT · 인증 테스트

만료 토큰, 서명 위조 등은 수동 재현이 번거롭고 보안 버그로 이어진다.

| ID | 시나리오 | 기대 결과 |
|---|---|---|
| JWT-01 | 유효한 토큰 | `AuthUser` 추출 성공 |
| JWT-02 | 만료된 Access Token | 401 |
| JWT-03 | 잘못된 서명 | 401 |
| JWT-04 | `alg: none` 공격 | 401 |
| JWT-05 | Bearer 접두사 없음 | 401 |
| JWT-06 | 유효한 Refresh Token | 새 Access Token 발급 |
| JWT-07 | 만료된 Refresh Token | 401 |
| JWT-08 | 로그아웃 후 기존 Refresh Token | 401 |
| PW-01 | 올바른 비밀번호 검증 | `true` |
| PW-02 | 틀린 비밀번호 검증 | `false` |
| PW-03 | 동일 비밀번호 두 번 해싱 | 해시값 서로 다름 (salt) |

---

### 14.5 테스트 실행

```bash
# 파서 + 포맷 감지 단위 테스트
cargo test --lib

# 권한 + 인증 통합 테스트 (PostgreSQL 필요)
cargo test --test integration

# 전체
cargo test
```

CI 구성: PR마다 `cargo test` 전체 실행. E2E, 성능, 보안 스캔은 main 머지 시에만.

---

## 15. 개발 로드맵

### Phase 0 — 기반 세팅 (1~2주)

- [ ] Rust 프로젝트 초기화, Axum 기본 설정
- [ ] PostgreSQL + sqlx 마이그레이션 파이프라인
- [ ] SvelteKit + Tailwind + vite-plugin-pwa 초기화
- [ ] Docker Compose 전체 스택 (nginx + backend + postgres)
- [ ] GitHub Actions CI (build + `cargo test`)

### Phase 1 — 코어 MVP (3~4주)

- [ ] 포맷 감지: 매직 바이트 + ZIP 내부 구조 판별
- [ ] 파일 파서: PDF, EPUB, CBZ
- [ ] 라이브러리 스캐너
- [ ] REST API: 라이브러리·책 CRUD
- [ ] JWT 인증 (단일 관리자로 시작)
- [ ] 프론트: 라이브러리 그리드, 책 상세 (반응형)
- [ ] PDF 리더 (pdf.js, 텍스트 레이어)
- [ ] EPUB 리더 (epub.js)
- [ ] CBZ 리더 (zip.js + 이미지)

### Phase 2 — 오프라인 + PWA (2주)

- [ ] Service Worker: App Shell 캐싱
- [ ] 오프라인 다운로드 (IndexedDB)
- [ ] 읽기 진행도 오프라인 저장
- [ ] 온라인 복귀 동기화
- [ ] PWA manifest, 아이콘, 설치 프롬프트
- [ ] 모바일 레이아웃 최종 점검

### Phase 3 — 어노테이션 · 북마크 (2~3주)

- [ ] 어노테이션 DB + API (PDF · EPUB)
- [ ] 북마크 DB + API (전 포맷)
- [ ] PDF 어노테이션 오버레이 (SVG)
- [ ] EPUB 어노테이션 (CFI 기반)
- [ ] CBZ 북마크 패널 UI
- [ ] 어노테이션 내보내기 (JSON, Markdown)
- [ ] 오프라인 어노테이션 · 북마크 동기화

### Phase 4 — 멀티유저 (2주)

- [ ] 유저 모델, 역할 시스템
- [ ] 라이브러리별 권한 설정
- [ ] 관리자 대시보드
- [ ] Refresh Token 기반 인증 보완

### Phase 5 — 검색 · 메타데이터 (1~2주)

- [ ] tantivy 풀텍스트 검색 인덱싱
- [ ] 메타데이터 편집 UI
- [ ] 태그, 시리즈, 필터
- [ ] 책 업로드 UI (드래그 앤 드롭)

### Phase 6 — 다듬기 (지속)

- [ ] 썸네일 최적화 (WebP, 지연 생성)
- [ ] 성능 프로파일링
- [ ] `cargo audit` + `npm audit` CI 자동화
- [ ] 문서화, README

---

## 16. 미결 결정사항

| 항목 | 옵션 A | 옵션 B | 비고 |
|---|---|---|---|
| 중복 파일 업로드 | 409 에러 | 덮어쓰기 허용 | |
| 로그인 연속 실패 | 429 Rate Limit | 계정 잠금 | |
| Admin이 타인 어노테이션 조회 | 가능 | 불가 | |
| 오프라인 어노테이션 충돌 | 최신 타임스탬프 우선 | 수동 해결 UI | |
| 외부 메타데이터 조회 | Google Books API 연동 | 수동 편집만 | API 키 관리 부담 |
| TLS 종료 | nginx 직접 처리 | 앞단 Caddy/Traefik | 환경에 따라 |
| CBZ ComicInfo.xml 없을 때 | 파일명에서 제목 추출 | 빈 메타데이터 | |

---

*블루프린트 v2 — 개발 진행에 따라 지속 업데이트.*
