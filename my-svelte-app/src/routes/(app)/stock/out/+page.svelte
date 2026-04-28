<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { goto } from '$app/navigation';
	import StockOutForm from '$lib/components/StockOutForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const sf = superForm(data.form, {
		action: '?/create',
		onResult({ result }) {
			if (result.type === 'success') {
				goto('/stock/out', { invalidateAll: true });
			}
		}
	});

	let filterProduct = $state('');
	let filterReason = $state('');
	let filterDate = $state('');

	const filtered = $derived(
		data.transactions.filter((t) => {
			const matchProduct = !filterProduct || t.tireProductId.toLowerCase().includes(filterProduct.toLowerCase());
			const matchReason = !filterReason || t.reason.toLowerCase().includes(filterReason.toLowerCase());
			const matchDate = !filterDate || t.transactionDate.startsWith(filterDate);
			return matchProduct && matchReason && matchDate;
		})
	);
</script>

<div class="page">
	<h1>Stock Out</h1>

	<section class="card">
		<h2>Record Stock-Out</h2>
		<StockOutForm superform={sf} products={data.products} />
	</section>

	<section class="card">
		<div class="list-header">
			<h2>Transaction History</h2>
			<div class="filters">
				<input type="text" placeholder="Filter by product ID…" bind:value={filterProduct} aria-label="Filter by product" />
				<input type="text" placeholder="Filter by reason…" bind:value={filterReason} aria-label="Filter by reason" />
				<input type="date" bind:value={filterDate} aria-label="Filter by date" />
			</div>
		</div>

		{#if filtered.length === 0}
			<p class="empty">No transactions found.</p>
		{:else}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Product ID</th>
							<th>Qty</th>
							<th>Reason</th>
							<th>Date &amp; Time</th>
						</tr>
					</thead>
					<tbody>
						{#each filtered as t (t.id)}
							<tr>
								<td class="mono">{t.tireProductId}</td>
								<td>{t.quantity}</td>
								<td>{t.reason}</td>
								<td class="timestamp">{new Date(t.transactionDate).toLocaleString()}</td>
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
	.list-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
	.list-header h2 { margin-bottom: 0; }
	.filters { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.filters input { padding: 0.35rem 0.6rem; border: 1px solid var(--border, #ccc); border-radius: 4px; font-size: 0.85rem; background: var(--input, #fff); color: var(--foreground, #000); }
	.empty { color: var(--muted-foreground, #6b7280); font-size: 0.9rem; }
	.table-wrap { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
	th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border, #ccc); font-weight: 600; white-space: nowrap; }
	td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border, #e5e7eb); vertical-align: top; }
	.mono { font-family: monospace; font-size: 0.8rem; word-break: break-all; }
	.timestamp { white-space: nowrap; font-size: 0.85rem; }
	tr:last-child td { border-bottom: none; }
</style>
