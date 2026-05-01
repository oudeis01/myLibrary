<script lang="ts">
  import '../app.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { isAuthenticated } from '$lib/stores/auth';
  import { isOffline, initOfflineStore } from '$lib/stores/offline';
  import { onMount } from 'svelte';
  import '$lib/offline/sync';

  const PUBLIC_ROUTES = ['/login'];

  onMount(async () => {
    // Service Worker 등록 (vite-plugin-pwa injectManifest 전략은 직접 등록 필요)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }

    if (!$isAuthenticated && !PUBLIC_ROUTES.includes($page.url.pathname)) {
      goto('/login');
      return;
    }
    if ($isAuthenticated) {
      await initOfflineStore();
    }
  });

  $: if (typeof window !== 'undefined' && !$isAuthenticated && !PUBLIC_ROUTES.includes($page.url.pathname)) {
    goto('/login');
  }
</script>

{#if $isOffline}
  <div class="flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-xs font-medium text-amber-900">
    <span>⚡</span>
    <span>오프라인 모드 — 저장된 책만 읽을 수 있습니다</span>
  </div>
{/if}

<slot />
