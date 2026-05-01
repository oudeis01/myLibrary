<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { saveProgress, getProgress } from '$lib/api/books';
  import { createAnnotation } from '$lib/api/annotations';
  import { createBookmark, deleteBookmark } from '$lib/api/bookmarks';
  import type { Annotation } from '$lib/api/annotations';
  import type { Bookmark } from '$lib/api/bookmarks';
  import AnnotationToolbar from '$lib/components/AnnotationToolbar.svelte';

  export let bookId: string;
  export let source: string;
  export let annotations: Annotation[] = [];
  export let bookmarks: Bookmark[] = [];

  const dispatch = createEventDispatcher<{ annotationCreated: Annotation }>();

  let container: HTMLDivElement;
  let loading = true;
  let error = '';
  let currentPercent = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let book: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rendition: any;
  let saveTimer: ReturnType<typeof setTimeout>;

  // Toolbar state
  let toolbarVisible = false;
  let toolbarX = 0;
  let toolbarY = 0;
  let pendingCfi = '';
  let pendingText = '';

  const COLOR_CSS: Record<string, string> = {
    yellow: 'rgba(250,204,21,0.4)',
    green:  'rgba(74,222,128,0.4)',
    blue:   'rgba(96,165,250,0.4)',
  };

  function debouncedSave(cfi: string, percent: number) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveProgress(bookId, { page: 0, cfi, percent }).catch(() => {});
    }, 1500);
  }

  function applyAnnotations() {
    if (!rendition) return;
    for (const ann of annotations) {
      if (!ann.cfi_range) continue;
      try {
        rendition.annotations.highlight(
          ann.cfi_range,
          {},
          () => {},
          `ann-${ann.id}`,
          { fill: COLOR_CSS[ann.color ?? 'yellow'] }
        );
      } catch { /* non-fatal */ }
    }
  }

  onMount(async () => {
    loading = true;
    try {
      const Epub = (await import('epubjs')).default;
      book = Epub(source);
      rendition = book.renderTo(container, { width: '100%', height: '100%', spread: 'none' });

      const progress = await getProgress(bookId);
      if (progress?.cfi) {
        await rendition.display(progress.cfi);
      } else {
        await rendition.display();
      }

      rendition.on('relocated', (location: { start: { cfi: string } }) => {
        book.locations.generate(1024).then(() => {
          const pct = book.locations.percentageFromCfi(location.start.cfi) as number;
          currentPercent = Math.round(pct * 100);
          debouncedSave(location.start.cfi, pct);
        });
        // 챕터 이동 후 어노테이션 재적용
        setTimeout(applyAnnotations, 300);
      });

      // 텍스트 선택 감지 (EPUB iframe 내부)
      rendition.on('selected', (cfiRange: string, contents: { window: Window }) => {
        const text = contents.window.getSelection()?.toString().trim() ?? '';
        if (!text) return;
        pendingCfi = cfiRange;
        pendingText = text;
        // 툴바를 화면 중앙 상단에 표시
        toolbarX = window.innerWidth / 2 - 80;
        toolbarY = 80;
        toolbarVisible = true;
      });

      applyAnnotations();
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

  async function handleColorPick(e: CustomEvent<{ color: string }>) {
    const color = e.detail.color;
    toolbarVisible = false;
    const ann = await createAnnotation(bookId, {
      kind: 'highlight',
      color,
      cfi_range: pendingCfi,
      text_content: pendingText,
    });
    annotations = [...annotations, ann];
    try {
      rendition.annotations.highlight(
        pendingCfi, {}, () => {}, `ann-${ann.id}`,
        { fill: COLOR_CSS[color] }
      );
    } catch { /* non-fatal */ }
    dispatch('annotationCreated', ann);
  }

  // 북마크 (EPUB은 CFI 위치를 page 0 으로 저장)
  async function toggleBookmark() {
    const existing = bookmarks.find(b => b.page === 0 && b.label === rendition?.currentLocation()?.start?.cfi);
    if (existing) {
      await deleteBookmark(existing.id);
      bookmarks = bookmarks.filter(b => b.id !== existing.id);
    } else {
      const cfi = rendition?.currentLocation()?.start?.cfi ?? '';
      const bm = await createBookmark(bookId, 0, cfi);
      bookmarks = [...bookmarks, bm];
    }
  }

  export function goToCfi(cfi: string) { rendition?.display(cfi); }

  function prevPage() { rendition?.prev(); }
  function nextPage() { rendition?.next(); }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') nextPage();
    if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   prevPage();
  }
</script>

<svelte:window on:keydown={handleKey} />

<!-- Floating annotation toolbar -->
<AnnotationToolbar
  x={toolbarX}
  y={toolbarY}
  visible={toolbarVisible}
  on:pick={handleColorPick}
  on:close={() => (toolbarVisible = false)}
/>

<div class="flex h-full flex-col bg-white">
  <!-- Toolbar -->
  <div class="flex items-center justify-between border-b bg-gray-50 px-4 py-2">
    <button on:click={prevPage} class="rounded px-3 py-1 text-sm hover:bg-gray-200">← 이전</button>
    <div class="flex items-center gap-3">
      <span class="text-xs text-gray-500">{currentPercent}%</span>
      <button on:click={toggleBookmark} title="북마크" class="text-sm text-gray-400 hover:text-yellow-500">🔖</button>
    </div>
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
