<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentUser } from '$lib/stores/auth';

  onMount(() => {
    if ($currentUser && $currentUser.role !== 'admin') {
      goto('/library');
    }
  });
</script>

<slot />
