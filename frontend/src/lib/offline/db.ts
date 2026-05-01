import { openDB } from 'idb';
import type { Book, ReadingProgress } from '$lib/api/books';

export interface OfflineBook {
  id: string;
  fileBlob: Blob;
  metadata: Book;
  progress: ReadingProgress | null;
  downloadedAt: Date;
}

const DB_NAME = 'ebook-offline';
const DB_VERSION = 1;

export function openOfflineDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('books', { keyPath: 'id' });
    },
  });
}

export async function getBookSource(bookId: string): Promise<{ url: string; isObjectUrl: boolean }> {
  const db = await openOfflineDB();
  const offline = await db.get('books', bookId) as OfflineBook | undefined;
  if (offline) {
    return { url: URL.createObjectURL(offline.fileBlob), isObjectUrl: true };
  }
  return { url: `/api/books/${bookId}/download`, isObjectUrl: false };
}
