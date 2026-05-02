<script lang="ts">
  import { onMount } from 'svelte';
  import { listBooks, listLibraries, uploadBook, searchBooks } from '$lib/api/books';
  import { books, libraries, loading, searchQuery, formatFilter } from '$lib/stores/library';
  import BookCard from '$lib/components/BookCard.svelte';
  import type { BookSummary, Library } from '$lib/api/books';

  const FORMATS = ['all', 'pdf', 'epub', 'cbz'] as const;

  let allBooks: BookSummary[] = [];
  let activeTag: string | null = null;
  let activeYear: number | null = null;
  let searchTimer: ReturnType<typeof setTimeout>;

  // Upload modal state
  let showUpload = false;
  let uploadFile: File | null = null;
  let uploadLibraryId = '';
  let uploadTitle = '';
  let uploadAuthors = '';
  let uploadYear = '';
  let uploading = false;
  let uploadError = '';
  let uploadDragging = false;
  let fileInput: HTMLInputElement;

  $: allTags = [...new Set(allBooks.flatMap((b) => b.tags ?? []))].sort();
  $: allYears = [...new Set(allBooks.map((b) => b.year).filter((y): y is number => y != null))].sort((a, b) => b - a);

  $: filtered = activeTag || activeYear || $formatFilter !== 'all'
    ? allBooks.filter((b) => {
        const matchFormat = $formatFilter === 'all' || b.format === $formatFilter;
        const matchTag = !activeTag || (b.tags ?? []).includes(activeTag);
        const matchYear = !activeYear || b.year === activeYear;
        return matchFormat && matchTag && matchYear;
      })
    : allBooks;

  onMount(async () => {
    loading.set(true);
    try {
      const [booksData, libsData] = await Promise.all([listBooks({ limit: 200 }), listLibraries()]);
      allBooks = booksData;
      books.set(booksData);
      libraries.set(libsData);
      if (libsData.length > 0) uploadLibraryId = libsData[0].id;
    } catch (e) {
      console.error(e);
    } finally {
      loading.set(false);
    }
  });

  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(doSearch, 300);
  }

  async function doSearch() {
    loading.set(true);
    try {
      let data: BookSummary[];
      if ($searchQuery) {
        data = await searchBooks({ q: $searchQuery, limit: 200 });
        if ($formatFilter !== 'all') data = data.filter((b) => b.format === $formatFilter);
        if (activeTag) data = data.filter((b) => (b.tags ?? []).includes(activeTag!));
        if (activeYear) data = data.filter((b) => b.year === activeYear);
      } else {
        const params: Parameters<typeof listBooks>[0] = { limit: 200 };
        if ($formatFilter !== 'all') params.format = $formatFilter;
        if (activeTag) params.tag = activeTag;
        if (activeYear) params.year = activeYear;
        data = await listBooks(params);
      }
      allBooks = data;
    } catch (e) {
      console.error(e);
    } finally {
      loading.set(false);
    }
  }

  async function applyFilter() {
    searchQuery.set($searchQuery);
    await doSearch();
  }

  function toggleTag(tag: string) {
    activeTag = activeTag === tag ? null : tag;
    applyFilter();
  }

  function toggleYear(year: number) {
    activeYear = activeYear === year ? null : year;
    applyFilter();
  }

  function onFormatClick(fmt: typeof FORMATS[number]) {
    formatFilter.set(fmt);
    applyFilter();
  }

  // Upload handlers
  function onDragOver(e: DragEvent) { e.preventDefault(); uploadDragging = true; }
  function onDragLeave() { uploadDragging = false; }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    uploadDragging = false;
    const f = e.dataTransfer?.files[0];
    if (f) uploadFile = f;
  }
  function onFileChange() {
    uploadFile = fileInput?.files?.[0] ?? null;
  }

  async function handleUpload() {
    if (!uploadFile || !uploadLibraryId) return;
    uploading = true;
    uploadError = '';
    try {
      const meta = {
        title: uploadTitle || undefined,
        authors: uploadAuthors || undefined,
        year: uploadYear ? parseInt(uploadYear, 10) : undefined,
      };
      const book = await uploadBook(uploadLibraryId, uploadFile, meta);
      allBooks = [book, ...allBooks];
      showUpload = false;
      uploadFile = null;
      uploadTitle = '';
      uploadAuthors = '';
      uploadYear = '';
    } catch (e: unknown) {
      uploadError = e instanceof Error ? e.message : '업로드에 실패했습니다.';
    } finally {
      uploading = false;
    }
  }
