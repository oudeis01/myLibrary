<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentUser } from '$lib/stores/auth';
  import { getUsers } from '$lib/api/users';
  import { api } from '$lib/api/client';
  import type { User } from '$lib/api/users';

  interface Library { id: string; name: string; }

  let users: User[] = [];
  let libraries: Library[] = [];
  let loading = true;

  onMount(async () => {
    if ($currentUser && $currentUser.role !== 'admin') {
      goto('/library');
      return;
    }
    try {
      const [u, l] = await Promise.all([
        getUsers(),
        api.get('libraries').json<Library[]>().catch(() => [] as Library[]),
      ]);
      users = u;
      libraries = l;
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head><title>관리 대시보드 — MyLibrary</title></svelte:head>

<main class="mx-auto max-w-4xl px-4 py-8">
  <h1 class="mb-6 text-2xl font-bold text-gray-900">관리 대시보드</h1>

  {#if loading}
    <p class="text-gray-500">불러오는 중...</p>
  {:else}
    <div class="mb-8 grid grid-cols-2 gap-4">
      <div class="rounded-xl border border-gray-200 bg-white p-6">
        <p class="text-3xl font-bold text-indigo-600">{users.length}</p>
        <p class="mt-1 text-sm text-gray-600">전체 유저</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-6">
        <p class="text-3xl font-bold text-indigo-600">{libraries.length}</p>
        <p class="mt-1 text-sm text-gray-600">라이브러리</p>
      </div>
    </div>

    <div class="flex flex-col gap-4">
      <a
        href="/admin/users"
        class="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-4 hover:border-indigo-300 hover:shadow-sm"
      >
        <div>
          <p class="font-semibold text-gray-900">유저 관리</p>
          <p class="text-sm text-gray-500">유저 생성 · 역할 변경 · 삭제</p>
        </div>
        <span class="text-gray-400">→</span>
      </a>

      {#each libraries as lib}
        <a
          href="/admin/libraries/{lib.id}"
          class="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-4 hover:border-indigo-300 hover:shadow-sm"
        >
          <div>
            <p class="font-semibold text-gray-900">{lib.name}</p>
            <p class="text-sm text-gray-500">라이브러리 접근 권한 관리</p>
          </div>
          <span class="text-gray-400">→</span>
        </a>
      {/each}
    </div>
  {/if}
</main>
