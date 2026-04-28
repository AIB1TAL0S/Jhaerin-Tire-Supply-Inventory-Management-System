<script lang="ts">
	import type { TireProduct } from '$lib/types/index.js';

	interface Props {
		products: TireProduct[];
		offset?: number;
		pageSize?: number;
		onprev?: () => void;
		onnext?: () => void;
	}

	let {
		products,
		offset = 0,
		pageSize = 50,
		onprev,
		onnext
	}: Props = $props();

	// Client-side search/filter state
	let search = $state('');
	let filterStockLevel = $state<'all' | 'low' | 'normal'>('all');

	const LOW_THRESHOLD = 5;

	function stockLevel(p: TireProduct): 'low' | 'normal' {
		const threshold = p.lowStockThreshold ?? LOW_THRESHOLD;
		return p.quantity <= threshold ? 'low' : 'normal';
	}

	const filtered = $derived(
		products.filter((p) => {
			if (search) {
				const q = search.toLowerCase();
				if (
					!p.brand.toLowerCase().includes(q) &&
					!p.size.toLowerCase().includes(q) &&
					!p.pattern.toLowerCase().includes(q)
				) {
					return false;
				}
			}
			if (filterStockLevel !== 'all' && stockLevel(p) !== filterStockLevel) {
				return false;
			}
			return true;
		})
	);

	const hasPrev = $derived(offset > 0);
	const hasNext = $derived(products.length === pageSize);
</script>

<div class="product-table-wrapper">
	<!-- Controls -->
	<div class="controls">
		<input
			type="search"
			placeholder="Search brand, size, pattern…"
			bind:value={search}
			class="search-input"
			aria-label="Search products"
		/>

		<select
			bind:value={filterStockLevel}
			class="filter-select"
			aria-label="Filter by stock level"
		>
			<option value="all">All stock levels</option>
			<option value="low">Low stock</option>
			<option value="normal">Normal stock</option>
		</select>
	</div>

	<!-- Table -->
	<div class="table-scroll">
		<table>
			<thead>
				<tr>
					<th>Brand</th>
					<th>Size</th>
					<th>Pattern</th>
					<th>Qty</th>
					<th>Cost Price</th>
					<th>Retail Price</th>
					<th>Stock Level</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#if filtered.length === 0}
					<tr>
						<td colspan="8" class="empty-row">No products found.</td>
					</tr>
				{:else}
					{#each filtered as product (product.id)}
						<tr class={stockLevel(product) === 'low' ? 'row-low' : ''}>
							<td>{product.brand}</td>
							<td>{product.size}</td>
							<td>{product.pattern}</td>
							<td>{product.quantity}</td>
							<td>{product.unitCostPrice.toFixed(2)}</td>
							<td>{product.retailPrice.toFixed(2)}</td>
							<td>
								<span class="badge badge-{stockLevel(product)}">
									{stockLevel(product) === 'low' ? 'Low' : 'Normal'}
								</span>
							</td>
							<td>
								<a href="/inventory/{product.id}" class="action-link">Edit</a>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	<div class="pagination">
		<button disabled={!hasPrev} onclick={onprev} class="page-btn">← Prev</button>
		<span class="page-info">
			{offset + 1}–{offset + products.length}
		</span>
		<button disabled={!hasNext} onclick={onnext} class="page-btn">Next →</button>
	</div>
</div>

<style>
	.product-table-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.controls {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.search-input {
		flex: 1;
		min-width: 200px;
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--border, #ccc);
		border-radius: 4px;
		font-size: 0.9rem;
		background: var(--input, #fff);
		color: var(--foreground, #000);
	}

	.filter-select {
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--border, #ccc);
		border-radius: 4px;
		font-size: 0.9rem;
		background: var(--input, #fff);
		color: var(--foreground, #000);
	}

	.table-scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th {
		text-align: left;
		padding: 0.5rem 0.75rem;
		border-bottom: 2px solid var(--border, #ccc);
		font-weight: 600;
		white-space: nowrap;
	}

	td {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--border, #eee);
	}

	.row-low td {
		background-color: color-mix(in srgb, var(--destructive, red) 8%, transparent);
	}

	.empty-row {
		text-align: center;
		color: var(--muted-foreground, #888);
		padding: 1.5rem;
	}

	.badge {
		display: inline-block;
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.badge-low {
		background: var(--destructive, red);
		color: var(--destructive-foreground, #fff);
	}

	.badge-normal {
		background: var(--muted, #e5e7eb);
		color: var(--muted-foreground, #374151);
	}

	.action-link {
		color: var(--primary, red);
		text-decoration: none;
		font-size: 0.85rem;
	}

	.action-link:hover {
		text-decoration: underline;
	}

	.pagination {
		display: flex;
		align-items: center;
		gap: 1rem;
		justify-content: flex-end;
	}

	.page-btn {
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--border, #ccc);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
		background: var(--card, #fff);
		color: var(--foreground, #000);
	}

	.page-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.page-info {
		font-size: 0.85rem;
		color: var(--muted-foreground, #888);
	}
</style>
