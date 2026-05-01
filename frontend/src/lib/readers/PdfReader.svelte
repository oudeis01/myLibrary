<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { saveProgress } from '$lib/api/books';
  import { createAnnotation, deleteAnnotation } from '$lib/api/annotations';
  import { createBookmark, deleteBookmark } from '$lib/api/bookmarks';
  import type { Annotation } from '$lib/api/annotations';
  import type { Bookmark } from '$lib/api/bookmarks';
  import AnnotationToolbar from '$lib/components/AnnotationToolbar.svelte';

  export let bookId: string;
  export let source: string;
  export let initialPage = 1;
  export let annotations: Annotation[] = [];
  export let bookmarks: Bookmark[] = [];

  const dispatch = createEventDispatcher<{ annotationCreated: Annotation }>();

  let canvas: HTMLCanvasElement;
  let textLayerDiv: HTMLDivElement;
  let annotationSvg: SVGSVGElement;
  let container: HTMLDivElement;

  let pdfDoc: unknown = null;
  let currentPage = initialPage;
  let totalPages = 0;
  let loading = true;
  let error = '';
  let pdfjsLib: typeof import('pdfjs-dist') | null = null;

  // 현재 렌더된 viewport 저장 (좌표 변환용)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentViewport: any = null;
  let currentDpr = 1;

  // Annotation toolbar state
  let toolbarVisible = false;
  let toolbarX = 0;
  let toolbarY = 0;
  let pendingText = '';
  let pendingRects: Array<{ x: number; y: number; width: number; height: number }> = [];

  const COLOR_FILL: Record<string, string> = {
    yellow: '#facc15', green: '#4ade80', blue: '#60a5fa',
  };

  // --- PDF 로드 ---

  async function loadPdf() {
    loading = true;
    error = '';
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjsLib = pdfjs;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      pdfDoc = await pdfjs.getDocument(source).promise;
      // @ts-ignore
      totalPages = pdfDoc.numPages;
      await renderPage(currentPage);
    } catch (e) {
      error = 'PDF를 불러올 수 없습니다.';
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function renderPage(pageNum: number) {
    if (!pdfDoc || !pdfjsLib) return;

    // @ts-ignore
    const pdfPage = await pdfDoc.getPage(pageNum);
    const dpr = window.devicePixelRatio || 1;
    currentDpr = dpr;
    const desiredWidth = container?.clientWidth || 800;

    const baseViewport = pdfPage.getViewport({ scale: 1 });
    const scale = (desiredWidth / baseViewport.width) * dpr;
    const viewport = pdfPage.getViewport({ scale });
    currentViewport = viewport;

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / dpr}px`;
    canvas.style.height = `${viewport.height / dpr}px`;

    // SVG overlay: same CSS size as canvas
    annotationSvg.style.width = canvas.style.width;
    annotationSvg.style.height = canvas.style.height;
    annotationSvg.setAttribute('viewBox', `0 0 ${viewport.width / dpr} ${viewport.height / dpr}`);

    const ctx = canvas.getContext('2d')!;
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;

    textLayerDiv.innerHTML = '';
    textLayerDiv.style.width = canvas.style.width;
    textLayerDiv.style.height = canvas.style.height;

    try {
      // @ts-ignore
      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: await pdfPage.streamTextContent(),
        container: textLayerDiv,
        viewport,
      });
      await textLayer.render();
    } catch { /* non-fatal */ }

    currentPage = pageNum;
    saveProgress(bookId, { page: pageNum, percent: pageNum / totalPages }).catch(() => {});
    renderAnnotationOverlay(pageNum);
  }

  // --- 어노테이션 오버레이 렌더링 ---

  function renderAnnotationOverlay(page: number) {
    if (!annotationSvg || !currentViewport) return;
    annotationSvg.innerHTML = '';
    const dpr = currentDpr;

    for (const ann of annotations) {
      if (ann.page !== page || !ann.position) continue;
      const pos = ann.position as { rects: Array<{ x: number; y: number; width: number; height: number }> };
      for (const rect of pos.rects) {
        // PDF 좌표 → viewport raw px → CSS px
        const [vx1, vy1] = currentViewport.convertToViewportPoint(rect.x, rect.y + rect.height);
        const [vx2, vy2] = currentViewport.convertToViewportPoint(rect.x + rect.width, rect.y);
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        el.setAttribute('x',      String(Math.min(vx1, vx2) / dpr));
        el.setAttribute('y',      String(Math.min(vy1, vy2) / dpr));
        el.setAttribute('width',  String(Math.abs(vx2 - vx1) / dpr));
        el.setAttribute('height', String(Math.abs(vy2 - vy1) / dpr));
        el.setAttribute('fill', COLOR_FILL[ann.color ?? 'yellow']);
        el.setAttribute('fill-opacity', '0.4');
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => { /* 향후 패널 선택 */ });
        annotationSvg.appendChild(el);
      }
    }
  }

  // 부모에서 annotations 바인딩이 변경될 때 오버레이 갱신
  $: if (annotations && currentPage) renderAnnotationOverlay(currentPage);

  // --- 텍스트 선택 감지 ---

  function handleMouseUp(e: MouseEvent) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !currentViewport) { hideToolbar(); return; }
    const text = sel.toString().trim();
    if (!text) { hideToolbar(); return; }

    const canvasRect = canvas.getBoundingClientRect();
    const dpr = currentDpr;

    // 브라우저 좌표 → canvas raw px → pdf 좌표
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (const r of Array.from(sel.getRangeAt(0).getClientRects())) {
      // left-top corner
      const [x1, y1] = currentViewport.convertToPdfPoint(
        (r.left  - canvasRect.left) * dpr,
        (r.top   - canvasRect.top)  * dpr,
      );
      // right-bottom corner
      const [x2, y2] = currentViewport.convertToPdfPoint(
        (r.right  - canvasRect.left) * dpr,
        (r.bottom - canvasRect.top)  * dpr,
      );
      rects.push({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      });
    }

    if (rects.length === 0) return;
    pendingText = text;
    pendingRects = rects;
    toolbarX = e.clientX;
    toolbarY = e.clientY;
    toolbarVisible = true;
  }

  function hideToolbar() {
    toolbarVisible = false;
    pendingText = '';
    pendingRects = [];
  }

  async function handleColorPick(e: CustomEvent<{ color: string }>) {
    const color = e.detail.color;
    window.getSelection()?.removeAllRanges();
    hideToolbar();

    const ann = await createAnnotation(bookId, {
      kind: 'highlight',
      color,
      page: currentPage,
      position: { rects: pendingRects },
      text_content: pendingText,
    });
    annotations = [...annotations, ann];
    dispatch('annotationCreated', ann);
  }

  // --- 북마크 ---

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

  // --- 내비게이션 (부모가 goToPage 호출 가능) ---

  export function goToPage(n: number) {
    if (n >= 1 && n <= totalPages) renderPage(n);
  }

  function prevPage() { if (currentPage > 1) renderPage(currentPage - 1); }
  function nextPage() { if (currentPage < totalPages) renderPage(currentPage + 1); }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') nextPage();
    if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   prevPage();
  }

  onMount(() => {
    loadPdf();
    window.addEventListener('keydown', handleKey);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKey);
  });
</script>

<!-- Annotation toolbar (floating) -->
<AnnotationToolbar
  x={toolbarX}
  y={toolbarY}
  visible={toolbarVisible}
  on:pick={handleColorPick}
  on:close={hideToolbar}
/>

<div class="flex h-full flex-col bg-gray-900">
  <!-- Toolbar -->
  <div class="flex items-center justify-between bg-gray-800 px-4 py-2 text-white">
    <button on:click={prevPage} disabled={currentPage <= 1} class="rounded px-3 py-1 text-sm hover:bg-gray-700 disabled:opacity-40">
      ← 이전
    </button>
    <span class="text-sm">{currentPage} / {totalPages}</span>
    <div class="flex items-center gap-2">
      <button
        on:click={toggleBookmark}
        title="북마크"
        class="rounded px-2 py-1 text-sm transition {isBookmarked ? 'text-yellow-400' : 'text-gray-400 hover:text-white'}"
      >🔖</button>
      <button on:click={nextPage} disabled={currentPage >= totalPages} class="rounded px-3 py-1 text-sm hover:bg-gray-700 disabled:opacity-40">
        다음 →
      </button>
    </div>
  </div>

  <!-- Canvas area -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div bind:this={container} class="relative flex flex-1 items-start justify-center overflow-auto bg-gray-700 p-4">
    {#if loading}
      <p class="text-gray-300">불러오는 중...</p>
    {:else if error}
      <p class="text-red-400">{error}</p>
    {:else}
      <div class="relative" on:mouseup={handleMouseUp}>
        <canvas bind:this={canvas} class="shadow-2xl" />
        <div bind:this={textLayerDiv} class="absolute left-0 top-0 select-text opacity-0" />
        <!-- SVG annotation overlay (pointer-events: none 이므로 텍스트 선택 방해 안 함) -->
        <svg
          bind:this={annotationSvg}
          class="absolute left-0 top-0 overflow-visible"
          style="pointer-events: none;"
        />
      </div>
    {/if}
  </div>
</div>
