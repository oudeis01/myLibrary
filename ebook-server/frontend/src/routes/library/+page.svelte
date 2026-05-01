<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { listBooks, listLibraries } from '$lib/api/books';
  import { logout } from '$lib/api/auth';
  import { books, libraries, loading, searchQuery, formatFilter } from '$lib/stores/library';
  import { accessToken } from '$lib/stores/auth';
  import BookCard from '$lib/components/BookCard.svelte';
  import type { BookSummary } from '$lib/api/books';

  const FORMATS = ['all', 'pdf', 'epub', 'cbz'] as const;

  let allBooks: BookSummary[] = [];

  $: filtered = allBooks.filter((b) => {
    const matchFormat = $formatFilter === 'all' || b.format === $formatFilter;
    const q = $searchQuery.toLowerCase();
    const matchSearch =
      !q || b.title.toLowerCase().includes(q) || b.authors.some((a) => a.toLowerCase().includes(q));
    return matchFormat && matchSearch;
  });

  onMount(async () => {
    loading.set(true);
    try {
      const [booksData, libsData] = await Promise.all([listBooks({ limit: 200 }), listLibraries()]);
      allBooks = booksData;
      books.set(booksData);
      libraries.set(libsData);
    } catch (e) {
      console.error(e);
    } finally {
      loading.set(false);
    }
  });

  async function handleLogout() {
    await logout();
    accessToken.set(null);
    goto('/login');
  }
</script>

<svelte:head><title>내 라이브러리 — MyLibrary</title></svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <header class="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
      <h1 class="text-lg font-bold text-gray-900">📚 MyLibrary</h1>
      <button on:click={handleLogout} class="text-sm text-gray-500 hover:text-red-600">로그아웃</button>
    </div>
  </header>

  <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
    <!-- Search & Filter -->
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        type="search"
        placeholder="제목 또는 저자 검색..."
        bind:value={$searchQuery}
        class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none sm:max-w-xs"
      />
      <div class="flex gap-2">
        {#each FORMATS as fmt}
          <button
            on:click={() => formatFilter.set(fmt)}
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
