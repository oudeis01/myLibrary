# myLibrary

Self-hosted ebook server with offline reading, multi-user support, and annotations.

Supports PDF, EPUB, and CBZ formats. Rendered entirely in the browser via format-specific readers. Deployable with a single `docker compose up`.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Rust, Axum 0.7, SQLx, PostgreSQL 16 |
| Frontend | SvelteKit (SPA/PWA), Tailwind CSS v4 |
| Auth | JWT (Argon2 password hashing, access + refresh tokens) |
| Search | Tantivy fulltext index |
| Reverse Proxy | nginx |
| Deployment | Docker Compose |

### Backend Dependencies

| Purpose | Crate |
|---|---|
| HTTP framework | `axum` 0.7 |
| Async runtime | `tokio` |
| Database | `sqlx` (PostgreSQL, compile-time query checking) |
| PDF parsing | `lopdf`, `pdf-extract` |
| EPUB parsing | `epub` |
| ZIP/CBZ handling | `zip` |
| Image processing | `image` (JPEG, PNG) |
| Fulltext search | `tantivy` |
| Auth | `jsonwebtoken`, `argon2` |

### Frontend Dependencies

| Purpose | Package |
|---|---|
| PDF rendering | `pdfjs-dist` |
| EPUB rendering | `epubjs` |
| CBZ (ZIP inflate) | `@zip.js/zip.js` |
| Offline storage | `idb` (IndexedDB) |
| HTTP client | `ky` |
| PWA | `vite-plugin-pwa` |
| Icons | `lucide-svelte` |

## Architecture

```mermaid
graph TB
    subgraph Client["Client (Browser / PWA)"]
        PDF["PDF Reader<br/>pdfjs-dist"]
        EPUB["EPUB Reader<br/>epubjs"]
        CBZ["CBZ Reader<br/>zip.js"]
        SW["Service Worker<br/>3-tier caching"]
        IDB["IndexedDB<br/>offline storage"]
    end

    subgraph Proxy["nginx (:80/:443)"]
        STATIC["GET /<br/>static files"]
        API["GET /api/*<br/>reverse proxy"]
    end

    subgraph Backend["Rust + Axum (:3001)"]
        AUTH["Auth Router<br/>login / refresh / logout"]
        LIB["Library Router<br/>CRUD + scan"]
        BOOKS["Books Router<br/>list / detail / download"]
        READER["Reader Router<br/>EPUB / cover serving"]
        PROG["Progress Router<br/>reading position"]
        ANN["Annotation Router<br/>highlights / notes / export"]
        BM["Bookmark Router<br/>page bookmarks (CBZ)"]
        SCANNER["File Scanner<br/>background task"]
        SEARCH["Tantivy Index<br/>fulltext search"]
    end

    subgraph Storage["PostgreSQL (:5432)"]
        DB[(users, libraries,<br/>books, annotations,<br/>bookmarks, progress,<br/>permissions, refresh_tokens)]
    end

    subgraph FS["File System"]
        BOOKS_DIR["data/books/<br/>ebook files"]
        THUMBS_DIR["data/thumbs/<br/>cover images"]
    end

    Client --> Proxy
    STATIC --> Client
    API --> Backend
    Backend --> Storage
    Backend --> FS
    SCANNER --> BOOKS_DIR
    SCANNER --> THUMBS_DIR
```

## Features

### Format Support

| Format | Reading | Annotations | Bookmarks | Cover |
|---|---|---|---|---|
| PDF | Page rendering via pdf.js | Highlights, notes, color tags | Page bookmarks | Extracted from first page |
| EPUB | CFI-based via epub.js | Highlights, notes, color tags | Page bookmarks | Extracted from metadata |
| CBZ | Image sequence via zip.js | Not supported | Page bookmarks | First image |

Format detection uses magic bytes and internal structure inspection, not file extensions:
- `%PDF` magic: PDF
- `PK\x03\x04` magic + `mimetype` file containing `application/epub+zip`: EPUB
- `PK\x03\x04` magic + image-only contents: CBZ

### Offline Reading (PWA)

- Service Worker with 3-tier caching: app shell (cache-first), API (network-first), files (manual)
- Download books to IndexedDB for offline access
- Reading progress saved locally and synced on reconnect
- Installable as a PWA on mobile and desktop

