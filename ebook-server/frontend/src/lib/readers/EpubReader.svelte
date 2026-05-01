<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { saveProgress, getProgress } from '$lib/api/books';

  export let bookId: string;

  let container: HTMLDivElement;
  let loading = true;
  let error = '';
  let currentPercent = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let book: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rendition: any;

  let saveTimer: ReturnType<typeof setTimeout>;

  function debouncedSave(cfi: string, percent: number) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveProgress(bookId, { page: 0, cfi, percent }).catch(() => {});
    }, 1500);
  }

  onMount(async () => {
    loading = true;
    try {
      // Dynamic import to avoid SSR window errors
      const Epub = (await import('epubjs')).default;

      book = Epub(`/api/reader/${bookId}/epub`);
      rendition = book.renderTo(container, {
        width: '100%',
        height: '100%',
        spread: 'none',
      });

      // Restore progress
      const progress = await getProgress(bookId);
      if (progress?.cfi) {
        await rendition.display(progress.cfi);
      } else {
        await rendition.display();
      }

      rendition.on('relocated', (location: { start: { cfi: string }; end: { cfi: string } }) => {
        // Generate locations in background for percent calculation
        book.locations.generate(1024).then(() => {
          const pct = book.locations.percentageFromCfi(location.start.cfi) as number;
          currentPercent = Math.round(pct * 100);
          debouncedSave(location.start.cfi, pct);
        });
      });

      loading = false;
    } catch (e) {
      error = 'EPUB을 불러올 수 없습니다.';
      loading = false;
      console.error(e);
    }
  });

  onDestroy(() => {
    clearTimeout(saveTimer);
    rendition?.destroy();
    book?.destroy();
  });

  function prevPage() { rendition?.prev(); }
  function nextPage() { rendition?.next(); }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') nextPage();
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') prevPage();
  }
</script>

<svelte:window on:keydown={handleKey} />

<div class="flex h-full flex-col bg-white">
  <!-- Toolbar -->
  <div class="flex items-center justify-between border-b bg-gray-50 px-4 py-2">
    <button on:click={prevPage} class="rounded px-3 py-1 text-sm hover:bg-gray-200">← 이전</button>
    <span class="text-xs text-gray-500">{currentPercent}%</span>
    <button on:click={nextPage} class="rounded px-3 py-1 text-sm hover:bg-gray-200">다음 →</button>
  </div>

  {#if loading}
    <div class="flex flex-1 items-center justify-center">
      <p class="text-gray-400">불러오는 중...</p>
    </div>
  {:else if error}
    <div class="flex flex-1 items-center justify-center">
      <p class="text-red-500">{error}</p>
    </div>
  {:else}
    <div bind:this={container} class="flex-1" />
  {/if}
</div>
