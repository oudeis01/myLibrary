<script lang="ts">
  import '../app.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { accessToken, isAuthenticated, currentUser } from '$lib/stores/auth';
  import { isOffline, initOfflineStore } from '$lib/stores/offline';
  import { refresh, logout } from '$lib/api/auth';
  import { getMe } from '$lib/api/users';
  import { onMount } from 'svelte';
  import '$lib/offline/sync';

  const PUBLIC_ROUTES = ['/login'];

  onMount(async () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }

    if (!$isAuthenticated && !PUBLIC_ROUTES.includes($page.url.pathname)) {
      // Try silent refresh via httpOnly cookie before redirecting to login
      const token = await refresh();
      if (!token) {
        goto('/login');
        return;
      }
      accessToken.set(token);
    }

    if ($isAuthenticated) {
      // Run independently — IndexedDB read and /users/me network call are unrelated
      const [, meResult] = await Promise.allSettled([initOfflineStore(), getMe()]);
      if (meResult.status === 'fulfilled') currentUser.set(meResult.value);
    }
  });

  $: if (!$isAuthenticated && !PUBLIC_ROUTES.includes($page.url.pathname)) {
    goto('/login');
  }

  async function handleLogout() {
    await logout();
    accessToken.set(null);
    goto('/login');
  }
</script>

{#if $isOffline}
  <div class="flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-xs font-medium text-amber-900">
    <span>⚡</span>
    <span>오프라인 모드 — 저장된 책만 읽을 수 있습니다</span>
  </div>
{/if}

{#if $isAuthenticated && $currentUser}
  <div class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 text-sm">
    <nav class="flex items-center gap-4">
      <a href="/library" class="font-semibold text-indigo-600 hover:text-indigo-800">MyLibrary</a>
      <a href="/offline" class="text-gray-500 hover:text-gray-700">오프라인</a>
      {#if $currentUser.role === 'admin'}
        <a href="/admin" class="text-gray-500 hover:text-gray-700">관리</a>
      {/if}
    </nav>
    <div class="flex items-center gap-3 text-gray-500">
      <span>{$currentUser.username}
        {#if $currentUser.role === 'admin'}<span class="ml-1 rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700">admin</span>{/if}
      </span>
      <button on:click={handleLogout} class="hover:text-gray-900">로그아웃</button>
    </div>
  </div>
{/if}

<slot />
