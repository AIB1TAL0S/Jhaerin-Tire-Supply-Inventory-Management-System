import { writable } from 'svelte/store';
import type { Notification } from '$lib/types';

/** Holds all active (non-dismissed) notifications. */
export const notificationsStore = writable<Notification[]>([]);

/**
 * Load (or refresh) notifications from the DB into the store.
 * Import notificationService lazily to avoid circular dependency.
 */
export async function loadNotifications(): Promise<void> {
	const { notificationService } = await import('$lib/services/notification.service.js');
	const notifications = await notificationService.listNotifications();
	notificationsStore.set(notifications);
}
