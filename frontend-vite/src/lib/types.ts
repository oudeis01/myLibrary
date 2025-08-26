export interface User {
  id: number;
  username: string;
}

export interface AuthResponse {
  success: boolean;
  username?: string;
  session_token?: string;
  message?: string;
}

export interface Book {
  id: number;
  title: string;
  author?: string;
  format: 'epub' | 'pdf' | 'comic';
  file_path: string;
  file_size: number;
  upload_date: string;
  last_read?: string;
  cover_url?: string;
}

export interface ReadingProgress {
  id?: number;
  book_id: number;
  user_id: number;
  current_page?: number;
  total_pages?: number;
  current_location?: string;
  progress_percent?: number;
  updated_at: string;
  chapter_title?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface OfflineBook {
  id: number;
  data: ArrayBuffer;
  metadata: Book;
  downloadedAt: string;
}

export interface SyncProgress {
  bookId: number;
  progress: ReadingProgress;
  syncedAt?: string;
  needsSync: boolean;
}