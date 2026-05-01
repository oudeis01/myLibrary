# Development Environment DB Connection Test Guide

Step-by-step procedure to run the backend locally and verify that the API connects to the database correctly.
Follow this once from start to finish for initial setup.

---

## Prerequisites

Ensure the following tools are installed.

| Tool | Verify command |
|---|---|
| Docker & Docker Compose | `docker compose version` |
| Rust (stable) | `cargo --version` |
| psql (PostgreSQL client) | `psql --version` |
| Python 3 + argon2-cffi | `python3 -c "import argon2"` |

If `argon2-cffi` is missing:
```bash
pip install argon2-cffi
```

---

## Step 1: Start the development database

Run from the project root directory.

```bash
docker compose -f docker-compose.dev.yml up -d
```

Wait for the container to start, then verify it is healthy:

```bash
docker compose -f docker-compose.dev.yml ps
```

The `postgres` container Status should be `healthy`.

---

## Step 2: Configure `.env`

Copy `.env.example` to create `.env` (skip if it already exists).

```bash
cp .env.example .env
```

Open `.env` and change `JWT_SECRET`. The `DATABASE_URL` can stay at the default development value.

```dotenv
# JWT_SECRET: minimum 32-character random string
# Generate one with:
#   openssl rand -base64 32
JWT_SECRET=<your_32plus_char_random_string>

DATABASE_URL=postgres://ebook:devpassword@localhost:5432/ebook
BOOKS_PATH=./data/books
THUMBS_PATH=./data/thumbs
SERVER_PORT=3001
RUST_LOG=debug
```

> `.env` is listed in `.gitignore` and will not be committed.

---

## Step 3: Create data directories

Directories for book files and thumbnails are required.

```bash
mkdir -p data/books data/thumbs
```

> **Important**: Set `BOOKS_PATH` and `THUMBS_PATH` in `.env` to **absolute paths**.
> Relative paths resolve relative to the directory where `cargo run` executes (`backend/`),
> which may cause files to be written to `backend/data/thumbs/` instead of the intended location.
>
> ```dotenv
> BOOKS_PATH=/absolute/path/data/books
> THUMBS_PATH=/absolute/path/data/thumbs
> ```

---

## Step 4: Start the backend server

```bash
cd backend
cargo run
```

> The first run takes a few minutes to compile dependencies. Subsequent runs are faster.

On success, the terminal shows output similar to:

```
2024-xx-xx ... INFO ebook_server: running migrations
2024-xx-xx ... INFO ebook_server: listening on 0.0.0.0:3001
```

Database migrations (table creation) run automatically on startup.

---

## Step 5: Health check

Open a **new terminal** and test:

```bash
curl -s http://localhost:3001/api/health | jq
```

Expected response:

```json
{ "status": "ok" }
```

If `jq` is not installed, `curl -s http://localhost:3001/api/health` works as well.

---

## Step 6: Create an admin account (first time only)

A user must exist in the database to log in. There is no signup API, so insert one directly.

### 6-1. Generate an argon2 hash

```bash
python3 -c "
from argon2 import PasswordHasher
ph = PasswordHasher()
print(ph.hash('devpassword'))
"
```

Example output (varies each run):

```
$argon2id$v=19$m=65536,t=3,p=4$abc123...==$xyz...==
```

Copy the entire string.

### 6-2. Insert the user into the database

```bash
psql postgres://ebook:devpassword@localhost:5432/ebook
```

At the psql prompt, run the following SQL. Replace `HASH_HERE` with the hash copied above.

```sql
INSERT INTO users (username, password_hash, role)
VALUES ('admin', 'HASH_HERE', 'admin');

-- Verify the insertion
SELECT id, username, role, created_at FROM users;

\q
```

---

## Step 7: Test the login API

```bash
curl -s -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "devpassword"}' | jq
```

Expected response:

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...."
}
```

> The `-c cookies.txt` option saves the refresh_token cookie to a file.
> Use `-b cookies.txt` in subsequent commands to reuse it.

Storing the token in a variable is convenient:

```bash
TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "devpassword"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo $TOKEN
```

---

## Step 8: Test authenticated API endpoints

Verify that accessing without a token returns 401:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/libraries
# -> 401
```

With the token, the response should succeed:

```bash
curl -s http://localhost:3001/api/libraries \
  -H "Authorization: Bearer $TOKEN" | jq
# -> [] (no libraries yet)
```

---

## Step 9: Create a library and scan

### 9-1. Prepare test book files

```bash
# Copy epub, pdf, or cbz files into data/books/
cp ~/Downloads/sample.epub data/books/
```

### 9-2. Create a library

Set `path` to an absolute or relative path as seen from the server.
If running `cargo run` from `backend/`, the relative path would be `../data/books`.

```bash
curl -s -X POST http://localhost:3001/api/libraries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Shelf", "path": "../data/books"}' | jq
```

Expected response:

```json
{
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "name": "My Shelf",
  "path": "../data/books",
  "created_at": "..."
}
```

Copy the `id`.

### 9-3. Trigger a scan

```bash
LIBRARY_ID="<UUID copied above>"

curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3001/api/libraries/$LIBRARY_ID/scan \
  -H "Authorization: Bearer $TOKEN"
# -> 202
```

Scanning runs in the background. Check the server terminal for logs:

```
INFO scan complete library_id=... added=3 skipped=0
```

---

## Step 10: Verify book list

```bash
curl -s http://localhost:3001/api/books \
  -H "Authorization: Bearer $TOKEN" | jq
```

If scanned books appear in the list, the entire flow is working.

---

## Common commands

```bash
# Re-issue token (access token expires after 15 minutes)
TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "devpassword"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Refresh token (without re-login, uses refresh_token cookie)
TOKEN=$(curl -s -b cookies.txt -X POST http://localhost:3001/api/auth/refresh \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Start database
docker compose -f docker-compose.dev.yml up -d

# Stop database (preserves data)
docker compose -f docker-compose.dev.yml stop

# Remove database completely (including volumes, start fresh)
docker compose -f docker-compose.dev.yml down -v

# Connect to psql
psql postgres://ebook:devpassword@localhost:5432/ebook

# Run backend with auto-restart on code changes
cd backend && cargo watch -x run

# Run frontend dev server
cd frontend && bun run dev
```

---

## Troubleshooting

### `DATABASE_URL must be set` error

The `.env` file is missing, or the command was not run from the `backend/` directory.

```bash
cd backend
cargo run
```

### `connection refused` error

The database container is not ready yet.

```bash
docker compose -f docker-compose.dev.yml ps
# Wait until Status is healthy
```

### `401 Unauthorized` on API calls (token expired)

The access token lifetime is **15 minutes**. Re-issue when expired.

```bash
# Option 1: Re-login
TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "devpassword"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Option 2: Refresh using refresh_token cookie (requires cookies.txt)
TOKEN=$(curl -s -b cookies.txt -X POST http://localhost:3001/api/auth/refresh \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

To check if the token is actually expired:
```bash
# Decode JWT payload (check the exp field)
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool
# date -d @<exp_value>  to see the expiration timestamp
```

### `401 Unauthorized` on login

- No user in the database: revisit Step 6
- Password mismatch: verify the hash generated in 6-1 matches the login password

```bash
psql postgres://ebook:devpassword@localhost:5432/ebook \
  -c "SELECT username, role FROM users;"
```

### Books not appearing after scan

- Check server logs for `scan failed` messages
- Verify the `path` is correct relative to the server execution directory (`backend/`)
- Confirm book files are in epub, pdf, or cbz format

### `cargo watch` not installed

```bash
cargo install cargo-watch
```
