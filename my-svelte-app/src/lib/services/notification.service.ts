import { getDb } from '$lib/db/index.js';
import { notificationsStore } from '$lib/stores/notifications.store.js';
import type { Notification, NotificationType } from '$lib/types/index.js';

function isTauri(): boolean {
	return typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__TAURI__ !== undefined;
}

async function sendNativeNotification(title: string, body: string): Promise<void> {
	try {
		const { sendNotification } = await import('@tauri-apps/plugin-notification');
		await sendNotification({ title, body });
	} catch {
		// best-effort
	}
}

function rowToNotification(row: Record<string, unknown>): Notification {
	return {
		id: row.id as string,
		type: row.type as NotificationType,
		message: row.message as string,
		status: row.status as Notification['status'],
		payload: row.payload ? JSON.parse(row.payload as string) : null,
		createdAt: row.created_at as string,
	};
}

export const notificationService = {
	async createNotification(
		type: NotificationType,
		message: string,
		payload?: Record<string, unknown>
	): Promise<Notification> {
		const db = await getDb();
		const id = crypto.randomUUID();
		const createdAt = new Date().toISOString();
		const payloadJson = payload ? JSON.stringify(payload) : null;

		await db.execute(
			`INSERT INTO notifications (id, type, message, status, payload, created_at) VALUES (?, ?, ?, 'unread', ?, ?)`,
			[id, type, message, payloadJson, createdAt]
		);

		const notification: Notification = { id, type, message, status: 'unread', payload: payload ?? null, createdAt };
		notificationsStore.update((list) => [notification, ...list]);
		return notification;
	},

	async listNotifications(): Promise<Notification[]> {
		const db = await getDb();
		const rows = await db.query<Record<string, unknown>>(
			`SELECT * FROM notifications WHERE status != 'dismissed' ORDER BY created_at DESC`
		);
		return rows.map(rowToNotification);
	},

	async markRead(id: string): Promise<void> {
		const db = await getDb();
		await db.execute(`UPDATE notifications SET status = 'read' WHERE id = ?`, [id]);
		notificationsStore.update((list) => list.map((n) => (n.id === id ? { ...n, status: 'read' as const } : n)));
	},

	async dismiss(id: string): Promise<void> {
		const db = await getDb();
		await db.execute(`UPDATE notifications SET status = 'dismissed' WHERE id = ?`, [id]);
		notificationsStore.update((list) => list.filter((n) => n.id !== id));
	},

	async checkLowStock(globalThreshold = 5): Promise<void> {
		const db = await getDb();
		const rows = await db.query<Record<string, unknown>>(
			`SELECT * FROM tire_products WHERE is_archived = 0 AND quantity <= COALESCE(low_stock_threshold, ?)`,
			[globalThreshold]
		);

		for (const row of rows) {
			const { id: productId, brand, size, pattern, quantity } = row as Record<string, string | number>;
			const message = `Low stock: ${brand} ${size} ${pattern} has ${quantity} units remaining`;
			const notification = await this.createNotification('low_stock', message, { productId, brand, size, pattern, quantity });
			if (isTauri()) await sendNativeNotification('Low Stock Alert', notification.message);
		}
	},

	async checkDeadStock(windowDays = 30): Promise<void> {
		const db = await getDb();
		const cutoff = new Date(Date.now() - windowDays * 86400000).toISOString();

		const rows = await db.query<Record<string, unknown>>(
			`SELECT tp.* FROM tire_products tp
       WHERE tp.is_archived = 0
         AND NOT EXISTS (SELECT 1 FROM stock_out_transactions sot WHERE sot.tire_product_id = tp.id AND sot.transaction_date >= ?)
         AND NOT EXISTS (SELECT 1 FROM sales_transactions st WHERE st.tire_product_id = tp.id AND st.transaction_date >= ?)`,
			[cutoff, cutoff]
		);

		for (const row of rows) {
			const { id: productId, brand, size, pattern } = row as Record<string, string>;
			const message = `Dead stock: ${brand} ${size} ${pattern} has had no movement in ${windowDays} days`;
			const notification = await this.createNotification('dead_stock', message, { productId, brand, size, pattern, windowDays });
			if (isTauri()) await sendNativeNotification('Dead Stock Alert', notification.message);
		}
	},
};
