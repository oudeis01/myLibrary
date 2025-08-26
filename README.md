# myLibrary

[한국어 문서 보기](README.ko.md)

A self-hosted digital library server featuring a high-performance C++ backend and a modern, Vite-powered Progressive Web App (PWA) frontend.

## Core Features

-   **High-Performance Backend:** Built with C++ for efficient resource management and speed.
-   **PWA Frontend:** Installable on any device for a native app-like experience with offline capabilities.
-   **Specific Format Support:** Natively handles EPUB, PDF, and Comic Book Archives (CBZ, CBR).
-   **Library Scanning:** Automatically discovers and indexes media from your library folder.
-   **PostgreSQL Database:** Utilizes a robust PostgreSQL database for data management.
-   **User Authentication:** Core user and session management is implemented.

## Tech Stack

-   **Backend:** C++17, PostgreSQL
-   **Frontend:** Vite, TypeScript
-   **Key Backend Libraries:** httplib (Web Server), pqxx (PostgreSQL client)

## System Dependencies

This project requires certain system-level dependencies to be installed before building and running.

### Backend Dependencies

-   **C++17 Compatible Compiler:** (e.g., GCC, Clang)
-   **CMake:** Version 3.14 or newer.
-   **PostgreSQL Server:** The database server itself.
-   **PostgreSQL Client Development Libraries:** Required for the C++ backend to connect to PostgreSQL. (e.g., `libpq-dev` on Debian/Ubuntu, `postgresql-libs` on Arch Linux).

### Frontend Dependencies

-   **Node.js:** LTS version recommended.
-   **npm:** Node Package Manager, typically installed with Node.js.

## Getting Started

### Prerequisites

-   C++17 compatible compiler (e.g., GCC, Clang)
-   CMake (3.14 or newer)
-   PostgreSQL server
-   Node.js and npm

### 1. Setup Database

The project uses PostgreSQL. A setup script is provided to initialize the database, user, and schema.

**Note:** This script may ask for `sudo` privileges to manage the PostgreSQL service and database.

```bash
# This script will create the 'mylibrary_db' database and 'mylibrary_user'
sh ./init_database.sh
```
Review the script to ensure the default credentials meet your security requirements. The C++ application connects using a hardcoded connection string in `src/database.cpp` which you may need to update.

### 2. Build Backend

```bash
mkdir -p build
cd build
cmake ..
make
```

### 3. Build Frontend

The frontend is a Vite-powered PWA.

```bash
cd frontend-vite
npm install
npm run build
```

### 4. Run Server

The server executable from the `build` directory serves the frontend and provides the API.

```bash
./build/myLibrary
```
The application will be available at `http://localhost:8080`.

## Project Structure

-   `src/`, `include/`: Backend C++ source (business logic, HTTP server) and headers.
-   `frontend-vite/`: Frontend PWA source code (Vite + TypeScript).

-   `init_database.sh`, `setup_db.sql`: PostgreSQL database initialization scripts.
-   `books/`: Default directory for storing library media.
-   `build/`: Build output directory for the backend.

## API Endpoints

The following REST API endpoints are exposed by the backend server:

### Authentication

-   `POST /api/register`: Register a new user.
-   `POST /api/login`: Authenticate user and get a session token.
-   `POST /api/logout`: Invalidate current session.

### Book Management

-   `POST /api/books/upload`: Upload a new book file.
-   `GET /api/books`: Retrieve a list of all books in the library.
-   `GET /api/books/{id}/download`: Download a specific book file by its ID.
-   `GET /api/books/{id}/file`: Access a book file for inline viewing by its ID.
-   `GET /api/books/{id}/thumbnail`: Get the thumbnail image for a specific book by its ID.

### Library Maintenance

-   `POST /api/library/cleanup-orphaned`: Clean up orphaned book records in the database.
-   `POST /api/library/sync-scan`: Start a synchronous library scan and cleanup.
-   `POST /api/library/scan`: Start an asynchronous library scan.
-   `GET /api/library/scan-status`: Get the current status of the library scan.
-   `POST /api/library/scan-stop`: Request to stop an ongoing library scan.

### Progress Tracking

-   `PUT /api/books/{id}/progress`: Update reading progress for a specific book by its ID.
-   `GET /api/books/{id}/progress`: Get reading progress for a specific book by its ID.

### Health Check

-   `GET /api/health`: Check the server's health and database connection status.

## Roadmap

[ ] Enhanced metadata extraction from files (e.g., EPUB, PDF).

[ ] Robust thumbnail generation and management system.

[ ] Full-text search capabilities for the library.

[ ] Dedicated administrator dashboard.

[ ] Refined user authentication with role-based access control.

[ ] Continuous UI/UX improvements.