<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let x = 0;
  export let y = 0;
  export let visible = false;

  const dispatch = createEventDispatcher<{
    pick: { color: string };
    note: void;
    close: void;
  }>();

  const COLORS = [
    { key: 'yellow', label: '노랑', bg: '#facc15' },
    { key: 'green',  label: '초록', bg: '#4ade80' },
    { key: 'blue',   label: '파랑', bg: '#60a5fa' },
  ];
</script>

{#if visible}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="annotation-toolbar fixed z-50 flex items-center gap-1 rounded-lg bg-gray-900 px-2 py-1.5 shadow-xl"
    style="left: {x}px; top: {y - 44}px;"
    on:mousedown|preventDefault
  >
    {#each COLORS as c}
      <button
        title={c.label}
        on:click={() => dispatch('pick', { color: c.key })}
        class="h-6 w-6 rounded-full border-2 border-white/30 transition hover:scale-110"
        style="background: {c.bg};"
      />
    {/each}
    <div class="mx-1 h-4 w-px bg-gray-600" />
    <button
      title="노트 추가"
      on:click={() => dispatch('note')}
      class="rounded px-1.5 py-0.5 text-xs text-gray-300 hover:bg-gray-700"
    >
      ✏️
    </button>
    <button
      title="닫기"
      on:click={() => dispatch('close')}
      class="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-700"
    >
      ✕
    </button>
  </div>
{/if}
