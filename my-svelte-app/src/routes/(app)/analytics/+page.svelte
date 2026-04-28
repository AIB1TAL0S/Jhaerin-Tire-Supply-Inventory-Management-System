<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let filterFrom = $state(data.period.from);
	let filterTo = $state(data.period.to);
	let exporting = $state(false);
	let exportError = $state('');

	function applyFilter() { goto(`/analytics?from=${filterFrom}&to=${filterTo}`); }
	function handlePrint() { window.print(); }

	async function handleExport() {
		exporting = true; exportError = '';
		try {
			const { analyticsService } = await import('$lib/services/analytics.service');
			const url = await analyticsService.exportReport('revenue', data.period);
			const a = document.createElement('a');
			a.href = url; a.download = `revenue-report-${data.period.from}-${data.period.to}.json`; a.click();
		} catch (err) {
			exportError = err instanceof Error ? err.message : 'Export failed.';
		} finally { exporting = false; }
	}

	function fmt(n: number) { return '₱' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
	function pct(n: number) { return n.toFixed(2) + '%'; }

	const totalRevenue = $derived(data.revenueSummary.reduce((s, r) => s + r.revenue, 0));
	const totalProfit = $derived(data.revenueSummary.reduce((s, r) => s + r.grossProfit, 0));
	const overallMargin = $derived(totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0);
</script>

<div class="page">
	<div class="page-header">
		<h1>Analytics</h1>
		<div class="actions">
			<div class="date-filter">
				<label>From <input type="date" bind:value={filterFrom} /></label>
				<label>To <input type="date" bind:value={filterTo} /></label>
				<button class="btn-secondary" onclick={applyFilter}>Apply</button>
			</div>
			<button class="btn-secondary" onclick={handlePrint}>Print</button>
			<button class="btn-primary" onclick={handleExport} disabled={exporting}>{exporting ? 'Exporting…' : 'Export JSON'}</button>
		</div>
	</div>

	{#if exportError}<p class="error-msg">{exportError}</p>{/if}

	<section class="card">
		<h2>Revenue Summary</h2>
		<div class="summary-stats">
			<div class="stat"><span class="stat-label">Total Revenue</span><span class="stat-value">{fmt(totalRevenue)}</span></div>
			<div class="stat"><span class="stat-label">Total Gross Profit</span><span class="stat-value profit">{fmt(totalProfit)}</span></div>
			<div class="stat"><span class="stat-label">Overall Margin</span><span class="stat-value">{pct(overallMargin)}</span></div>
		</div>
		{#if data.revenueSummary.length === 0}
			<p class="empty">No revenue data for this period.</p>
		{:else}
			<div class="table-wrap">
				<table>
					<thead><tr><th>Period</th><th>Revenue</th><th>Gross Profit</th><th>Margin</th></tr></thead>
					<tbody>
						{#each data.revenueSummary as r (r.period)}
							{@const margin = r.revenue > 0 ? (r.grossProfit / r.revenue) * 100 : 0}
							<tr>
								<td>{r.period}</td><td>{fmt(r.revenue)}</td>
								<td class:profit={r.grossProfit >= 0} class:loss={r.grossProfit < 0}>{fmt(r.grossProfit)}</td>
								<td>{pct(margin)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<section class="card">
		<h2>Top Selling Products</h2>
		{#if data.topSelling.length === 0}<p class="empty">No sales data.</p>
		{:else}
			<div class="table-wrap"><table>
				<thead><tr><th>#</th><th>Brand</th><th>Size</th><th>Pattern</th><th>Total Sold</th></tr></thead>
				<tbody>{#each data.topSelling as p, i (p.tireProductId)}<tr><td>{i+1}</td><td>{p.brand}</td><td>{p.size}</td><td>{p.pattern}</td><td class="bold">{p.totalSold}</td></tr>{/each}</tbody>
			</table></div>
		{/if}
	</section>

	<section class="card">
		<h2>Least Selling Products</h2>
		{#if data.leastSelling.length === 0}<p class="empty">No sales data.</p>
		{:else}
			<div class="table-wrap"><table>
				<thead><tr><th>#</th><th>Brand</th><th>Size</th><th>Pattern</th><th>Total Sold</th></tr></thead>
				<tbody>{#each data.leastSelling as p, i (p.tireProductId)}<tr><td>{i+1}</td><td>{p.brand}</td><td>{p.size}</td><td>{p.pattern}</td><td>{p.totalSold}</td></tr>{/each}</tbody>
			</table></div>
		{/if}
	</section>

	<section class="card">
		<h2>Profit Margins</h2>
		{#if data.profitMargins.length === 0}<p class="empty">No products found.</p>
		{:else}
			<div class="table-wrap"><table>
				<thead><tr><th>Brand</th><th>Size</th><th>Pattern</th><th>Retail</th><th>Cost</th><th>Margin %</th></tr></thead>
				<tbody>{#each data.profitMargins as p (p.tireProductId)}<tr><td>{p.brand}</td><td>{p.size}</td><td>{p.pattern}</td><td>{fmt(p.retailPrice)}</td><td>{fmt(p.unitCostPrice)}</td><td class:profit={p.marginPercent >= 20} class:warn={p.marginPercent < 20}>{pct(p.marginPercent)}</td></tr>{/each}</tbody>
			</table></div>
		{/if}
	</section>

	<section class="card">
		<h2>Sales Forecast (Next 30 Days)</h2>
		{#if data.forecast.insufficientData}
			<p class="notice">{data.forecast.notice ?? 'Insufficient data for forecast.'}</p>
		{:else if data.forecast.forecast.length === 0}
			<p class="empty">No forecast data available.</p>
		{:else}
			<div class="table-wrap"><table>
				<thead><tr><th>Date</th><th>Predicted Sales (units)</th></tr></thead>
				<tbody>{#each data.forecast.forecast as f (f.date)}<tr><td>{f.date}</td><td>{f.predictedSales}</td></tr>{/each}</tbody>
			</table></div>
		{/if}
	</section>
</div>

<style>
	.page { display: flex; flex-direction: column; gap: 1.5rem; }
	.page-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
	h1 { font-size: 1.5rem; font-weight: 700; }
	h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; }
	.actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
	.date-filter { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 0.85rem; }
	.date-filter label { display: flex; align-items: center; gap: 0.35rem; color: var(--muted-foreground, #6b7280); }
	.date-filter input { padding: 0.3rem 0.5rem; border: 1px solid var(--border, #ccc); border-radius: 4px; font-size: 0.85rem; background: var(--input, #fff); color: var(--foreground, #000); }
	.btn-primary { padding: 0.35rem 0.9rem; background: var(--primary, #dc2626); color: #fff; border: none; border-radius: 4px; font-size: 0.85rem; cursor: pointer; font-weight: 500; }
	.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn-secondary { padding: 0.35rem 0.9rem; background: var(--muted, #f3f4f6); color: var(--foreground, #000); border: 1px solid var(--border, #ccc); border-radius: 4px; font-size: 0.85rem; cursor: pointer; }
	.card { background: var(--card, #fff); border: 1px solid var(--border, #ccc); border-radius: 8px; padding: 1.25rem; }
	.summary-stats { display: flex; gap: 2rem; flex-wrap: wrap; margin-bottom: 1rem; }
	.stat { display: flex; flex-direction: column; gap: 0.2rem; }
	.stat-label { font-size: 0.75rem; color: var(--muted-foreground, #6b7280); text-transform: uppercase; letter-spacing: 0.05em; }
	.stat-value { font-size: 1.4rem; font-weight: 700; }
	.stat-value.profit { color: #16a34a; }
	.empty, .notice { font-size: 0.85rem; color: var(--muted-foreground, #6b7280); }
	.notice { background: var(--muted, #f3f4f6); border-radius: 4px; padding: 0.75rem 1rem; }
	.error-msg { font-size: 0.85rem; color: var(--destructive, #dc2626); background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 0.75rem 1rem; }
	.table-wrap { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
	th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border, #ccc); font-weight: 600; white-space: nowrap; }
	td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border, #e5e7eb); vertical-align: middle; }
	tr:last-child td { border-bottom: none; }
	.profit { color: #16a34a; font-weight: 500; }
	.loss { color: var(--destructive, #dc2626); font-weight: 500; }
	.warn { color: #d97706; }
	.bold { font-weight: 600; }
	@media print { .actions { display: none; } }
</style>
