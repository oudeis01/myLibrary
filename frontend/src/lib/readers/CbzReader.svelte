<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { saveProgress } from '$lib/api/books';
  import { createBookmark, deleteBookmark } from '$lib/api/bookmarks';
  import type { Bookmark } from '$lib/api/bookmarks';

  export let bookId: string;
  export let source: string;
  export let initialPage = 1;
  export let bookmarks: Bookmark[] = [];

  let currentPage = initialPage;
  let pages: string[] = [];
  let loading = true;
  let error = '';

  async function loadCbz() {
    loading = true;
    try {
      const response = await fetch(source);
      if (!response.ok) throw new Error('download failed');
      const blob = await response.blob();
      pages = await extractPages(blob);
      currentPage = Math.min(initialPage, pages.length);
    } catch (e) {
      error = 'CBZ를 불러올 수 없습니다.';
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function extractPages(blob: Blob): Promise<string[]> {
    const { BlobReader, ZipReader, BlobWriter } = await import('@zip.js/zip.js');
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();
    await reader.close();

    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const imageEntries = entries.filter((e) => {
      const name = e.filename.toLowerCase();
      if (name.startsWith('__macosx') || name.startsWith('.')) return false;
      const ext = name.split('.').pop() ?? '';
      return imageExts.includes(ext);
    });
    imageEntries.sort((a, b) =>
      a.filename.toLowerCase().localeCompare(b.filename.toLowerCase(), undefined, { numeric: true })
    );

    const urls: string[] = [];
    const zipReader2 = new ZipReader(new BlobReader(blob));
    const entries2 = await zipReader2.getEntries();
    await zipReader2.close();

    const entryMap = new Map(entries2.map((e) => [e.filename, e]));
    for (const imgEntry of imageEntries) {
      const entry = entryMap.get(imgEntry.filename);
      if (!entry || !('getData' in entry) || typeof entry.getData !== 'function') continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageBlob = await (entry as any).getData(new BlobWriter());
      urls.push(URL.createObjectURL(pageBlob));
    }
    return urls;
  }

  function changePage(n: number) {
    const next = Math.max(1, Math.min(n, pages.length));
    currentPage = next;
    saveProgress(bookId, { page: next, percent: next / pages.length }).catch(() => {});
  }

  export function goToPage(n: number) { changePage(n); }

  async function toggleBookmark() {
    const existing = bookmarks.find(b => b.page === currentPage);
    if (existing) {
      await deleteBookmark(existing.id);
      bookmarks = bookmarks.filter(b => b.id !== existing.id);
    } else {
      const bm = await createBookmark(bookId, currentPage);
      bookmarks = [...bookmarks, bm];
    }
  }

  $: isBookmarked = bookmarks.some(b => b.page === currentPage);

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') changePage(currentPage + 1);
    if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   changePage(currentPage - 1);
  }

  onMount(() => {
    loadCbz();
    window.addEventListener('keydown', handleKey);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKey);
    pages.forEach((url) => URL.revokeObjectURL(url));
  });
</script>

<div class="flex h-full flex-col bg-gray-900">
  <!-- Toolbar -->
  <div class="flex items-center justify-between bg-gray-800 px-4 py-2 text-white">
    <button on:click={() => changePage(currentPage - 1)} disabled={currentPage <= 1} class="rounded px-3 py-1 text-sm hover:bg-gray-700 disabled:opacity-40">
      ← 이전
    </button>
    <div class="flex items-center gap-3">
      <span class="text-sm">{currentPage} / {pages.length}</span>
      <button
        on:click={toggleBookmark}
        title="북마크"
        class="text-sm transition {isBookmarked ? 'text-yellow-400' : 'text-gray-400 hover:text-white'}"
      >🔖</button>
    </div>
    <button on:click={() => changePage(currentPage + 1)} disabled={currentPage >= pages.length} class="rounded px-3 py-1 text-sm hover:bg-gray-700 disabled:opacity-40">
      다음 →
    </button>
  </div>

  <!-- Page image -->
  <div class="flex flex-1 items-center justify-center overflow-hidden bg-gray-800">
    {#if loading}
      <p class="text-gray-400">불러오는 중... (큰 파일은 시간이 걸릴 수 있습니다)</p>
    {:else if error}
      <p class="text-red-400">{error}</p>
    {:else if pages[currentPage - 1]}
      <img
        src={pages[currentPage - 1]}
        alt="페이지 {currentPage}"
        class="max-h-full max-w-full object-contain"
      />
    {/if}
  </div>
</div>
