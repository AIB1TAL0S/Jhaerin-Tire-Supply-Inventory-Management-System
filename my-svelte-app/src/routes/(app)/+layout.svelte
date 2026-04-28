<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { sessionStore, shouldRedirectToLogin, roleStore } from '$lib/stores/session.store';
	import { toastStore, showToast } from '$lib/stores/toast.store';
	import { loadNotifications } from '$lib/stores/notifications.store';
	import { syncService } from '$lib/services/sync.service';
	import SyncStatusBadge from '$lib/components/SyncStatusBadge.svelte';
	import NotificationPanel from '$lib/components/NotificationPanel.svelte';
	import RoleGuard from '$lib/components/RoleGuard.svelte';

	let { children } = $props();

	// Load notifications on layout mount
	$effect(() => {
		loadNotifications();
	});

	// Connect PowerSync when session is available, disconnect on logout
	$effect(() => {
		const session = $sessionStore;
		if (session?.accessToken) {
			syncService.connect(session.accessToken);
		} else {
			syncService.disconnect();
		}
	});

	/** Routes only accessible to owners */
	const OWNER_ONLY_ROUTES = ['/users', '/register'];

	let notifOpen = $state(false);

	// Redirect unauthenticated users to /login
	$effect(() => {
		if ($shouldRedirectToLogin) {
			goto('/login');
		}
	});

	// Redirect staff away from owner-only routes
	$effect(() => {
		const path = $page.url.pathname;
		if ($roleStore === 'staff' && OWNER_ONLY_ROUTES.some((r) => path.startsWith(r))) {
			showToast('Access denied: this area is restricted to owners.', 'error');
			goto('/dashboard');
		}
	});

	const navLinks = [
		{ href: '/dashboard', label: 'Dashboard' },
		{ href: '/inventory', label: 'Inventory' },
		{ href: '/stock/in', label: 'Stock In' },
		{ href: '/stock/out', label: 'Stock Out' },
		{ href: '/sales', label: 'Sales' },
		{ href: '/analytics', label: 'Analytics' },
		{ href: '/settings', label: 'Settings' }
	];
</script>

<div class="flex min-h-screen bg-background text-foreground">
	<!-- Sidebar nav -->
	<nav
		class="flex w-56 flex-col border-r border-border bg-card"
		aria-label="Main navigation"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-border px-4 py-3">
			<span class="text-sm font-bold tracking-wide text-primary">JTS-IMS</span>
			<SyncStatusBadge />
		</div>

		<!-- Links -->
		<ul class="flex-1 overflow-y-auto py-2">
			{#each navLinks as link (link.href)}
				<li>
					<a
						href={link.href}
						class="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-muted
						       {$page.url.pathname.startsWith(link.href) ? 'bg-muted font-semibold text-primary' : 'text-foreground'}"
					>
						{link.label}
					</a>
				</li>
			{/each}

			<!-- Owner-only: Users -->
			<RoleGuard role="owner">
				<li>
					<a
						href="/users"
						class="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-muted
						       {$page.url.pathname.startsWith('/users') ? 'bg-muted font-semibold text-primary' : 'text-foreground'}"
					>
						Users
					</a>
				</li>
			</RoleGuard>
		</ul>

		<!-- Notification bell -->
		<div class="border-t border-border px-4 py-3">
			<button
				class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted transition-colors"
				onclick={() => (notifOpen = !notifOpen)}
				aria-label="Toggle notifications"
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
					<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
					<path d="M13.73 21a2 2 0 0 1-3.46 0" />
				</svg>
				Notifications
			</button>
		</div>
	</nav>

	<!-- Main content -->
	<main class="flex-1 overflow-y-auto p-6">
		{@render children()}
	</main>
</div>

<!-- Notification panel slide-over -->
<NotificationPanel open={notifOpen} onclose={() => (notifOpen = false)} />

<!-- Toast container -->
{#if $toastStore.length > 0}
	<div class="fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
		{#each $toastStore as toast (toast.id)}
			<div
				class="rounded-md px-4 py-2.5 text-sm shadow-lg
				       {toast.type === 'error'
					? 'bg-destructive text-destructive-foreground'
					: toast.type === 'success'
						? 'bg-green-600 text-white'
						: 'bg-popover text-popover-foreground border border-border'}"
			>
				{toast.message}
			</div>
		{/each}
	</div>
{/if}
