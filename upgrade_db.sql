-- Database upgrade script for metadata and thumbnail support
-- Run this after the initial setup_db.sql

-- Add new columns to books table
ALTER TABLE books ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS publisher VARCHAR(255);
ALTER TABLE books ADD COLUMN IF NOT EXISTS isbn VARCHAR(20);
ALTER TABLE books ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
ALTER TABLE books ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(500);
ALTER TABLE books ADD COLUMN IF NOT EXISTS page_count INTEGER;
ALTER TABLE books ADD COLUMN IF NOT EXISTS metadata_extracted BOOLEAN DEFAULT FALSE;
ALTER TABLE books ADD COLUMN IF NOT EXISTS extraction_error TEXT;

-- Create thumbnails directory table (for tracking generated thumbnails)
CREATE TABLE IF NOT EXISTS book_thumbnails (
    book_id INTEGER PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
    thumbnail_path VARCHAR(500) NOT NULL,
    thumbnail_size INTEGER NOT NULL DEFAULT 0,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    format VARCHAR(10) DEFAULT 'jpg'
);

-- Update user_book_progress to support more detailed progress tracking
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS current_page INTEGER DEFAULT 0;
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 0;
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS current_location VARCHAR(255);
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS progress_percent DECIMAL(5,2) DEFAULT 0.0;
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS chapter_title VARCHAR(255);
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_books_metadata_extracted ON books(metadata_extracted);
CREATE INDEX IF NOT EXISTS idx_books_language ON books(language);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_thumbnails_book_id ON book_thumbnails(book_id);

-- Grant privileges
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mylibrary_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mylibrary_user;