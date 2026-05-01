import { openOfflineDB, type OfflineBook } from './db';
import { getBook, getProgress } from '$lib/api/books';
import { api } from '$lib/api/client';

export async function downloadForOffline(bookId: string): Promise<void> {
  const [fileResponse, metadata, progress] = await Promise.all([
    api.get(`books/${bookId}/download`),
    getBook(bookId),
    getProgress(bookId).catch(() => null),
  ]);
  const fileBlob = await fileResponse.blob();
  const db = await openOfflineDB();
  const entry: OfflineBook = { id: bookId, fileBlob, metadata, progress, downloadedAt: new Date() };
  await db.put('books', entry);
}

export async function removeOffline(bookId: string): Promise<void> {
  const db = await openOfflineDB();
  await db.delete('books', bookId);
}

export async function getOfflineBook(bookId: string): Promise<OfflineBook | undefined> {
  const db = await openOfflineDB();
  return (await db.get('books', bookId)) as OfflineBook | undefined;
}

export async function listOfflineBooks(): Promise<OfflineBook[]> {
  const db = await openOfflineDB();
  return (await db.getAll('books')) as OfflineBook[];
}
