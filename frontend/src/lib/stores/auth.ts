import { writable, derived } from 'svelte/store';
import { getAccessToken, setAccessToken } from '$lib/api/client';

export const accessToken = writable<string | null>(null);
export const isAuthenticated = derived(accessToken, ($t) => $t !== null);

// Keep store and client in sync
accessToken.subscribe((t) => setAccessToken(t));
