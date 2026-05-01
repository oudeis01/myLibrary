<script lang="ts">
  import type { BookSummary } from '$lib/api/books';

  export let book: BookSummary;

  const FORMAT_COLORS: Record<string, string> = {
    pdf: 'bg-red-100 text-red-700',
    epub: 'bg-green-100 text-green-700',
    cbz: 'bg-blue-100 text-blue-700',
  };

  const FORMAT_ICONS: Record<string, string> = {
    pdf: 'PDF',
    epub: 'ePub',
    cbz: 'CBZ',
  };
</script>

<a href="/book/{book.id}" class="group flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200 transition hover:shadow-md hover:ring-indigo-300">
  <!-- Cover -->
  <div class="relative aspect-[2/3] bg-gray-100">
    {#if book.cover_path}
      <img
        src="/api/reader/{book.id}/cover"
        alt={book.title}
        class="h-full w-full object-cover"
        loading="lazy"
      />
    {:else}
      <div class="flex h-full items-center justify-center text-4xl text-gray-300">📖</div>
    {/if}
    <span class="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-xs font-bold {FORMAT_COLORS[book.format] ?? 'bg-gray-100 text-gray-600'}">
      {FORMAT_ICONS[book.format] ?? book.format.toUpperCase()}
    </span>
  </div>

  <!-- Info -->
  <div class="flex flex-1 flex-col p-3">
    <p class="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-indigo-700">
      {book.title}
    </p>
    {#if book.authors.length > 0}
      <p class="mt-1 line-clamp-1 text-xs text-gray-500">{book.authors.join(', ')}</p>
    {/if}
    {#if book.year}
      <p class="mt-auto pt-2 text-xs text-gray-400">{book.year}</p>
    {/if}
  </div>
</a>
