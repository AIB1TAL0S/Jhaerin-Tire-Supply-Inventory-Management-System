import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { fail } from '@sveltejs/kit';
import { settingsSchema, deliveryProviderSchema } from '$lib/schemas/settings.schema';
import { getDb } from '$lib/db/index';
import type { Actions, PageServerLoad } from './$types';

async function getSettings() {
	const db = await getDb();
	const rows = await db.query<{ key: string; value: string }>('SELECT key, value FROM settings');
	const map: Record<string, string> = {};
	for (const r of rows) map[r.key] = r.value;
	return map;
}

async function getProviders() {
	const db = await getDb();
	return db.query<{ id: string; name: string; created_at: string; updated_at: string }>(
		'SELECT * FROM delivery_providers ORDER BY name ASC'
	);
}

export const load: PageServerLoad = async () => {
	const [settings, providers, settingsForm, providerForm] = await Promise.all([
		getSettings(),
		getProviders(),
		superValidate(zod(settingsSchema)),
		superValidate(zod(deliveryProviderSchema))
	]);

	// Pre-fill settings form with current values
	const prefilled = await superValidate(
		{
			globalLowStockThreshold: settings.globalLowStockThreshold ? parseInt(settings.globalLowStockThreshold) : 5,
			deadStockWindowDays: settings.deadStockWindowDays ? parseInt(settings.deadStockWindowDays) : 30,
			theme: (settings.theme as 'light' | 'dark') ?? 'dark',
			dateFormat: settings.dateFormat ?? 'YYYY-MM-DD',
			defaultDateRange: (settings.defaultDateRange as 'day' | 'week' | 'month') ?? 'month',
			powersyncEndpoint: settings.powersyncEndpoint,
			powersyncToken: settings.powersyncToken
		},
		zod(settingsSchema)
	);

	return { settings, providers, settingsForm: prefilled, providerForm };
};

export const actions: Actions = {
	saveSettings: async ({ request }) => {
		const form = await superValidate(request, zod(settingsSchema));
		if (!form.valid) return fail(400, { form });

		const db = await getDb();
		const now = new Date().toISOString();
		const entries = Object.entries(form.data).filter(([, v]) => v !== undefined && v !== null);

		for (const [key, value] of entries) {
			await db.execute(
				'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
				[key, String(value), now]
			);
		}

		return { form, success: true };
	},

	createProvider: async ({ request }) => {
		const form = await superValidate(request, zod(deliveryProviderSchema));
		if (!form.valid) return fail(400, { form });

		const db = await getDb();
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		try {
			await db.execute(
				'INSERT INTO delivery_providers (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
				[id, form.data.name, now, now]
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('UNIQUE constraint failed')) {
				return fail(409, { form: { ...form, errors: { ...form.errors, name: ['A provider with this name already exists.'] } } });
			}
			throw err;
		}

		const freshForm = await superValidate(zod(deliveryProviderSchema));
		return { form: freshForm, success: true };
	},

	deleteProvider: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		if (!id) return fail(400, { error: 'Missing provider ID' });

		const db = await getDb();
		await db.execute('DELETE FROM delivery_providers WHERE id = ?', [id]);
		return { success: true };
	}
};
