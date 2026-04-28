import { writable } from 'svelte/store';
import type { SyncState } from '$lib/types';

/** Reflects the current PowerSync / network sync state. Starts offline until a sync session connects. */
export const syncStateStore = writable<SyncState>('offline');
