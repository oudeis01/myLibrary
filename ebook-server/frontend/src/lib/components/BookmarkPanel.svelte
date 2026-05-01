<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Bookmark } from '$lib/api/bookmarks';
  import { deleteBookmark } from '$lib/api/bookmarks';

  export let bookmarks: Bookmark[] = [];

  const dispatch = createEventDispatcher<{ jump: { page: number } }>();

  async function handleDelete(id: string) {
    await deleteBookmark(id);
    bookmarks = bookmarks.filter(b => b.id !== id);
  }
</script>

<div class="flex h-full flex-col bg-white">
  <div class="border-b px-3 py-2">
    <span class="text-sm font-semibold text-gray-700">북마크 ({bookmarks.length})</span>
  </div>

  <div class="flex-1 overflow-y-auto">
    {#if bookmarks.length === 0}
      <p class="p-4 text-center text-xs text-gray-400">북마크가 없습니다.</p>
    {:else}
      {#each bookmarks as bm (bm.id)}
        <div class="group flex items-center justify-between border-b px-3 py-2 hover:bg-gray-50">
          <button
            on:click={() => dispatch('jump', { page: bm.page })}
            class="flex flex-1 items-center gap-2 text-left text-sm"
          >
            <span class="text-base">🔖</span>
            <div>
              <span class="font-medium text-gray-800">p.{bm.page}</span>
              {#if bm.label}
                <p class="text-xs text-gray-500">{bm.label}</p>
              {/if}
            </div>
          </button>
          <button
            on:click={() => handleDelete(bm.id)}
            class="hidden text-xs text-gray-400 hover:text-red-500 group-hover:block"
          >🗑</button>
        </div>
      {/each}
    {/if}
  </div>
</div>
