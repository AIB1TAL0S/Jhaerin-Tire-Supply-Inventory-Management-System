<script lang="ts">
	interface DataPoint { label: string; value: number; }
	interface Props { data: DataPoint[]; title?: string; }
	let { data, title = 'Sales by Brand' }: Props = $props();

	const COLORS = ['#dc2626','#2563eb','#16a34a','#d97706','#7c3aed','#db2777','#0891b2','#65a30d','#ea580c','#6366f1'];
	const CX = 110; const CY = 110; const R = 80; const IR = 45;
	const total = $derived(data.reduce((s, d) => s + d.value, 0));

	interface Slice { label: string; value: number; percent: number; startAngle: number; endAngle: number; color: string; }
	const slices = $derived<Slice[]>(() => {
		if (total === 0) return [];
		let angle = -Math.PI / 2;
		return data.map((d, i) => {
			const sweep = (d.value / total) * 2 * Math.PI;
			const start = angle; const end = angle + sweep; angle = end;
			return { label: d.label, value: d.value, percent: (d.value / total) * 100, startAngle: start, endAngle: end, color: COLORS[i % COLORS.length] };
		});
	})();

	function arcPath(s: Slice) {
		const x1 = CX + R * Math.cos(s.startAngle); const y1 = CY + R * Math.sin(s.startAngle);
		const x2 = CX + R * Math.cos(s.endAngle); const y2 = CY + R * Math.sin(s.endAngle);
		const ix1 = CX + IR * Math.cos(s.endAngle); const iy1 = CY + IR * Math.sin(s.endAngle);
		const ix2 = CX + IR * Math.cos(s.startAngle); const iy2 = CY + IR * Math.sin(s.startAngle);
		const large = s.endAngle - s.startAngle > Math.PI ? 1 : 0;
		return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${IR} ${IR} 0 ${large} 0 ${ix2} ${iy2} Z`;
	}
</script>

<div class="chart-wrap">
	{#if title}<p class="chart-title">{title}</p>{/if}
	{#if data.length === 0 || total === 0}
		<p class="empty">No data available.</p>
	{:else}
		<div class="chart-body">
			<svg viewBox="0 0 220 220" role="img" aria-label={title} class="chart-svg">
				{#each slices as s}
					<path d={arcPath(s)} fill={s.color} stroke="var(--background, #fff)" stroke-width="1.5">
						<title>{s.label}: {s.value} ({s.percent.toFixed(1)}%)</title>
					</path>
				{/each}
				<text x={CX} y={CY - 6} text-anchor="middle" font-size="12" font-weight="600" fill="var(--foreground, #000)">Total</text>
				<text x={CX} y={CY + 10} text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground, #000)">{total.toLocaleString()}</text>
			</svg>
			<ul class="legend">
				{#each slices as s, i}
					<li class="legend-item">
						<span class="swatch" style="background:{COLORS[i % COLORS.length]}"></span>
						<span class="legend-label">{s.label}</span>
						<span class="legend-pct">{s.percent.toFixed(1)}%</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.chart-wrap { display: flex; flex-direction: column; gap: 0.5rem; }
	.chart-title { font-size: 0.85rem; font-weight: 600; }
	.chart-body { display: flex; align-items: flex-start; gap: 1.5rem; flex-wrap: wrap; }
	.chart-svg { width: 160px; height: 160px; flex-shrink: 0; }
	.empty { font-size: 0.85rem; color: var(--muted-foreground, #6b7280); }
	.legend { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.8rem; }
	.legend-item { display: flex; align-items: center; gap: 0.4rem; }
	.swatch { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
	.legend-label { flex: 1; }
	.legend-pct { color: var(--muted-foreground, #6b7280); }
</style>
