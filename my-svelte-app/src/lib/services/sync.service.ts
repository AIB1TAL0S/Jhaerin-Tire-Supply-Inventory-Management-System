import { syncStateStore } from '$lib/stores/sync-state.store.js';
import { notificationService } from '$lib/services/notification.service.js';

/**
 * PowerSync sync service.
 * Initialises the PowerSync client with the Supabase JWT and manages
 * connect / disconnect lifecycle. Updates syncStateStore reactively.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let psClient: any = null;

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

export const syncService = {
	async connect(accessToken: string): Promise<void> {
		if (!isBrowser()) return;

		try {
			syncStateStore.set('syncing');

			// Dynamically import PowerSync to keep it out of SSR bundle
			const { PowerSyncDatabase } = await import('@powersync/web');

			if (!psClient) {
				psClient = new PowerSyncDatabase({
					schema: {}, // schema registered via sync rules on the server
					database: { dbFilename: 'jts-ims-sync.db' }
				});
			}

			// Connect with the Supabase JWT
			await psClient.connect({
				fetchCredentials: async () => ({
					token: accessToken,
					expiresAt: new Date(Date.now() + 3600 * 1000)
				})
			});

			// Subscribe to status events
			psClient.status.onChange((status: { connected: boolean; downloading: boolean; uploading: boolean }) => {
				if (status.connected) {
					syncStateStore.set(status.downloading || status.uploading ? 'syncing' : 'online');
				} else {
					syncStateStore.set('offline');
				}
			});

			syncStateStore.set('online');
		} catch (err) {
			syncStateStore.set('offline');
			const message = err instanceof Error ? err.message : 'Sync connection failed';
			await notificationService.createNotification('sync_status', `Sync error: ${message}`);
		}
	},

	async disconnect(): Promise<void> {
		if (!psClient) return;
		try {
			await psClient.disconnect();
		} catch {
			// ignore disconnect errors
		} finally {
			syncStateStore.set('offline');
		}
	}
};
