import { api } from './client';

export interface BookSummary {
  id: string;
  library_id: string;
  title: string;
  authors: string[];
  format: 'pdf' | 'epub' | 'cbz';
  cover_path: string | null;
  page_count: number | null;
  year: number | null;
  created_at: string;
}

export interface Book extends BookSummary {
  file_path: string;
  file_size: number | null;
  description: string | null;
  language: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  updated_at: string;
}

export interface ReadingProgress {
  user_id: string;
  book_id: string;
  page: number;
  cfi: string | null;
  percent: number;
  updated_at: string;
}

export interface Library {
  id: string;
  name: string;
  path: string;
  created_at: string;
}

export async function listBooks(params?: {
  library_id?: string;
  format?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<BookSummary[]> {
  return api.get('books', { searchParams: params as Record<string, string> }).json();
}

export async function getBook(id: string): Promise<Book> {
  return api.get(`books/${id}`).json();
}

export async function listLibraries(): Promise<Library[]> {
  return api.get('libraries').json();
}

export async function getProgress(bookId: string): Promise<ReadingProgress | null> {
  try {
    return await api.get(`progress/${bookId}`).json();
  } catch {
    return null;
  }
}

export async function saveProgress(
  bookId: string,
  data: { page: number; cfi?: string; percent: number }
): Promise<void> {
  await api.put(`progress/${bookId}`, { json: data });
}
