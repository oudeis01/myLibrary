<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { listOfflineBooks, removeOffline } from '$lib/offline/downloader';
  import { offlineBookIds } from '$lib/stores/offline';
  import type { OfflineBook } from '$lib/offline/db';

  let books: OfflineBook[] = [];
  let loading = true;

  onMount(async () => {
    books = await listOfflineBooks();
    loading = false;
  });

  async function handleRemove(id: string) {
    await removeOffline(id);
    books = books.filter((b) => b.id !== id);
    offlineBookIds.update((s) => { s.delete(id); return new Set(s); });
  }

  function formatBytes(blob: Blob): string {
    const bytes = blob.size;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatDate(d: Date): string {
    return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<svelte:head><title>오프라인 저장 — MyLibrary</title></svelte:head>

<div class="min-h-screen bg-gray-50">
  <header class="border-b border-gray-200 bg-white px-4 py-3">
    <button on:click={() => goto('/library')} class="text-sm text-indigo-600 hover:underline">
      ← 라이브러리로
    </button>
  </header>

  <main class="mx-auto max-w-2xl px-4 py-8">
    <h1 class="mb-6 text-xl font-bold text-gray-900">오프라인 저장 목록</h1>

    {#if loading}
      <p class="text-center text-gray-400">불러오는 중...</p>
    {:else if books.length === 0}
      <div class="rounded-xl border border-dashed border-gray-300 py-16 text-center">
        <p class="text-2xl">☁</p>
        <p class="mt-2 text-sm text-gray-500">저장된 책이 없습니다.</p>
        <p class="mt-1 text-xs text-gray-400">책 상세 페이지에서 "오프라인 저장"을 누르세요.</p>
      </div>
    {:else}
      <ul class="space-y-3">
        {#each books as book (book.id)}
          <li class="flex items-center gap-4 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200">
            <a href="/book/{book.id}" class="flex flex-1 items-center gap-4 min-w-0">
              <div class="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-gray-100 text-lg">📖</div>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-gray-900">{book.metadata.title}</p>
                <p class="text-xs text-gray-400">
                  {formatBytes(book.fileBlob)} · {formatDate(book.downloadedAt)}
                </p>
              </div>
            </a>
            <button
              on:click={() => handleRemove(book.id)}
              class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
            >
              삭제
            </button>
          </li>
        {/each}
      </ul>

      <p class="mt-6 text-center text-xs text-gray-400">
        총 {books.length}권 · {books.reduce((s, b) => s + b.fileBlob.size, 0) > 1024 * 1024
          ? `${(books.reduce((s, b) => s + b.fileBlob.size, 0) / 1024 / 1024).toFixed(1)} MB`
          : `${(books.reduce((s, b) => s + b.fileBlob.size, 0) / 1024).toFixed(0)} KB`} 사용 중
      </p>
    {/if}
  </main>
</div>
