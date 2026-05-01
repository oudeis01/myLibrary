import { writable } from 'svelte/store';
import type { BookSummary, Library } from '$lib/api/books';

export const books = writable<BookSummary[]>([]);
export const libraries = writable<Library[]>([]);
export const loading = writable(false);
export const searchQuery = writable('');
export const formatFilter = writable<'all' | 'pdf' | 'epub' | 'cbz'>('all');
