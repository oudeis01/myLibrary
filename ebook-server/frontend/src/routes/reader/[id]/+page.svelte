<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getBook, getProgress } from '$lib/api/books';
  import type { Book, ReadingProgress } from '$lib/api/books';
  import { getBookSource } from '$lib/offline/db';
  import { getAnnotations } from '$lib/api/annotations';
  import { getBookmarks } from '$lib/api/bookmarks';
  import type { Annotation } from '$lib/api/annotations';
  import type { Bookmark } from '$lib/api/bookmarks';
  import PdfReader from '$lib/readers/PdfReader.svelte';
  import EpubReader from '$lib/readers/EpubReader.svelte';
  import CbzReader from '$lib/readers/CbzReader.svelte';
  import AnnotationPanel from '$lib/components/AnnotationPanel.svelte';
  import BookmarkPanel from '$lib/components/BookmarkPanel.svelte';

  let book: Book | null = null;
  let progress: ReadingProgress | null = null;
  let loading = true;
  let error = '';
  let source = '';
  let sourceIsObjectUrl = false;

  let annotations: Annotation[] = [];
  let bookmarks: Bookmark[] = [];
  let panelOpen = false;
  let selectedAnnotationId: string | null = null;

  // refs to readers for programmatic navigation
  let pdfReader: PdfReader;
  let epubReader: EpubReader;
  let cbzReader: CbzReader;

  onMount(async () => {
    const id = $page.params.id!;
    try {
      [book, progress] = await Promise.all([getBook(id), getProgress(id)]);
      const result = await getBookSource(id);
      source = result.url;
      sourceIsObjectUrl = result.isObjectUrl;
      [annotations, bookmarks] = await Promise.all([
        getAnnotations(id).catch(() => []),
        getBookmarks(id).catch(() => []),
      ]);
    } catch {
      error = '책을 불러올 수 없습니다.';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (sourceIsObjectUrl && source) URL.revokeObjectURL(source);
  });

  function handleAnnotationJump(e: CustomEvent<{ page: number | null; cfi: string | null }>) {
    if (e.detail.page != null) {
      pdfReader?.goToPage(e.detail.page);
      cbzReader?.goToPage(e.detail.page);
    } else if (e.detail.cfi) {
      epubReader?.goToCfi(e.detail.cfi);
    }
  }

  function handleBookmarkJump(e: CustomEvent<{ page: number }>) {
    pdfReader?.goToPage(e.detail.page);
    cbzReader?.goToPage(e.detail.page);
  }
</script>

<svelte:head><title>{book?.title ?? '리더'} — MyLibrary</title></svelte:head>

<div class="flex h-screen flex-col">
  <!-- Nav bar -->
  <nav class="flex items-center gap-3 border-b bg-white px-4 py-2 text-sm">
    <button on:click={() => goto(`/book/${$page.params.id}`)} class="text-indigo-600 hover:underline">
      ← 책 정보
    </button>
    {#if book}
      <span class="flex-1 truncate text-gray-700">{book.title}</span>
    {/if}
    <button
      on:click={() => (panelOpen = !panelOpen)}
      class="rounded px-2 py-1 text-xs font-medium transition
             {panelOpen ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}"
    >
      {#if book?.format === 'cbz'}🔖 북마크{:else}✏️ 어노테이션{/if}
    </button>
  </nav>

  <!-- Reader + Panel -->
  <div class="flex flex-1 overflow-hidden">
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
        <PdfReader
          bind:this={pdfReader}
          bookId={book.id}
          {source}
          initialPage={progress?.page ?? 1}
          bind:annotations
          bind:bookmarks
          on:annotationCreated={e => { annotations = [...annotations, e.detail]; }}
        />
      {:else if book.format === 'epub'}
        <EpubReader
          bind:this={epubReader}
          bookId={book.id}
          {source}
          bind:annotations
          bind:bookmarks
          on:annotationCreated={e => { annotations = [...annotations, e.detail]; }}
        />
      {:else if book.format === 'cbz'}
        <CbzReader
          bind:this={cbzReader}
          bookId={book.id}
          {source}
          initialPage={progress?.page ?? 1}
          bind:bookmarks
        />
      {:else}
        <div class="flex h-full items-center justify-center">
          <p class="text-gray-500">지원하지 않는 형식: {book.format}</p>
        </div>
      {/if}
    </div>

    <!-- Side panel -->
    {#if panelOpen && book}
      <div class="w-72 shrink-0 border-l shadow-md">
        {#if book.format === 'cbz'}
          <BookmarkPanel
            bind:bookmarks
            on:jump={handleBookmarkJump}
          />
        {:else}
          <AnnotationPanel
            bookId={book.id}
            bind:annotations
            selectedId={selectedAnnotationId}
            on:jump={handleAnnotationJump}
          />
        {/if}
      </div>
    {/if}
  </div>
</div>
