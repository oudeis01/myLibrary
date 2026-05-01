<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Annotation } from '$lib/api/annotations';
  import { updateAnnotation, deleteAnnotation, exportAnnotations } from '$lib/api/annotations';

  export let bookId: string;
  export let annotations: Annotation[] = [];
  export let selectedId: string | null = null;

  const dispatch = createEventDispatcher<{ jump: { page: number | null; cfi: string | null } }>();

  const COLOR_BG: Record<string, string> = {
    yellow: '#fef08a', green: '#bbf7d0', blue: '#bfdbfe',
  };

  let editingId: string | null = null;
  let editNote = '';

  function startEdit(ann: Annotation) {
    editingId = ann.id;
    editNote = ann.note ?? '';
  }

  async function saveNote(ann: Annotation) {
    const updated = await updateAnnotation(ann.id, editNote);
    annotations = annotations.map(a => a.id === updated.id ? updated : a);
    editingId = null;
  }

  async function handleDelete(id: string) {
    await deleteAnnotation(id);
    annotations = annotations.filter(a => a.id !== id);
  }
</script>

<div class="flex h-full flex-col bg-white">
  <!-- Header -->
  <div class="flex items-center justify-between border-b px-3 py-2">
    <span class="text-sm font-semibold text-gray-700">어노테이션 ({annotations.length})</span>
    <div class="flex gap-1">
      <button
        on:click={() => exportAnnotations(bookId, 'md')}
        title="Markdown으로 내보내기"
        class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
      >MD</button>
      <button
        on:click={() => exportAnnotations(bookId, 'json')}
        title="JSON으로 내보내기"
        class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
      >JSON</button>
    </div>
  </div>

  <!-- List -->
  <div class="flex-1 overflow-y-auto">
    {#if annotations.length === 0}
      <p class="p-4 text-center text-xs text-gray-400">텍스트를 선택해 하이라이트하세요.</p>
    {:else}
      {#each annotations as ann (ann.id)}
        <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
        <div
          class="group border-b px-3 py-2 text-sm transition
                 {selectedId === ann.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}"
          on:click={() => dispatch('jump', { page: ann.page, cfi: ann.cfi_range })}
        >
          <!-- Location badge -->
          <span class="mb-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium"
                style="background: {COLOR_BG[ann.color ?? 'yellow'] ?? '#fef08a'}">
            {ann.page != null ? `p.${ann.page}` : ann.cfi_range ? 'EPUB' : '?'}
          </span>

          <!-- Selected text -->
          {#if ann.text_content}
            <p class="line-clamp-2 text-xs text-gray-600">"{ann.text_content}"</p>
          {/if}

          <!-- Note -->
          {#if editingId === ann.id}
            <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
            <div on:click|stopPropagation>
              <textarea
                bind:value={editNote}
                rows="2"
                class="mt-1 w-full rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <div class="mt-1 flex gap-1">
                <button on:click={() => saveNote(ann)} class="rounded bg-indigo-600 px-2 py-0.5 text-xs text-white">저장</button>
                <button on:click={() => (editingId = null)} class="rounded px-2 py-0.5 text-xs text-gray-500">취소</button>
              </div>
            </div>
          {:else}
            {#if ann.note}
              <p class="mt-0.5 text-xs italic text-gray-500">{ann.note}</p>
            {/if}
            <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
            <div class="mt-1 hidden gap-1 group-hover:flex" on:click|stopPropagation>
              <button on:click={() => startEdit(ann)} class="text-xs text-gray-400 hover:text-indigo-600">✏️ 노트</button>
              <button on:click={() => handleDelete(ann.id)} class="text-xs text-gray-400 hover:text-red-500">🗑</button>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>
