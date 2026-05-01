<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getBook, getProgress } from '$lib/api/books';
  import type { Book, ReadingProgress } from '$lib/api/books';
  import PdfReader from '$lib/readers/PdfReader.svelte';
  import EpubReader from '$lib/readers/EpubReader.svelte';
  import CbzReader from '$lib/readers/CbzReader.svelte';

  let book: Book | null = null;
  let progress: ReadingProgress | null = null;
  let loading = true;
  let error = '';

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

<svelte:head><title>{book?.title ?? '리더'} — MyLibrary</title></svelte:head>

<div class="flex h-screen flex-col">
  <!-- Nav bar -->
  <nav class="flex items-center gap-3 border-b bg-white px-4 py-2 text-sm">
    <button on:click={() => goto(`/book/${$page.params.id}`)} class="text-indigo-600 hover:underline">
      ← 책 정보
    </button>
    {#if book}
      <span class="truncate text-gray-700">{book.title}</span>
    {/if}
  </nav>

  <!-- Reader area -->
  <div class="flex-1 overflow-hidden">
    {#if loading}
      <div class="flex h-full items-center justify-center">
        <p class="text-gray-400">불러오는 중...</p>
      </div>
    {:else if error || !book}
      <div class="flex h-full items-center justify-center">
        <p class="text-red-500">{error || '책을 찾을 수 없습니다.'}</p>
      </div>
    {:else if book.format === 'pdf'}
      <PdfReader bookId={book.id} initialPage={progress?.page ?? 1} />
    {:else if book.format === 'epub'}
      <EpubReader bookId={book.id} />
    {:else if book.format === 'cbz'}
      <CbzReader bookId={book.id} initialPage={progress?.page ?? 1} />
    {:else}
      <div class="flex h-full items-center justify-center">
        <p class="text-gray-500">지원하지 않는 형식: {book.format}</p>
      </div>
    {/if}
  </div>
</div>
