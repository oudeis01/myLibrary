<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentUser } from '$lib/stores/auth';
  import { getUsers, createUser, updateUser, deleteUser } from '$lib/api/users';
  import type { User } from '$lib/api/users';

  let users: User[] = [];
  let loading = true;
  let error = '';

  // Create user form
  let showCreate = false;
  let newUsername = '';
  let newPassword = '';
  let newRole = 'member';
  let creating = false;

  // Inline role edit
  let editingId = '';
  let editingRole = '';

  onMount(async () => {
    if ($currentUser && $currentUser.role !== 'admin') {
      goto('/library');
      return;
    }
    await loadUsers();
  });

  async function loadUsers() {
    try {
      users = await getUsers();
    } catch {
      error = '유저 목록을 불러오지 못했습니다.';
    } finally {
      loading = false;
    }
  }

  async function handleCreate() {
    if (!newUsername || !newPassword) return;
    creating = true;
    error = '';
    try {
      await createUser(newUsername, newPassword, newRole);
      newUsername = '';
      newPassword = '';
      newRole = 'member';
      showCreate = false;
      await loadUsers();
    } catch {
      error = '유저 생성에 실패했습니다. 이미 존재하는 아이디일 수 있습니다.';
    } finally {
      creating = false;
    }
  }

  async function saveRole(id: string) {
    error = '';
    try {
      await updateUser(id, { role: editingRole });
      editingId = '';
      await loadUsers();
    } catch {
      error = '역할 변경에 실패했습니다.';
    }
  }

  async function handleDelete(id: string, username: string) {
    if (!confirm(`"${username}" 유저를 삭제하시겠습니까?`)) return;
    error = '';
    try {
      await deleteUser(id);
      await loadUsers();
    } catch {
      error = '유저 삭제에 실패했습니다.';
    }
  }

  function roleBadge(role: string) {
    if (role === 'admin') return 'bg-indigo-100 text-indigo-700';
    if (role === 'guest') return 'bg-gray-100 text-gray-600';
    return 'bg-green-100 text-green-700';
  }
</script>

<svelte:head><title>유저 관리 — MyLibrary</title></svelte:head>

<main class="mx-auto max-w-3xl px-4 py-8">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <a href="/admin" class="text-sm text-gray-400 hover:text-gray-600">← 대시보드</a>
      <h1 class="mt-1 text-2xl font-bold text-gray-900">유저 관리</h1>
    </div>
    <button
      on:click={() => (showCreate = !showCreate)}
      class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
    >
      + 유저 추가
    </button>
  </div>

  {#if error}
    <p class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
  {/if}

  {#if showCreate}
    <div class="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
      <h2 class="mb-4 font-semibold text-gray-800">새 유저 생성</h2>
      <div class="flex flex-col gap-3">
        <input
          bind:value={newUsername}
          placeholder="아이디"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <input
          bind:value={newPassword}
          type="password"
          placeholder="비밀번호"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <select
          bind:value={newRole}
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="member">member</option>
          <option value="admin">admin</option>
          <option value="guest">guest</option>
        </select>
        <div class="flex gap-2">
          <button
            on:click={handleCreate}
            disabled={creating}
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? '생성 중...' : '생성'}
          </button>
          <button
            on:click={() => (showCreate = false)}
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <p class="text-gray-500">불러오는 중...</p>
  {:else}
    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table class="w-full text-sm">
        <thead class="border-b border-gray-200 bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-gray-600">아이디</th>
            <th class="px-4 py-3 text-left font-medium text-gray-600">역할</th>
            <th class="px-4 py-3 text-left font-medium text-gray-600">가입일</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each users as user}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 font-medium text-gray-900">{user.username}</td>
              <td class="px-4 py-3">
                {#if editingId === user.id}
                  <div class="flex items-center gap-2">
                    <select
                      bind:value={editingRole}
                      class="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none"
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                      <option value="guest">guest</option>
                    </select>
                    <button
                      on:click={() => saveRole(user.id)}
                      class="text-xs text-indigo-600 hover:underline"
                    >저장</button>
                    <button
                      on:click={() => (editingId = '')}
                      class="text-xs text-gray-400 hover:underline"
                    >취소</button>
                  </div>
                {:else}
                  <button
                    on:click={() => { editingId = user.id; editingRole = user.role; }}
                    class="inline-flex items-center gap-1"
                  >
                    <span class="rounded px-2 py-0.5 text-xs font-medium {roleBadge(user.role)}">{user.role}</span>
                    <span class="text-xs text-gray-300 hover:text-gray-500">✎</span>
                  </button>
                {/if}
              </td>
              <td class="px-4 py-3 text-gray-500">
                {new Date(user.created_at).toLocaleDateString('ko-KR')}
              </td>
              <td class="px-4 py-3 text-right">
                {#if user.id !== $currentUser?.id}
                  <button
                    on:click={() => handleDelete(user.id, user.username)}
                    class="text-red-400 hover:text-red-600"
                  >삭제</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</main>
