import { listOfflineBooks } from './downloader';
import { saveProgress } from '$lib/api/books';

export async function syncOnReconnect(): Promise<void> {
  try {
    const books = await listOfflineBooks();
    await Promise.allSettled(
      books
        .filter((b) => b.progress)
        .map((b) => saveProgress(b.id, { page: b.progress!.page, cfi: b.progress!.cfi ?? undefined, percent: b.progress!.percent }))
    );
  } catch {
    // sync is best-effort
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', syncOnReconnect);
}
