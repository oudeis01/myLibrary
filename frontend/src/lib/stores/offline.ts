import { writable } from 'svelte/store';
import { listOfflineBooks } from '$lib/offline/downloader';

export const offlineBookIds = writable<Set<string>>(new Set());
export const isOffline = writable(typeof navigator !== 'undefined' ? !navigator.onLine : false);

export async function initOfflineStore(): Promise<void> {
  const books = await listOfflineBooks();
  offlineBookIds.set(new Set(books.map((b) => b.id)));
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => isOffline.set(false));
  window.addEventListener('offline', () => isOffline.set(true));
}
