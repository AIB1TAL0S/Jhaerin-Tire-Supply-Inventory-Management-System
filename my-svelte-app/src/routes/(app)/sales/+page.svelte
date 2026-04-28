<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { goto } from '$app/navigation';
	import SaleForm from '$lib/components/SaleForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const sf = superForm(data.form, {
		action: '?/create',
		onResult({ result }) {
			if (result.type === 'success') goto('/sales', { invalidateAll: true });
		}
	});

	let filterProduct = $state('');
	let filterBrand = $state('');
	let filterDate = $state('');
	let filterMonth = $state('');

	const productMap = $derived(new Map(data.products.map((p) => [p.id, p])));

	const filtered = $derived(
		data.sales.filter((s) => {
			const product = productMap.get(s.tireProductId);
			const label = product ? `${product.brand} ${product.size} ${product.pattern}` : s.tireProductId;
			const matchProduct = !filterProduct || label.toLowerCase().includes(filterProduct.toLowerCase());
			const matchBrand = !filterBrand || (product && product.brand.toLowerCase().includes(filterBrand.toLowerCase()));
			const matchDate = !filterDate || s.transactionDate.startsWith(filterDate);
			const matchMonth = !filterMonth || s.transactionDate.startsWith(filterMonth);
			return matchProduct && matchBrand && matchDate && matchMonth;
		})
	);

	function fmt(n: number) {
		return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

<div class="page">
	<h1>Sales</h1>

	<section class="card">
		<h2>Record Sale</h2>
		<SaleForm superform={sf} products={data.products} />
	</section>

	<section class="card">
		<div class="list-header">
			<h2>Sales Transactions</h2>
			<div class="filters">
				<input type="text" placeholder="Filter by product…" bind:value={filterProduct} aria-label="Filter by product" />
				<input type="text" placeholder="Filter by brand…" bind:value={filterBrand} aria-label="Filter by brand" />
				<input type="date" bind:value={filterDate} aria-label="Filter by date" />
				<input type="month" bind:value={filterMonth} aria-label="Filter by month" />
			</div>
		</div>

		{#if filtered.length === 0}
			<p class="empty">No sales transactions found.</p>
		{:else}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Product</th>
							<th>Qty Sold</th>
							<th>Unit Retail</th>
							<th>Unit Cost</th>
							<th>Revenue</th>
							<th>Gross Profit</th>
							<th>Date</th>
						</tr>
					</thead>
					<tbody>
						{#each filtered as s (s.id)}
							{@const product = productMap.get(s.tireProductId)}
							<tr>
								<td>{product ? `${product.brand} ${product.size} ${product.pattern}` : s.tireProductId}</td>
								<td>{s.quantitySold}</td>
								<td>₱{fmt(s.unitRetailPrice)}</td>
								<td>₱{fmt(s.unitCostPrice)}</td>
								<td>₱{fmt(s.revenue)}</td>
								<td class:positive={s.grossProfit >= 0} class:negative={s.grossProfit < 0}>₱{fmt(s.grossProfit)}</td>
								<td class="timestamp">{new Date(s.transactionDate).toLocaleString()}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>

<style>
	.page { display: flex; flex-direction: column; gap: 1.5rem; }
	h1 { font-size: 1.5rem; font-weight: 700; }
	h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; }
	.card { background: var(--card, #fff); border: 1px solid var(--border, #ccc); border-radius: 6px; padding: 1.25rem; }
	.list-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
	.list-header h2 { margin-bottom: 0; }
	.filters { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.filters input { padding: 0.35rem 0.6rem; border: 1px solid var(--border, #ccc); border-radius: 4px; font-size: 0.85rem; background: var(--input, #fff); color: var(--foreground, #000); }
	.empty { color: var(--muted-foreground, #6b7280); font-size: 0.9rem; }
	.table-wrap { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
	th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border, #ccc); font-weight: 600; white-space: nowrap; }
	td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border, #e5e7eb); vertical-align: middle; }
	.positive { color: #16a34a; font-weight: 500; }
	.negative { color: var(--destructive, red); font-weight: 500; }
	.timestamp { white-space: nowrap; font-size: 0.85rem; }
	tr:last-child td { border-bottom: none; }
</style>
