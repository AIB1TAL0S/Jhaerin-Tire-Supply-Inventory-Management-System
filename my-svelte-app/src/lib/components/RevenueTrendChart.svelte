<script lang="ts">
	interface DataPoint { period: string; revenue: number; grossProfit: number; }
	interface Props { data: DataPoint[]; title?: string; }
	let { data, title = 'Revenue vs Gross Profit' }: Props = $props();

	const WIDTH = 600; const HEIGHT = 220;
	const PAD = { top: 20, right: 20, bottom: 50, left: 70 };
	const chartW = $derived(WIDTH - PAD.left - PAD.right);
	const chartH = $derived(HEIGHT - PAD.top - PAD.bottom);
	const maxVal = $derived(data.length > 0 ? Math.max(...data.map((d) => Math.max(d.revenue, d.grossProfit)), 1) : 1);
	function xPos(i: number) { return PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2); }
	function yPos(v: number) { return PAD.top + chartH - (v / maxVal) * chartH; }
	const revPath = $derived(data.length === 0 ? '' : data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xPos(i)},${yPos(d.revenue)}`).join(' '));
	const profPath = $derived(data.length === 0 ? '' : data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xPos(i)},${yPos(d.grossProfit)}`).join(' '));
	const yTicks = $derived([0, 0.25, 0.5, 0.75, 1].map((t) => ({ y: PAD.top + chartH - t * chartH, label: Math.round(maxVal * t).toLocaleString() })));
	const labelStep = $derived(data.length > 10 ? Math.ceil(data.length / 8) : 1);
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
			{#if revPath}<path d={revPath} fill="none" stroke="var(--primary, #dc2626)" stroke-width="2" />{/if}
			{#if profPath}<path d={profPath} fill="none" stroke="#16a34a" stroke-width="2" stroke-dasharray="4 2" />{/if}
			{#each data as d, i}
				<circle cx={xPos(i)} cy={yPos(d.revenue)} r="3" fill="var(--primary, #dc2626)"><title>{d.period} — Revenue: {d.revenue.toLocaleString()}</title></circle>
				<circle cx={xPos(i)} cy={yPos(d.grossProfit)} r="3" fill="#16a34a"><title>{d.period} — Gross Profit: {d.grossProfit.toLocaleString()}</title></circle>
				{#if i % labelStep === 0}
					<text x={xPos(i)} y={PAD.top + chartH + 16} text-anchor="middle" font-size="10" fill="var(--muted-foreground, #6b7280)">{d.period.length > 8 ? d.period.slice(0, 7) + '…' : d.period}</text>
				{/if}
			{/each}
			<line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke="var(--border, #ccc)" stroke-width="1" />
			<line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH} stroke="var(--border, #ccc)" stroke-width="1" />
		</svg>
		<div class="legend">
			<span class="rev">— Revenue</span>
			<span class="prof">- - Gross Profit</span>
		</div>
	{/if}
</div>

<style>
	.chart-wrap { display: flex; flex-direction: column; gap: 0.5rem; }
	.chart-title { font-size: 0.85rem; font-weight: 600; }
	.chart-svg { width: 100%; height: auto; }
	.empty { font-size: 0.85rem; color: var(--muted-foreground, #6b7280); }
	.legend { display: flex; gap: 1rem; font-size: 0.75rem; }
	.rev { color: var(--primary, #dc2626); }
	.prof { color: #16a34a; }
</style>
