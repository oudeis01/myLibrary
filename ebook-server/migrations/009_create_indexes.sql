CREATE INDEX idx_books_library_id ON books(library_id);
CREATE INDEX idx_books_format ON books(format);
CREATE INDEX idx_books_created_at ON books(created_at DESC);
CREATE INDEX idx_reading_progress_user_id ON reading_progress(user_id);
CREATE INDEX idx_annotations_book_user ON annotations(book_id, user_id);
CREATE INDEX idx_bookmarks_book_user ON bookmarks(book_id, user_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
