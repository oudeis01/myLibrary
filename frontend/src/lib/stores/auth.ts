import { writable, derived } from 'svelte/store';
import { getAccessToken, setAccessToken } from '$lib/api/client';

export interface CurrentUser {
  id: string;
  username: string;
  role: string;
}

export const accessToken = writable<string | null>(null);
export const isAuthenticated = derived(accessToken, ($t) => $t !== null);
export const currentUser = writable<CurrentUser | null>(null);

// Keep ky client in sync; clear currentUser on logout
accessToken.subscribe((t) => {
  setAccessToken(t);
  if (!t) currentUser.set(null);
});
