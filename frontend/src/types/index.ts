/**
 * @file types/index.ts
 * @brief Type definitions for MyLibrary frontend application
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-26
 */

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Book {
  id: number;
  title: string;
  author?: string;
  file_path: string;
  file_type: 'epub' | 'pdf' | 'cbz' | 'cbr';
  file_size: number;
  uploaded_at: string;
  progress?: ReadingProgress;
}

export interface ReadingProgress {
  page?: number;
  chapter?: number;
  progress_percent: number;
  last_position?: string;
  notes?: string;
  total_pages?: number;
  updated_at: string;
}

export interface AuthResponse {
  message: string;
  username: string;
  session_token: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BookUploadData {
  title?: string;
  author?: string;
  file: File;
}

export interface ReaderState {
  bookId: number;
  book: Book;
  currentPage: number;
  totalPages: number;
  fontSize: number;
  progress: ReadingProgress;
  isLoading: boolean;
}

export type FileType = 'epub' | 'pdf' | 'cbz' | 'cbr';

export interface BookThumbnailProps {
  book: Book;
  className?: string;
}

export interface BookCardProps {
  book: Book;
  onOpenBook: (bookId: number) => void;
  onUpdateProgress: (bookId: number) => void;
}
