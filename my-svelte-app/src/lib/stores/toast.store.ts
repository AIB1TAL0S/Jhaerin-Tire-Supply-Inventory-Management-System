import { writable } from 'svelte/store';

export interface Toast {
	id: string;
	message: string;
	type: 'info' | 'error' | 'success';
}

export const toastStore = writable<Toast[]>([]);

export function showToast(message: string, type: Toast['type'] = 'info') {
	const id = crypto.randomUUID();
	toastStore.update((toasts) => [...toasts, { id, message, type }]);
	setTimeout(() => {
		toastStore.update((toasts) => toasts.filter((t) => t.id !== id));
	}, 4000);
}
