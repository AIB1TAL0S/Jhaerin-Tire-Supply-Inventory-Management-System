<script lang="ts">
	import { goto } from '$app/navigation';
	import DashboardMetricCard from '$lib/components/DashboardMetricCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let filterFrom = $state(data.period.from);
	let filterTo = $state(data.period.to);

	function applyFilter() { goto(`/dashboard?from=${filterFrom}&to=${filterTo}`); }
	function fmt(n: number) { return '₱' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

	const totalProducts = $derived(data.products.length);
	const totalStock = $derived(data.products.reduce((s, p) => s + p.quantity, 0));
	const totalRevenue = $derived(data.revenueSummary.reduce((s, r) => s + r.revenue, 0));
	const totalGrossProfit = $derived(data.revenueSummary.reduce((s, r) => s + r.grossProfit, 0));
	const lowStockProducts = $derived(data.products.filter((p) => p.quantity <= (p.lowStockThreshold ?? 5)));
	const barChartData = $derived(data.revenueSummary.map((r) => ({ label: r.period, value: r.revenue })));
	const brandMap = $derived(() => {
		const m = new Map<string, number>();
		for (const t of data.topSelling) m.set(t.brand, (m.get(t.brand) ?? 0) + t.totalSold);
		return Array.from(m.entries()).map(([label, value]) => ({ label, value }));
	})();
</script>

<div class="page">
	<div class="page-header">
		<h1>Dashboard</h1>
		<div class="date-filter">
			<label>From <input type="date" bind:value={filterFrom} aria-label="From date" /></label>
			<label>To <input type="date" bind:value={filterTo} aria-label="To date" /></label>
			<button class="btn-primary" onclick={applyFilter}>Apply</button>
		</div>
	</div>

	<div class="metrics-grid">
		<DashboardMetricCard title="Total Products" value={totalProducts} subtitle="Active catalog items" />
		<DashboardMetricCard title="Total Stock" value={totalStock.toLocaleString()} subtitle="Units across all products" />
		<DashboardMetricCard title="Inventory Value" value={fmt(data.inventoryValue)} subtitle="Cost basis" />
		<DashboardMetricCard title="Revenue" value={fmt(totalRevenue)} subtitle="{data.period.from} – {data.period.to}" />
		<DashboardMetricCard title="Gross Profit" value={fmt(totalGrossProfit)} subtitle="{data.period.from} – {data.period.to}" />
	</div>

	<div class="charts-grid">
		<div class="card">
			{#await import('$lib/components/SalesBarChart.svelte')}
				<p class="loading">Loading chart…</p>
			{:then { default: SalesBarChart }}
				<SalesBarChart data={barChartData} title="Revenue by Period" />
			{/await}
		</div>
		<div class="card">
			{#await import('$lib/components/RevenueTrendChart.svelte')}
				<p class="loading">Loading chart…</p>
			{:then { default: RevenueTrendChart }}
				<RevenueTrendChart data={data.revenueSummary} title="Revenue vs Gross Profit" />
			{/await}
		</div>
		<div class="card">
			{#await import('$lib/components/SalesBrandPieChart.svelte')}
				<p class="loading">Loading chart…</p>
			{:then { default: SalesBrandPieChart }}
				<SalesBrandPieChart data={brandMap} title="Sales by Brand" />
			{/await}
		</div>
	</div>

	<div class="bottom-grid">
		<section class="card">
			<h2>Low Stock Alerts <span class="badge">{lowStockProducts.length}</span></h2>
			{#if lowStockProducts.length === 0}
				<p class="empty">All products are adequately stocked.</p>
			{:else}
				<ul class="alert-list">
					{#each lowStockProducts as p (p.id)}
						<li class="alert-item">
							<span>{p.brand} {p.size} {p.pattern}</span>
							<span class="low">Qty: {p.quantity}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
		<section class="card">
			<h2>Top Selling Products</h2>
			{#if data.topSelling.length === 0}
				<p class="empty">No sales data for this period.</p>
			{:else}
				<ol class="top-list">
					{#each data.topSelling.slice(0, 10) as p (p.tireProductId)}
						<li class="top-item">
							<span>{p.brand} {p.size} {p.pattern}</span>
							<span class="sold">{p.totalSold} sold</span>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	</div>
</div>

<style>
	.page { display: flex; flex-direction: column; gap: 1.5rem; }
	.page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
	h1 { font-size: 1.5rem; font-weight: 700; }
	h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; }
	.date-filter { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; font-size: 0.85rem; }
	.date-filter label { display: flex; align-items: center; gap: 0.35rem; color: var(--muted-foreground, #6b7280); }
	.date-filter input { padding: 0.3rem 0.5rem; border: 1px solid var(--border, #ccc); border-radius: 4px; font-size: 0.85rem; background: var(--input, #fff); color: var(--foreground, #000); }
	.btn-primary { padding: 0.35rem 0.9rem; background: var(--primary, #dc2626); color: #fff; border: none; border-radius: 4px; font-size: 0.85rem; cursor: pointer; font-weight: 500; }
	.metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; }
	.charts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
	.bottom-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
	.card { background: var(--card, #fff); border: 1px solid var(--border, #ccc); border-radius: 8px; padding: 1.25rem; }
	.loading, .empty { font-size: 0.85rem; color: var(--muted-foreground, #6b7280); }
	.badge { background: var(--destructive, #dc2626); color: #fff; border-radius: 9999px; padding: 0.1rem 0.5rem; font-size: 0.75rem; font-weight: 600; }
	.alert-list, .top-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
	.alert-item, .top-item { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; padding: 0.35rem 0; border-bottom: 1px solid var(--border, #e5e7eb); }
	.alert-item:last-child, .top-item:last-child { border-bottom: none; }
	.low { color: var(--destructive, #dc2626); font-weight: 600; }
	.sold { color: var(--primary, #dc2626); font-weight: 600; }
</style>
