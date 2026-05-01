<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { saveProgress } from '$lib/api/books';

  export let bookId: string;
  export let initialPage = 1;

  let canvas: HTMLCanvasElement;
  let textLayerDiv: HTMLDivElement;
  let container: HTMLDivElement;

  let pdfDoc: unknown = null;
  let currentPage = initialPage;
  let totalPages = 0;
  let loading = true;
  let error = '';

  // pdf.js is loaded dynamically to avoid SSR issues
  let pdfjsLib: typeof import('pdfjs-dist') | null = null;

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

      const url = `/api/books/${bookId}/download`;
      pdfDoc = await pdfjs.getDocument(url).promise;
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
    const desiredWidth = container?.clientWidth || 800;

    const baseViewport = pdfPage.getViewport({ scale: 1 });
    const scale = (desiredWidth / baseViewport.width) * dpr;
    const viewport = pdfPage.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / dpr}px`;
    canvas.style.height = `${viewport.height / dpr}px`;

    const ctx = canvas.getContext('2d')!;
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;

    // Text layer
    textLayerDiv.innerHTML = '';
    textLayerDiv.style.width = canvas.style.width;
    textLayerDiv.style.height = canvas.style.height;

    try {
      // @ts-ignore — TextLayer API changed in pdf.js v4
      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: await pdfPage.streamTextContent(),
        container: textLayerDiv,
        viewport,
      });
      await textLayer.render();
    } catch {
      // TextLayer failure is non-fatal
    }

    currentPage = pageNum;
    saveProgress(bookId, { page: pageNum, percent: pageNum / totalPages }).catch(() => {});
  }

  function prevPage() {
    if (currentPage > 1) renderPage(currentPage - 1);
  }

  function nextPage() {
    if (currentPage < totalPages) renderPage(currentPage + 1);
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') nextPage();
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') prevPage();
  }

  onMount(() => {
    loadPdf();
    window.addEventListener('keydown', handleKey);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKey);
  });
</script>

<div class="flex h-full flex-col bg-gray-900">
  <!-- Toolbar -->
  <div class="flex items-center justify-between bg-gray-800 px-4 py-2 text-white">
    <button on:click={prevPage} disabled={currentPage <= 1} class="rounded px-3 py-1 text-sm hover:bg-gray-700 disabled:opacity-40">
      ← 이전
    </button>
    <span class="text-sm">{currentPage} / {totalPages}</span>
    <button on:click={nextPage} disabled={currentPage >= totalPages} class="rounded px-3 py-1 text-sm hover:bg-gray-700 disabled:opacity-40">
      다음 →
    </button>
  </div>

  <!-- Canvas area -->
  <div bind:this={container} class="relative flex flex-1 items-start justify-center overflow-auto bg-gray-700 p-4">
    {#if loading}
      <p class="text-gray-300">불러오는 중...</p>
    {:else if error}
      <p class="text-red-400">{error}</p>
    {:else}
      <div class="relative">
        <canvas bind:this={canvas} class="shadow-2xl" />
        <div bind:this={textLayerDiv} class="absolute left-0 top-0 select-text opacity-0" />
      </div>
    {/if}
  </div>
</div>
