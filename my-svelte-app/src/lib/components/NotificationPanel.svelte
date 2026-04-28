<script lang="ts">
	import { notificationsStore } from '$lib/stores/notifications.store';

	interface Props {
		open: boolean;
		onclose?: () => void;
	}

	let { open, onclose }: Props = $props();

	const typeLabel: Record<string, string> = {
		low_stock: 'Low Stock',
		dead_stock: 'Dead Stock',
		sync_status: 'Sync',
		report_ready: 'Report Ready'
	};

	const statusClass: Record<string, string> = {
		unread: 'font-semibold',
		read: 'opacity-70',
		dismissed: 'opacity-40 line-through'
	};
</script>

{#if open}
	<!-- Backdrop -->
	<button
		class="fixed inset-0 z-40 bg-black/40"
		aria-label="Close notification panel"
		onclick={onclose}
	></button>

	<!-- Slide-over panel -->
	<aside
		class="fixed right-0 top-0 z-50 flex h-full w-80 flex-col bg-background shadow-xl border-l border-border"
		aria-label="Notifications"
	>
		<header class="flex items-center justify-between border-b border-border px-4 py-3">
			<h2 class="text-sm font-semibold">Notifications</h2>
			<button
				class="rounded p-1 hover:bg-muted transition-colors"
				aria-label="Close"
				onclick={onclose}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</header>

		<ul class="flex-1 overflow-y-auto divide-y divide-border">
			{#if $notificationsStore.length === 0}
				<li class="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</li>
			{:else}
				{#each $notificationsStore as notification (notification.id)}
					<li class="px-4 py-3 {statusClass[notification.status]}">
						<div class="flex items-start gap-2">
							<span
								class="mt-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary uppercase tracking-wide"
							>
								{typeLabel[notification.type] ?? notification.type}
							</span>
							<p class="flex-1 text-sm">{notification.message}</p>
						</div>
						<time class="mt-1 block text-[11px] text-muted-foreground">
							{new Date(notification.createdAt).toLocaleString()}
						</time>
					</li>
				{/each}
			{/if}
		</ul>
	</aside>
{/if}
