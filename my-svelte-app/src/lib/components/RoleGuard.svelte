<script lang="ts">
	import { roleStore } from '$lib/stores/session.store';
	import type { Role } from '$lib/types';
	import type { Snippet } from 'svelte';

	interface Props {
		role: Role | Role[];
		children: Snippet;
	}

	let { role, children }: Props = $props();

	const allowed = $derived(() => {
		const current = $roleStore;
		if (!current) return false;
		return Array.isArray(role) ? role.includes(current) : current === role;
	});
</script>

{#if allowed()}
	{@render children()}
{/if}
