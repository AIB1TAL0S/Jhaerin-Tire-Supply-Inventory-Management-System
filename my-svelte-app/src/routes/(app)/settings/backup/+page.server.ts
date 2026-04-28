import { fail } from '@sveltejs/kit';
import { dataService } from '$lib/services/data.service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	let backups: Awaited<ReturnType<typeof dataService.listBackups>> = [];
	try {
		backups = await dataService.listBackups();
	} catch {
		// Supabase Storage may not be configured yet
	}
	return { backups };
};

export const actions: Actions = {
	backup: async () => {
		try {
			const url = await dataService.triggerBackup();
			return { success: true, url };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Backup failed.';
			return fail(500, { error: message });
		}
	},

	restore: async ({ request }) => {
		const data = await request.formData();
		const url = data.get('url') as string;
		if (!url) return fail(400, { error: 'Missing backup URL.' });

		try {
			await dataService.restoreBackup(url);
			return { success: true };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Restore failed.';
			return fail(422, { error: message });
		}
	}
};
