import { api } from './client';
import { queuePendingWrite } from '$lib/offline/db';

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
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await queuePendingWrite({ method: 'POST', endpoint: `books/${bookId}/bookmarks`, body: { page, label } });
    return {
      id: `pending-${Date.now()}`,
      book_id: bookId,
      user_id: '',
      page,
      label: label ?? null,
      created_at: new Date().toISOString(),
    };
  }
  return api.post(`books/${bookId}/bookmarks`, { json: { page, label } }).json();
}

export async function deleteBookmark(id: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await queuePendingWrite({ method: 'DELETE', endpoint: `bookmarks/${id}` });
    return;
  }
  await api.delete(`bookmarks/${id}`);
}
