<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { currentUser } from '$lib/stores/auth';
  import { api } from '$lib/api/client';
  import {
    getUsers,
    getLibraryMembers,
    addLibraryMember,
    updateLibraryMember,
    removeLibraryMember,
  } from '$lib/api/users';
  import type { User, LibraryMember } from '$lib/api/users';

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const libraryId = $page.params.id!;

  let libraryName = '';
  let members: LibraryMember[] = [];
  let allUsers: User[] = [];
  let loading = true;
  let error = '';

  // Add member form
  let selectedUserId = '';
  let addCanRead = true;
  let addCanUpload = false;
  let adding = false;

  onMount(async () => {
    if ($currentUser && $currentUser.role !== 'admin') {
      goto('/library');
      return;
    }
    await Promise.all([loadMembers(), loadAllUsers(), loadLibraryName()]);
  });

  async function loadLibraryName() {
    try {
      const lib = await api.get(`libraries/${libraryId}`).json<{ name: string }>();
      libraryName = lib.name;
    } catch {}
  }

  async function loadMembers() {
    try {
      members = await getLibraryMembers(libraryId);
    } catch {
      error = '멤버 목록을 불러오지 못했습니다.';
    } finally {
      loading = false;
    }
  }

  async function loadAllUsers() {
    try {
      allUsers = await getUsers();
    } catch {}
  }

  $: nonMembers = allUsers.filter((u) => !members.some((m) => m.user_id === u.id));

  async function handleAdd() {
    if (!selectedUserId) return;
    adding = true;
    error = '';
    try {
      await addLibraryMember(libraryId, selectedUserId, addCanRead, addCanUpload);
      selectedUserId = '';
      addCanRead = true;
      addCanUpload = false;
      await loadMembers();
    } catch {
      error = '멤버 추가에 실패했습니다.';
    } finally {
      adding = false;
    }
  }

  async function handleToggle(member: LibraryMember, field: 'can_read' | 'can_upload') {
    error = '';
    try {
      const updated = await updateLibraryMember(libraryId, member.user_id, {
        can_read: field === 'can_read' ? !member.can_read : member.can_read,
        can_upload: field === 'can_upload' ? !member.can_upload : member.can_upload,
      });
      members = members.map((m) => (m.user_id === member.user_id ? updated : m));
    } catch {
      error = '권한 변경에 실패했습니다.';
    }
  }

  async function handleRemove(member: LibraryMember) {
    if (!confirm(`"${member.username}"의 접근 권한을 제거하시겠습니까?`)) return;
    error = '';
    try {
      await removeLibraryMember(libraryId, member.user_id);
      members = members.filter((m) => m.user_id !== member.user_id);
    } catch {
      error = '멤버 제거에 실패했습니다.';
    }
  }
</script>

<svelte:head><title>{libraryName || '라이브러리'} 권한 관리 — MyLibrary</title></svelte:head>

<main class="mx-auto max-w-3xl px-4 py-8">
  <div class="mb-6">
    <a href="/admin" class="text-sm text-gray-400 hover:text-gray-600">← 대시보드</a>
    <h1 class="mt-1 text-2xl font-bold text-gray-900">
      {libraryName || '라이브러리'} — 접근 권한
    </h1>
    <p class="mt-1 text-sm text-gray-500">Admin은 항상 전체 접근 가능합니다.</p>
  </div>

  {#if error}
    <p class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
  {/if}

  <!-- Add member -->
  <div class="mb-6 rounded-xl border border-gray-200 bg-white p-5">
    <h2 class="mb-3 font-semibold text-gray-800">멤버 추가</h2>
    {#if nonMembers.length === 0}
      <p class="text-sm text-gray-400">추가할 수 있는 유저가 없습니다.</p>
    {:else}
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1">
          <label for="user-select" class="text-xs text-gray-500">유저</label>
          <select
            id="user-select"
            bind:value={selectedUserId}
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">선택...</option>
            {#each nonMembers as u}
              <option value={u.id}>{u.username} ({u.role})</option>
            {/each}
          </select>
        </div>
        <label class="flex cursor-pointer items-center gap-1.5 text-sm">
          <input type="checkbox" bind:checked={addCanRead} class="h-4 w-4 accent-indigo-600" />
          읽기
        </label>
        <label class="flex cursor-pointer items-center gap-1.5 text-sm">
          <input type="checkbox" bind:checked={addCanUpload} class="h-4 w-4 accent-indigo-600" />
          업로드
        </label>
        <button
          on:click={handleAdd}
          disabled={adding || !selectedUserId}
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {adding ? '추가 중...' : '추가'}
        </button>
      </div>
    {/if}
  </div>

  <!-- Member list -->
  {#if loading}
    <p class="text-gray-500">불러오는 중...</p>
  {:else if members.length === 0}
    <p class="text-center text-sm text-gray-400 py-8">접근 권한이 설정된 멤버가 없습니다.</p>
  {:else}
    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table class="w-full text-sm">
        <thead class="border-b border-gray-200 bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-gray-600">유저</th>
            <th class="px-4 py-3 text-center font-medium text-gray-600">읽기</th>
            <th class="px-4 py-3 text-center font-medium text-gray-600">업로드</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each members as member}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 font-medium text-gray-900">{member.username}</td>
              <td class="px-4 py-3 text-center">
                <button
                  on:click={() => handleToggle(member, 'can_read')}
                  class="text-lg {member.can_read ? 'text-green-500' : 'text-gray-300'}"
                  title="클릭하여 토글"
                >
                  {member.can_read ? '✓' : '○'}
                </button>
              </td>
              <td class="px-4 py-3 text-center">
                <button
                  on:click={() => handleToggle(member, 'can_upload')}
                  class="text-lg {member.can_upload ? 'text-green-500' : 'text-gray-300'}"
                  title="클릭하여 토글"
                >
                  {member.can_upload ? '✓' : '○'}
                </button>
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  on:click={() => handleRemove(member)}
                  class="text-red-400 hover:text-red-600"
                >제거</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</main>