### Multi-user and Access Control

| Role | Capabilities |
|---|---|
| admin | Create/delete libraries, manage users, scan, full access |
| member | Read libraries with granted permissions, read books, annotations |
| guest | Read-only access to permitted libraries |

Library-level permissions: `can_read`, `can_upload`, `can_edit`, `can_delete`, `can_manage`.

### Annotations and Bookmarks

- Highlights with color tags (PDF, EPUB)
- Text notes attached to highlights
- Page bookmarks (all formats)
- Export annotations as JSON or Markdown

### API Testing

Bruno collection included in `ebook-server/bruno-tests/`. Covers all 17 endpoints with automated token management and variable chaining.

```bash
# Run full API test suite
cd ebook-server/bruno-tests
bru run --env Local
```

## Project Structure

```
ebook-server/
├── backend/                     # Rust backend
│   ├── src/
│   │   ├── main.rs              # AppState, server startup
│   │   ├── config.rs            # Environment config loader
│   │   ├── error.rs             # AppError enum
│   │   ├── models.rs            # Database models
│   │   ├── db.rs                # Connection pool + migrations
│   │   ├── api/
│   │   │   ├── mod.rs           # Router assembly
│   │   │   ├── auth.rs          # Login, refresh, logout
│   │   │   ├── libraries.rs     # Library CRUD + scan
│   │   │   ├── books.rs         # Book list, detail, download
│   │   │   ├── reader.rs        # EPUB and cover serving
│   │   │   ├── progress.rs      # Reading progress (UPSERT)
│   │   │   ├── annotations.rs   # Annotation CRUD + export
│   │   │   └── bookmarks.rs     # Bookmark CRUD
│   │   ├── auth/
│   │   │   ├── middleware.rs    # JWT extraction, AuthUser
│   │   │   └── mod.rs           # Token creation, hashing
│   │   └── services/
│   │       ├── scanner.rs       # Recursive directory scanner
│   │       ├── format_detector.rs  # Magic-byte format detection
│   │       └── parser/
│   │           ├── pdf.rs       # PDF metadata extraction
│   │           ├── epub.rs      # EPUB metadata extraction
│   │           └── cbz.rs       # CBZ metadata extraction
│   ├── Cargo.toml
│   └── Dockerfile
├── frontend/                    # SvelteKit SPA/PWA
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api/             # HTTP client (ky)
│   │   │   ├── readers/         # PDF, EPUB, CBZ reader components
│   │   │   ├── components/      # BookCard, AnnotationPanel, BookmarkPanel
│   │   │   ├── stores/          # Svelte 5 runes stores
│   │   │   └── offline/         # IndexedDB, downloader, sync
│   │   ├── routes/              # SvelteKit file-based routing
│   │   └── sw.ts                # Service Worker
│   ├── package.json
│   └── Dockerfile
├── migrations/                  # PostgreSQL migration scripts (001-009)
├── nginx/
│   └── nginx.conf               # Reverse proxy configuration
├── bruno-tests/                 # Bruno API test collection
│   ├── environments/Local.bru   # Dev environment variables
│   ├── auth/                    # Auth endpoint tests
│   ├── libraries/               # Library endpoint tests
│   ├── books/                   # Book endpoint tests
│   ├── reader/                  # Reader endpoint tests
│   ├── progress/                # Progress endpoint tests
│   ├── annotations/             # Annotation endpoint tests
│   └── bookmarks/               # Bookmark endpoint tests
├── docker-compose.yml           # Production deployment
├── docker-compose.dev.yml       # Development (PostgreSQL only)
└── .env.example                 # Environment variable template
```

## API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | No | Login, returns access_token + refresh_token cookie |
| POST | `/api/auth/refresh` | Cookie | Refresh access_token via refresh_token cookie |
| POST | `/api/auth/logout` | Cookie | Revoke refresh_token, clear cookie |

### Libraries

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/libraries` | Bearer | List all libraries |
| POST | `/api/libraries` | Bearer (admin) | Create library |
| GET | `/api/libraries/:id` | Bearer | Get library detail |
| PUT | `/api/libraries/:id` | Bearer (admin) | Update library |
| DELETE | `/api/libraries/:id` | Bearer (admin) | Delete library |
| POST | `/api/libraries/:id/scan` | Bearer (admin) | Trigger background scan |

### Books

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/books` | Bearer | List books (query: library_id, format, q, limit, offset) |
| GET | `/api/books/:id` | Bearer | Book detail with metadata |
| GET | `/api/books/:id/download` | Bearer | Download book file |

