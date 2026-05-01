<script lang="ts">
  import '../app.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { isAuthenticated, accessToken } from '$lib/stores/auth';
  import { onMount } from 'svelte';

  const PUBLIC_ROUTES = ['/login'];

  onMount(() => {
    if (!$isAuthenticated && !PUBLIC_ROUTES.includes($page.url.pathname)) {
      goto('/login');
    }
  });

  $: if (typeof window !== 'undefined' && !$isAuthenticated && !PUBLIC_ROUTES.includes($page.url.pathname)) {
    goto('/login');
  }
</script>

<slot />
