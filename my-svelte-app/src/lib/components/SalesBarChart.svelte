<script lang="ts">
	interface DataPoint { label: string; value: number; }
	interface Props { data: DataPoint[]; title?: string; }
	let { data, title = 'Sales Volume' }: Props = $props();

	const WIDTH = 600; const HEIGHT = 220;
	const PAD = { top: 20, right: 20, bottom: 50, left: 60 };
	const chartW = $derived(WIDTH - PAD.left - PAD.right);
	const chartH = $derived(HEIGHT - PAD.top - PAD.bottom);
	const maxVal = $derived(data.length > 0 ? Math.max(...data.map((d) => d.value), 1) : 1);
	const barW = $derived(data.length > 0 ? Math.max(4, (chartW / data.length) * 0.7) : 20);
	const step = $derived(data.length > 0 ? chartW / data.length : 1);
	function barX(i: number) { return PAD.left + i * step + (step - barW) / 2; }
	function barH(v: number) { return (v / maxVal) * chartH; }
	function barY(v: number) { return PAD.top + chartH - barH(v); }
	const yTicks = $derived([0, 0.25, 0.5, 0.75, 1].map((t) => ({ y: PAD.top + chartH - t * chartH, label: Math.round(maxVal * t).toString() })));
</script>

<div class="chart-wrap">
	{#if title}<p class="chart-title">{title}</p>{/if}
	{#if data.length === 0}
		<p class="empty">No data available.</p>
	{:else}
		<svg viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label={title} class="chart-svg">
			{#each yTicks as tick}
				<line x1={PAD.left} y1={tick.y} x2={PAD.left + chartW} y2={tick.y} stroke="var(--border, #e5e7eb)" stroke-width="1" />
				<text x={PAD.left - 6} y={tick.y + 4} text-anchor="end" font-size="11" fill="var(--muted-foreground, #6b7280)">{tick.label}</text>
			{/each}
			{#each data as d, i}
				<rect x={barX(i)} y={barY(d.value)} width={barW} height={barH(d.value)} fill="var(--primary, #dc2626)" rx="2">
					<title>{d.label}: {d.value}</title>
				</rect>
				<text x={barX(i) + barW / 2} y={PAD.top + chartH + 16} text-anchor="middle" font-size="10" fill="var(--muted-foreground, #6b7280)">{d.label.length > 8 ? d.label.slice(0, 7) + '…' : d.label}</text>
			{/each}
			<line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke="var(--border, #ccc)" stroke-width="1" />
			<line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH} stroke="var(--border, #ccc)" stroke-width="1" />
		</svg>
	{/if}
</div>

<style>
	.chart-wrap { display: flex; flex-direction: column; gap: 0.5rem; }
	.chart-title { font-size: 0.85rem; font-weight: 600; }
	.chart-svg { width: 100%; height: auto; }
	.empty { font-size: 0.85rem; color: var(--muted-foreground, #6b7280); }
</style>