### Reader

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/reader/:id/epub` | Bearer | Serve EPUB file for reader |
| GET | `/api/reader/:id/cover` | Bearer | Serve cover image |

### Reading Progress

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/progress/:book_id` | Bearer | Get reading progress |
| PUT | `/api/progress/:book_id` | Bearer | Save/update progress (UPSERT) |

### Annotations

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/books/:id/annotations` | Bearer | List annotations |
| POST | `/api/books/:id/annotations` | Bearer | Create annotation |
| PUT | `/api/annotations/:id` | Bearer | Update annotation |
| DELETE | `/api/annotations/:id` | Bearer | Delete annotation |
| GET | `/api/books/:id/annotations/export?format=json` | Bearer | Export as JSON |
| GET | `/api/books/:id/annotations/export?format=md` | Bearer | Export as Markdown |

### Bookmarks

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/books/:id/bookmarks` | Bearer | List bookmarks |
| POST | `/api/books/:id/bookmarks` | Bearer | Create bookmark |
| DELETE | `/api/bookmarks/:id` | Bearer | Delete bookmark |

## Getting Started

### Prerequisites

- Docker and Docker Compose
- For local development: Rust (stable), Bun, PostgreSQL client

### Production Deployment

```bash
git clone https://github.com/oudeis01/myLibrary.git
cd myLibrary/ebook-server

cp .env.example .env
# Edit .env: set JWT_SECRET (min 32 chars) and DB_PASSWORD

docker compose up -d
```

Access at `http://localhost`. nginx serves the frontend and proxies `/api/*` to the backend.

### Development Setup

```bash
cd ebook-server

# 1. Start PostgreSQL only
docker compose -f docker-compose.dev.yml up -d

# 2. Configure environment
cp .env.example .env
# Edit .env: set JWT_SECRET

# 3. Create an admin user (first time only)
# Generate Argon2 hash:
python3 -c "from argon2 import PasswordHasher; print(PasswordHasher().hash('your_password'))"
# Insert into DB:
psql postgres://ebook:devpassword@localhost:5432/ebook -c \
  "INSERT INTO users (username, password_hash, role) VALUES ('admin', '<hash>', 'admin');"

# 4. Start backend
cd backend
cargo run
# Migrations run automatically on startup

# 5. Start frontend (separate terminal)
cd frontend
bun install
bun run dev
```

**Important**: Use absolute paths for `BOOKS_PATH` and `THUMBS_PATH` in `.env`. Relative paths resolve from the `backend/` directory where `cargo run` executes.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | Min 32 characters. Generate with `openssl rand -base64 32` |
| `DB_PASSWORD` | Yes (production) | PostgreSQL password |
| `DATABASE_URL` | Yes | Full connection string |
| `BOOKS_PATH` | Yes | Absolute path to ebook files directory |
| `THUMBS_PATH` | Yes | Absolute path to thumbnail output directory |
| `SERVER_PORT` | No | Backend port (default: 3001) |
| `RUST_LOG` | No | Log level (default: info) |

## Database

PostgreSQL with 9 migration scripts:

| Migration | Tables |
|---|---|
| 001 | users |
| 002 | libraries |
| 003 | library_permissions |
| 004 | books |
| 005 | reading_progress |
| 006 | annotations |
| 007 | bookmarks |
| 008 | refresh_tokens |
| 009 | indexes |

Migrations run automatically when the backend starts.

## Development Status

| Phase | Description | Status |
|---|---|---|
| 0 | Project scaffolding | Done |
| 1 | Core MVP (parsers, API, JWT auth, readers) | Done |
| 2 | Offline reading + PWA | Done |
| 3 | Annotations and bookmarks | Done |
| 4 | Multi-user + access control | Done |
| 5 | Tantivy fulltext search | Done |
| 6 | Polish (performance, mobile UX, documentation) | Pending |

88 tests (53 unit + 35 integration) across all implemented phases.

## License

All rights reserved.
