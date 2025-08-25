-- MyLibrary Database Setup Script
-- This script creates the database, user, and all necessary tables

-- Create the database (run as postgres superuser)
-- CREATE DATABASE mylibrary_db;

-- Create the user (run as postgres superuser)
-- CREATE USER mylibrary_user WITH PASSWORD 'your_password_here';

-- Grant all privileges on the database to the user (run as postgres superuser)
-- GRANT ALL PRIVILEGES ON DATABASE mylibrary_db TO mylibrary_user;

-- Connect to mylibrary_db database and run the following:
-- \c mylibrary_db;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create books table with file_size column
CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    file_path VARCHAR(500) UNIQUE NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user_book_progress table
CREATE TABLE IF NOT EXISTS user_book_progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    progress_details JSONB,
    PRIMARY KEY (user_id, book_id)
);

-- Create collections table (like Spotify playlists)
CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create collection_books table (books in collections)
CREATE TABLE IF NOT EXISTS collection_books (
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (collection_id, book_id)
);

-- Create collection_permissions table (who can access/edit collections)
CREATE TABLE IF NOT EXISTS collection_permissions (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_type VARCHAR(20) NOT NULL CHECK (permission_type IN ('view', 'add_books', 'edit', 'admin')),
    granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(collection_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_books_file_path ON books(file_path);
CREATE INDEX IF NOT EXISTS idx_progress_user_id ON user_book_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_owner ON collections(owner_id);
CREATE INDEX IF NOT EXISTS idx_collections_public ON collections(is_public);
CREATE INDEX IF NOT EXISTS idx_collection_books_collection ON collection_books(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_books_book ON collection_books(book_id);
CREATE INDEX IF NOT EXISTS idx_collection_permissions_collection ON collection_permissions(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_permissions_user ON collection_permissions(user_id);

-- Grant privileges to mylibrary_user for all tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mylibrary_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mylibrary_user;
