import { api } from './client';

export interface Bookmark {
  id: string;
  book_id: string;
  user_id: string;
  page: number;
  label: string | null;
  created_at: string;
}

export async function getBookmarks(bookId: string): Promise<Bookmark[]> {
  return api.get(`books/${bookId}/bookmarks`).json();
}

export async function createBookmark(bookId: string, page: number, label?: string): Promise<Bookmark> {
  return api.post(`books/${bookId}/bookmarks`, { json: { page, label } }).json();
}

export async function deleteBookmark(id: string): Promise<void> {
  await api.delete(`bookmarks/${id}`);
}
