<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getBook, getProgress, updateBook } from '$lib/api/books';
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

  // Edit modal state
  let showEdit = false;
  let editTitle = '';
  let editAuthors = '';
  let editYear = '';
  let editDescription = '';
  let editTags = '';
  let editSaving = false;
  let editError = '';

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

  function openEdit() {
    if (!book) return;
    editTitle = book.title;
    editAuthors = book.authors.join(', ');
    editYear = book.year != null ? String(book.year) : '';
    editDescription = book.description ?? '';
    editTags = book.tags.join(', ');
    editError = '';
    showEdit = true;
  }

  async function saveEdit() {
    if (!book) return;
    editSaving = true;
    editError = '';
    try {
      const updated = await updateBook(book.id, {
        title: editTitle || undefined,
        authors: editAuthors ? editAuthors.split(',').map((a) => a.trim()).filter(Boolean) : undefined,
        year: editYear ? parseInt(editYear, 10) : undefined,
        description: editDescription || undefined,
        tags: editTags ? editTags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      });
      book = updated;
      showEdit = false;
    } catch (e: unknown) {
      editError = e instanceof Error ? e.message : '저장에 실패했습니다.';
    } finally {
      editSaving = false;
    }
  }

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
    <button on:click={() => goto('/library')} class="text-indigo-600 hover:underline">
      ← 라이브러리
    </button>
    {#if book}
      <span class="flex-1 truncate text-gray-700">{book.title}</span>
    {/if}
    {#if book}
      <button
        on:click={openEdit}
        class="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
        title="메타데이터 편집"
      >✏️ 편집</button>
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

<!-- Edit Metadata Modal -->
{#if showEdit && book}
  <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" on:click|self={() => (showEdit = false)}>
    <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <h2 class="mb-4 text-lg font-bold text-gray-900">메타데이터 편집</h2>

      {#if editError}
        <p class="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</p>
      {/if}

      <div class="flex flex-col gap-3">
        <div>
          <label for="edit-title" class="mb-1 block text-xs font-medium text-gray-600">제목</label>
          <input id="edit-title" bind:value={editTitle}
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label for="edit-authors" class="mb-1 block text-xs font-medium text-gray-600">저자 (쉼표 구분)</label>
          <input id="edit-authors" bind:value={editAuthors}
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label for="edit-year" class="mb-1 block text-xs font-medium text-gray-600">출판년도</label>
          <input id="edit-year" bind:value={editYear} type="number" min="1000" max="9999"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label for="edit-tags" class="mb-1 block text-xs font-medium text-gray-600">태그 (쉼표 구분)</label>
          <input id="edit-tags" bind:value={editTags} placeholder="소설, 추리, 한국문학"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label for="edit-desc" class="mb-1 block text-xs font-medium text-gray-600">설명</label>
          <textarea id="edit-desc" bind:value={editDescription} rows="3"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
      </div>

      <div class="mt-4 flex gap-2">
        <button
          on:click={saveEdit}
          disabled={editSaving}
          class="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >{editSaving ? '저장 중...' : '저장'}</button>
        <button on:click={() => (showEdit = false)}
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >취소</button>
      </div>
    </div>
  </div>
{/if}
