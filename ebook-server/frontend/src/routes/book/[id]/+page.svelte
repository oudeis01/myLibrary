<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getBook, getProgress } from '$lib/api/books';
  import type { Book, ReadingProgress } from '$lib/api/books';

  let book: Book | null = null;
  let progress: ReadingProgress | null = null;
  let loading = true;
  let error = '';

  const FORMAT_LABELS: Record<string, string> = { pdf: 'PDF', epub: 'ePub', cbz: 'CBZ' };

  onMount(async () => {
    const id = $page.params.id!;
    try {
      [book, progress] = await Promise.all([getBook(id), getProgress(id)]);
    } catch {
      error = '책을 불러올 수 없습니다.';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head><title>{book?.title ?? '책 정보'} — MyLibrary</title></svelte:head>

<div class="min-h-screen bg-gray-50">
  <header class="border-b border-gray-200 bg-white px-4 py-3">
    <button on:click={() => goto('/library')} class="text-sm text-indigo-600 hover:underline">
      ← 라이브러리로
    </button>
  </header>

  <main class="mx-auto max-w-2xl px-4 py-8">
    {#if loading}
      <p class="text-center text-gray-400">불러오는 중...</p>
    {:else if error}
      <p class="text-center text-red-500">{error}</p>
    {:else if book}
      <div class="flex gap-6">
        <!-- Cover -->
        <div class="w-32 shrink-0">
          {#if book.cover_path}
            <img
              src="/api/reader/{book.id}/cover"
              alt={book.title}
              class="w-full rounded-lg shadow-md"
            />
          {:else}
            <div class="flex h-48 w-32 items-center justify-center rounded-lg bg-gray-200 text-4xl">📖</div>
          {/if}
        </div>

        <!-- Meta -->
        <div class="flex flex-1 flex-col gap-2">
          <span class="w-fit rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
            {FORMAT_LABELS[book.format] ?? book.format}
          </span>
          <h1 class="text-xl font-bold text-gray-900">{book.title}</h1>
          {#if book.authors.length}
            <p class="text-sm text-gray-600">{book.authors.join(', ')}</p>
          {/if}
          {#if book.year}
            <p class="text-xs text-gray-400">{book.year}</p>
          {/if}
          {#if book.description}
            <p class="mt-2 text-sm leading-relaxed text-gray-600">{book.description}</p>
          {/if}

          {#if progress}
            <div class="mt-3">
              <div class="mb-1 flex justify-between text-xs text-gray-500">
                <span>진행도</span>
                <span>{Math.round(progress.percent * 100)}%</span>
              </div>
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  class="h-full rounded-full bg-indigo-500"
                  style="width: {Math.round(progress.percent * 100)}%"
                />
              </div>
            </div>
          {/if}

          <a
            href="/reader/{book.id}"
            class="mt-4 inline-block w-fit rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {progress ? '이어 읽기' : '읽기 시작'}
          </a>
        </div>
      </div>
    {/if}
  </main>
</div>
