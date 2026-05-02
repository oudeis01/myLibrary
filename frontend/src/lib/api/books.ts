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
  tags: string[];
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
  tag?: string;
  year?: number;
  limit?: number;
  offset?: number;
}): Promise<BookSummary[]> {
  return api.get('books', { searchParams: params as Record<string, string | number> }).json();
}

export interface AnnotationHit {
  type: 'annotation';
  id: string;
  book_id: string;
  book_title: string;
  page: number | null;
  text_content: string | null;
  note: string | null;
  created_at: string;
}

export type SearchResult = ({ type: 'book' } & BookSummary) | AnnotationHit;

export async function searchBooks(params: {
  q: string;
  limit?: number;
  offset?: number;
}): Promise<BookSummary[]> {
  return api.get('search', { searchParams: { ...params, type: 'book' } as Record<string, string | number> }).json();
}

export async function searchAll(params: {
  q: string;
  type: 'book' | 'annotation';
  limit?: number;
  offset?: number;
}): Promise<SearchResult[]> {
  return api.get('search', { searchParams: params as Record<string, string | number> }).json();
}

export async function uploadBook(
  libraryId: string,
  file: File,
  meta?: { title?: string; authors?: string; year?: number }
): Promise<BookSummary> {
  const form = new FormData();
  form.append('file', file);
  if (meta?.title) form.append('title', meta.title);
  if (meta?.authors) form.append('authors', meta.authors);
  if (meta?.year != null) form.append('year', String(meta.year));
  return api.post(`libraries/${libraryId}/upload`, { body: form }).json();
}

export async function updateBook(
  id: string,
  data: {
    title?: string;
    authors?: string[];
    description?: string;
    year?: number;
    language?: string;
    tags?: string[];
  }
): Promise<Book> {
  return api.patch(`books/${id}`, { json: data }).json();
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
