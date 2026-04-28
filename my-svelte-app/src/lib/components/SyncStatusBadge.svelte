<script lang="ts">
	import { syncStateStore } from '$lib/stores/sync-state.store';

	const colorMap = {
		online: 'bg-green-500',
		offline: 'bg-red-500',
		syncing: 'bg-amber-400'
	};

	const labelMap = {
		online: 'Online',
		offline: 'Offline',
		syncing: 'Syncing…'
	};
</script>

<div class="relative inline-flex items-center gap-1.5 group" title={labelMap[$syncStateStore]}>
	<span
		class="h-2.5 w-2.5 rounded-full {colorMap[$syncStateStore]} {$syncStateStore === 'syncing'
			? 'animate-pulse'
			: ''}"
	></span>
	<span class="text-xs text-muted-foreground hidden sm:inline">{labelMap[$syncStateStore]}</span>

	<!-- Tooltip -->
	<span
		class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow
		       opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
	>
		{labelMap[$syncStateStore]}
	</span>
</div>
