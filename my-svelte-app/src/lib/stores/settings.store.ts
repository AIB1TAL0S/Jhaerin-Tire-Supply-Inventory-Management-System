import { writable, get } from 'svelte/store';

export const settingsStore = writable<Record<string, string>>({});

export async function loadSettings(): Promise<void> {
	const { getDb } = await import('$lib/db/index.js');
	const db = await getDb();
	const rows = await db.query<{ key: string; value: string }>('SELECT key, value FROM settings');
	const map: Record<string, string> = {};
	for (const row of rows) map[row.key] = row.value;
	settingsStore.set(map);
}

export function getGlobalLowStockThreshold(): number {
	const v = get(settingsStore)['globalLowStockThreshold'];
	return v ? parseInt(v, 10) : 5;
}

export function getDeadStockWindowDays(): number {
	const v = get(settingsStore)['deadStockWindowDays'];
	return v ? parseInt(v, 10) : 30;
}
