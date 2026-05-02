import { listOfflineBooks } from './downloader';
import { openOfflineDB } from './db';
import { saveProgress } from '$lib/api/books';
import { api } from '$lib/api/client';

async function flushPendingWrites(): Promise<void> {
  const db = await openOfflineDB();
  const writes = await db.getAll('pending_writes');
  for (const write of writes) {
    try {
      if (write.method === 'DELETE') {
        await api.delete(write.endpoint);
      } else if (write.method === 'POST') {
        await api.post(write.endpoint, { json: write.body });
      } else if (write.method === 'PATCH') {
        await api.patch(write.endpoint, { json: write.body });
      }
      await db.delete('pending_writes', write.id);
    } catch {
      // keep failed writes in queue for next reconnect
    }
  }
}

export async function syncOnReconnect(): Promise<void> {
  try {
    await flushPendingWrites();
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
