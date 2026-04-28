<script lang="ts">
	interface Props {
		title: string;
		value: string | number;
		subtitle?: string;
	}
	let { title, value, subtitle }: Props = $props();
</script>

<div class="metric-card">
	<p class="metric-title">{title}</p>
	<p class="metric-value">{value}</p>
	{#if subtitle}<p class="metric-subtitle">{subtitle}</p>{/if}
</div>

<style>
	.metric-card { background: var(--card, #fff); border: 1px solid var(--border, #ccc); border-radius: 8px; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.25rem; }
	.metric-title { font-size: 0.8rem; font-weight: 500; color: var(--muted-foreground, #6b7280); text-transform: uppercase; letter-spacing: 0.05em; }
	.metric-value { font-size: 2rem; font-weight: 700; color: var(--foreground, #000); line-height: 1.1; }
	.metric-subtitle { font-size: 0.8rem; color: var(--muted-foreground, #6b7280); }
</style>
