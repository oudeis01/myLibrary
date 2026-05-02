import { openDB } from 'idb';
import type { Book, ReadingProgress } from '$lib/api/books';

export interface OfflineBook {
  id: string;
  fileBlob: Blob;
  metadata: Book;
  progress: ReadingProgress | null;
  downloadedAt: Date;
}

export interface PendingWrite {
  id?: number;
  method: 'POST' | 'PATCH' | 'DELETE';
  endpoint: string;
  body?: unknown;
  createdAt: Date;
}

const DB_NAME = 'ebook-offline';
const DB_VERSION = 2;

export function openOfflineDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('books', { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        db.createObjectStore('pending_writes', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function queuePendingWrite(write: Omit<PendingWrite, 'id' | 'createdAt'>): Promise<void> {
  const db = await openOfflineDB();
  await db.add('pending_writes', { ...write, createdAt: new Date() });
}

export async function getBookSource(bookId: string): Promise<{ url: string; isObjectUrl: boolean }> {
  const db = await openOfflineDB();
  const offline = await db.get('books', bookId) as OfflineBook | undefined;
  if (offline) {
    return { url: URL.createObjectURL(offline.fileBlob), isObjectUrl: true };
  }
  return { url: `/api/books/${bookId}/download`, isObjectUrl: false };
}
