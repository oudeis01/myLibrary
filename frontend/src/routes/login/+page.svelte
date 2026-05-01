<script lang="ts">
  import { goto } from '$app/navigation';
  import { login } from '$lib/api/auth';
  import { accessToken } from '$lib/stores/auth';

  let username = '';
  let password = '';
  let error = '';
  let loading = false;

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    loading = true;
    try {
      await login(username, password);
      // accessToken store is updated by client, trigger reactivity
      accessToken.update((t) => t);
      goto('/library');
    } catch {
      error = '아이디 또는 비밀번호가 올바르지 않습니다.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>로그인 — MyLibrary</title></svelte:head>

<main class="flex min-h-screen items-center justify-center bg-gray-50">
  <div class="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
    <h1 class="mb-6 text-center text-2xl font-bold text-gray-900">MyLibrary</h1>

    {#if error}
      <p class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
    {/if}

    <form on:submit={handleSubmit} class="space-y-4">
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700" for="username">아이디</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          required
          autocomplete="username"
          class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700" for="password">비밀번호</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          autocomplete="current-password"
          class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white
               hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500
               disabled:opacity-50"
      >
        {loading ? '로그인 중...' : '로그인'}
      </button>
    </form>
  </div>
</main>