</script>

<svelte:head><title>내 라이브러리 — MyLibrary</title></svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <header class="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
      <h1 class="text-lg font-bold text-gray-900">내 라이브러리</h1>
      <button
        on:click={() => { showUpload = true; uploadError = ''; }}
        class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
      >+ 업로드</button>
    </div>
  </header>

  <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
    <!-- Search & Format Filter -->
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        type="search"
        placeholder="제목, 저자, 태그 검색..."
        bind:value={$searchQuery}
        on:input={onSearchInput}
        class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none sm:max-w-xs"
      />
      <div class="flex gap-2">
        {#each FORMATS as fmt}
          <button
            on:click={() => onFormatClick(fmt)}
            class="rounded-full px-3 py-1 text-xs font-medium transition
                   {$formatFilter === fmt
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
          >
            {fmt === 'all' ? '전체' : fmt.toUpperCase()}
          </button>
        {/each}
      </div>
    </div>

    <!-- Tag Filter -->
    {#if allTags.length > 0}
      <div class="mb-4 flex flex-wrap gap-1.5">
        {#each allTags as tag}
          <button
            on:click={() => toggleTag(tag)}
            class="rounded-full px-2.5 py-0.5 text-xs font-medium transition
                   {activeTag === tag
              ? 'bg-indigo-600 text-white'
              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}"
          >{tag}</button>
        {/each}
        {#if allYears.length > 0}
          <select
            value={activeYear ?? ''}
            on:change={(e) => { activeYear = e.currentTarget.value ? parseInt(e.currentTarget.value, 10) : null; applyFilter(); }}
            class="ml-2 rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-600 focus:outline-none"
          >
            <option value="">연도 전체</option>
            {#each allYears as year}
              <option value={year}>{year}</option>
            {/each}
          </select>
        {/if}
      </div>
    {/if}

    <!-- Grid -->
    {#if $loading}
      <p class="text-center text-gray-400">불러오는 중...</p>
    {:else if filtered.length === 0}
      <p class="text-center text-gray-400">책이 없습니다.</p>
    {:else}
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each filtered as book (book.id)}
          <BookCard {book} />
        {/each}
      </div>
    {/if}
  </main>
</div>

<!-- Upload Modal -->
{#if showUpload}
  <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" on:click|self={() => (showUpload = false)}>
    <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <h2 class="mb-4 text-lg font-bold text-gray-900">책 업로드</h2>

      {#if uploadError}
        <p class="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{uploadError}</p>
      {/if}

      <!-- Drop zone -->
      <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
      <div
        class="mb-4 cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition
               {uploadDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'}"
        on:dragover={onDragOver}
        on:dragleave={onDragLeave}
        on:drop={onDrop}
        on:click={() => fileInput.click()}
      >
        {#if uploadFile}
          <p class="text-sm font-medium text-indigo-700">{uploadFile.name}</p>
          <p class="text-xs text-gray-400">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
        {:else}
          <p class="text-sm text-gray-500">PDF / EPUB / CBZ 파일을<br/>드래그하거나 클릭하여 선택</p>
        {/if}
        <input bind:this={fileInput} type="file" accept=".pdf,.epub,.cbz" class="hidden" on:change={onFileChange} />
      </div>

      <!-- Library selector (admin or multiple libraries) -->
      {#if $libraries.length > 1}
        <div class="mb-3">
          <label for="upload-library" class="mb-1 block text-xs font-medium text-gray-700">라이브러리</label>
          <select id="upload-library" bind:value={uploadLibraryId}
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            {#each $libraries as lib}
              <option value={lib.id}>{lib.name}</option>
            {/each}
          </select>
        </div>
      {/if}

      <!-- Optional metadata -->
      <div class="mb-3 flex flex-col gap-2">
        <input bind:value={uploadTitle} placeholder="제목 (비우면 파일명 사용)"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        <input bind:value={uploadAuthors} placeholder="저자 (쉼표로 구분)"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        <input bind:value={uploadYear} placeholder="출판년도" type="number" min="1000" max="9999"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
      </div>

      <div class="flex gap-2">
        <button
          on:click={handleUpload}
          disabled={!uploadFile || uploading}
          class="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >{uploading ? '업로드 중...' : '업로드'}</button>
        <button on:click={() => (showUpload = false)}
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >취소</button>
      </div>
    </div>
  </div>
{/if}
