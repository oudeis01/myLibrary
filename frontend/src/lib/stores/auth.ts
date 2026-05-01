import { writable, derived } from 'svelte/store';
import { setAccessToken, setTokenChangeCallback } from '$lib/api/client';

export interface CurrentUser {
  id: string;
  username: string;
  role: string;
}

export const accessToken = writable<string | null>(null);
export const isAuthenticated = derived(accessToken, ($t) => $t !== null);
export const currentUser = writable<CurrentUser | null>(null);

// Store → client: keep ky in sync and clear currentUser on logout
accessToken.subscribe((t) => {
  setAccessToken(t);
  if (!t) currentUser.set(null);
});

// Client → store: propagate token changes from tryRefresh (401 auto-recovery)
setTokenChangeCallback((t) => accessToken.set(t));
