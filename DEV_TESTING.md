# Testing Guide

Overview of every testing layer in this project: how to run them, what each covers, and how they fit together.

---

## Testing Layers at a Glance

| Layer | Tool | Scope | When to Run |
|---|---|---|---|
| API integration tests | Bruno | All 17 endpoints end-to-end | After backend changes |
| Backend unit tests | `cargo test` | Format detection, internal logic | During development |
| CI pipeline | GitHub Actions | Build, migrate, test, type-check | Every push / PR |
| Manual verification | curl | Quick health checks, token ops | Ad-hoc debugging |

---

## 1. Local Development Setup

Required before running any tests.

### Prerequisites

| Tool | Verify |
|---|---|
| Docker & Docker Compose | `docker compose version` |
| Rust (stable) | `cargo --version` |
| psql (PostgreSQL client) | `psql --version` |
| Python 3 + argon2-cffi | `python3 -c "import argon2"` |
| Node.js (for Bruno CLI) | `node --version` |

Install missing tools:

```bash
pip install argon2-cffi
npm install -g @usebruno/cli
```

### Start the Database

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps   # Status must be healthy
```

### Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```dotenv
JWT_SECRET=<generate with: openssl rand -base64 32>
DATABASE_URL=postgres://ebook:devpassword@localhost:5432/ebook
BOOKS_PATH=/absolute/path/data/books
THUMBS_PATH=/absolute/path/data/thumbs
SERVER_PORT=3001
RUST_LOG=debug
```

> `BOOKS_PATH` and `THUMBS_PATH` must be **absolute paths**. Relative paths resolve from `backend/` where `cargo run` executes.

### Create Data Directories

```bash
mkdir -p data/books data/thumbs
```

### Create Admin Account

There is no signup API. Insert a user directly:

```bash
# Generate argon2 hash
HASH=$(python3 -c "
from argon2 import PasswordHasher
print(PasswordHasher().hash('devpassword'))
")

# Insert into database
psql postgres://ebook:devpassword@localhost:5432/ebook -c \
  "INSERT INTO users (username, password_hash, role) VALUES ('admin', '$HASH', 'admin');"
```

### Start the Backend

```bash
cd backend && cargo run
```

On success:

```
INFO ebook_server: running migrations
INFO ebook_server: listening on 0.0.0.0:3001
```

---

## 2. API Testing with Bruno

Bruno is the primary tool for API integration testing. The collection covers all 17 endpoints across 7 folders.

### Collection Structure

```
bruno-tests/
├── bruno.json                  # Collection metadata
├── environments/Local.bru      # Environment variables (baseUrl, credentials)
├── auth/
│   ├── Health Check.bru        # GET  /api/health
│   ├── Login.bru               # POST /api/auth/login          -> saves authToken
│   ├── Refresh Token.bru       # POST /api/auth/refresh
│   └── Logout.bru              # POST /api/auth/logout
├── libraries/
│   ├── List Libraries.bru      # GET  /api/libraries
│   ├── Create Library.bru      # POST /api/libraries           -> saves libraryId
│   ├── Get Library.bru         # GET  /api/libraries/:id
│   ├── Update Library.bru      # PUT  /api/libraries/:id
│   ├── Scan Library.bru        # POST /api/libraries/:id/scan
│   └── Delete Library.bru      # DEL  /api/libraries/:id
├── books/
│   ├── List Books.bru          # GET  /api/books
│   ├── Get Book Detail.bru     # GET  /api/books/:id
│   └── Download Book.bru       # GET  /api/books/:id/download
├── reader/
│   ├── Serve EPUB.bru          # GET  /api/reader/:id/epub
│   └── Serve Cover.bru         # GET  /api/reader/:id/cover
├── progress/
│   ├── Save Progress.bru       # PUT  /api/books/:id/progress  -> saves bookId
│   └── Get Progress.bru        # GET  /api/books/:id/progress
├── annotations/
│   ├── List Annotations.bru    # GET  /api/books/:id/annotations
│   ├── Create Annotation.bru   # POST /api/books/:id/annotations -> saves annotationId
│   ├── Update Annotation.bru   # PUT  /api/annotations/:id
│   ├── Delete Annotation.bru   # DEL  /api/annotations/:id
│   ├── Export Annotations (JSON).bru
│   └── Export Annotations (MD).bru
└── bookmarks/
    ├── List Bookmarks.bru      # GET  /api/books/:id/bookmarks
    ├── Create Bookmark.bru     # POST /api/books/:id/bookmarks  -> saves bookmarkId
    └── Delete Bookmark.bru     # DEL  /api/bookmarks/:id
```

### Environment Variables

`environments/Local.bru` defines connection settings and stores runtime IDs:

```
baseUrl    = http://localhost:3001    # Server address
username   = admin                    # Test user
password   = devpassword              # Test user password
authToken  = (auto-filled by Login)   # JWT access token
libraryId  = (auto-filled by Create)  # Library UUID
bookId     = (auto-filled by Save)    # Book UUID
annotationId / bookmarkId             # Resource IDs
```

### Token and ID Propagation

Bruno automatically chains requests using `script:post-response` blocks:

- **Login** saves `access_token` to `authToken` env var
- **Create Library** saves response `id` to `libraryId`
- **Save Progress** / **Create Annotation** / **Create Bookmark** similarly propagate IDs

Subsequent requests reference these variables as `{{authToken}}`, `{{libraryId}}`, etc.

### Running Tests

**CLI (headless)**:

```bash
cd bruno-tests
bru run --environment Local
```

Output shows each request status and assertion results.

**GUI (interactive)**:

Open the `bruno-tests/` folder in Bruno desktop app. Select the `Local` environment, then run requests individually or the entire collection.

### Execution Order Matters

Run requests in folder order (auth first, then libraries, books, etc.). Within each folder, follow the `seq` numbering. This ensures:

1. Login runs before authenticated endpoints
2. Create runs before Get / Update / Delete
3. Scan runs after a library exists

### Known Limitations (CLI 3.3.0)

- `bru run` keeps env vars in memory only; they are not written to disk during batch runs
- `assert` blocks with `$res.status` cause ReferenceError; use `script:post-response` with `bru.setEnvVar()` instead
- Environment files must be edited manually to reset runtime IDs between runs

---

## 3. Backend Unit / Integration Tests

### Running

```bash
cd backend
cargo test
```

`DATABASE_URL` must be set (via `.env` or environment variable) because the project uses `sqlx` compile-time query macros.

### Current Coverage

| Module | Test File | Tests | What It Covers |
|---|---|---|---|
| Format detection | `src/services/format_detector.rs` | 4 | PDF magic bytes, empty file, unknown format, nonexistent path |

Run a specific test:

```bash
cargo test fd_01_pdf_magic
```

### Adding Tests

Backend tests are inline `#[cfg(test)] mod tests` blocks. To add a new test:

1. Add a `#[cfg(test)] mod tests` block in the relevant source file
2. Add dev-dependencies to `backend/Cargo.toml` under `[dev-dependencies]`
3. Run `cargo test` to verify

Current dev-dependencies:

```toml
[dev-dependencies]
axum-test = "14"
tempfile = "3"
```

---

## 4. CI Pipeline

GitHub Actions runs on every push to `main`/`develop` and on pull requests to `main`.

Configuration: `.github/workflows/ci.yml`

### Backend Job

| Step | Command | What It Validates |
|---|---|---|
| Install Rust | `dtolnay/rust-toolchain@stable` | Compiler available |
| Cache cargo | `actions/cache@v4` | Speed up builds |
| Install sqlx-cli | `cargo install sqlx-cli` | Migration tool |
| Run migrations | `sqlx migrate run` | Schema applies cleanly |
| Build | `cargo build --release` | Release compilation |
| Test | `cargo test` | Unit / integration tests |

Uses PostgreSQL 16 service container with:

```
POSTGRES_DB=ebook
POSTGRES_USER=ebook
POSTGRES_PASSWORD=testpassword
```

### Frontend Job

| Step | Command | What It Validates |
|---|---|---|
| Setup Bun | `oven-sh/setup-bun@v2` | Runtime available |
| Install deps | `bun install` | Dependencies resolve |
| Type check | `bun run check` | TypeScript / Svelte types |
| Build | `bun run build` | Production build succeeds |

### Running CI Locally

Backend equivalent:

```bash
cd backend
DATABASE_URL=postgres://ebook:devpassword@localhost:5432/ebook \
  JWT_SECRET=test_jwt_secret_minimum_32_characters_long \
  BOOKS_PATH=/tmp/books \
  THUMBS_PATH=/tmp/thumbs \
  cargo test
```

Frontend equivalent:

```bash
cd frontend && bun install && bun run check && bun run build
```

---

## 5. Manual API Verification (curl)

For quick checks without Bruno. Assumes the backend is running and an admin user exists.

### Token Operations

```bash
# Login (saves refresh cookie to cookies.txt)
TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "devpassword"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Refresh (uses saved cookie)
TOKEN=$(curl -s -b cookies.txt -X POST http://localhost:3001/api/auth/refresh \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Check token expiry
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool
```

### Health Check

```bash
curl -s http://localhost:3001/api/health | jq
# {"status":"ok"}
```

### Authenticated Request

```bash
curl -s http://localhost:3001/api/libraries \
  -H "Authorization: Bearer $TOKEN" | jq
```

For comprehensive endpoint testing, use the Bruno collection instead.

---

## 6. Common Commands

```bash
# Database
docker compose -f docker-compose.dev.yml up -d        # Start
docker compose -f docker-compose.dev.yml stop          # Stop (preserves data)
docker compose -f docker-compose.dev.yml down -v       # Remove everything

# Backend
cd backend && cargo run                                # Start server
cd backend && cargo watch -x run                       # Auto-restart on changes
cd backend && cargo test                               # Run tests
cd backend && cargo build --release                    # Release build

# Frontend
cd frontend && bun run dev                             # Dev server
cd frontend && bun run check                           # Type check
cd frontend && bun run build                           # Production build

# Bruno
cd bruno-tests && bru run --environment Local          # Run all API tests
```

---

## 7. Troubleshooting

### `DATABASE_URL must be set`

`.env` is missing or not in scope. Run commands from `backend/`:

```bash
cd backend && cargo run
```

### `connection refused`

Database container is not ready:

```bash
docker compose -f docker-compose.dev.yml ps
# Wait until Status is healthy
```

### `401 Unauthorized` (token expired)

Access tokens expire after 15 minutes. Re-issue:

```bash
# Re-login
TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "devpassword"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Or refresh
TOKEN=$(curl -s -b cookies.txt -X POST http://localhost:3001/api/auth/refresh \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

### `401 Unauthorized` on login

- No user in the database: re-run the admin creation step in Section 1
- Password mismatch: verify the hash matches the login password

```bash
psql postgres://ebook:devpassword@localhost:5432/ebook \
  -c "SELECT username, role FROM users;"
```

### Books not appearing after scan

- Check server logs for `scan failed` messages
- Verify the `path` is correct relative to `backend/`
- Confirm book files are in epub, pdf, or cbz format

### `cargo watch` not installed

```bash
cargo install cargo-watch
```

### Bruno CLI `ReferenceError: $res is not defined`

This is a known bug in bru CLI 3.3.0. The collection uses `script:post-response` with `bru.setEnvVar()` instead of `assert` blocks to avoid this issue. If you see this error, check that `.bru` files do not contain `assert { $res.status }` blocks.
