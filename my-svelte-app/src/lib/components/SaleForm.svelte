<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import type { SaleInput } from '$lib/schemas/sales.schema';
	import type { TireProduct } from '$lib/types/index';

	interface Props {
		superform: SuperForm<SaleInput>;
		products: TireProduct[];
	}

	let { superform, products }: Props = $props();
	const { form, errors, enhance, submitting } = superform;

	const selectedProduct = $derived(products.find((p) => p.id === $form.tireProductId) ?? null);
	const unitRetailPrice = $derived(selectedProduct?.retailPrice ?? 0);
	const unitCostPrice = $derived(selectedProduct?.unitCostPrice ?? 0);
	const quantitySold = $derived($form.quantitySold ?? 0);
	const previewRevenue = $derived(quantitySold * unitRetailPrice);
	const previewGrossProfit = $derived(previewRevenue - quantitySold * unitCostPrice);

	function fmt(n: number) {
		return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

<form method="POST" action="?/create" use:enhance>
	{#if $errors._errors}
		<p class="form-error" role="alert">{$errors._errors[0]}</p>
	{/if}

	<div class="form-grid">
		<div class="field field-full">
			<label for="tireProductId">Product</label>
			<select id="tireProductId" name="tireProductId" bind:value={$form.tireProductId} aria-invalid={!!$errors.tireProductId}>
				<option value="">— select product —</option>
				{#each products as p (p.id)}
					<option value={p.id}>{p.brand} {p.size} {p.pattern}</option>
				{/each}
			</select>
			{#if $errors.tireProductId}<span class="field-error">{$errors.tireProductId[0]}</span>{/if}
		</div>

		{#if selectedProduct}
			<div class="price-info">
				<span>Retail: <strong>₱{fmt(unitRetailPrice)}</strong></span>
				<span>Cost: <strong>₱{fmt(unitCostPrice)}</strong></span>
				<span>In stock: <strong>{selectedProduct.quantity}</strong></span>
			</div>
		{/if}

		<div class="field">
			<label for="quantitySold">Quantity Sold</label>
			<input id="quantitySold" name="quantitySold" type="number" min="1" bind:value={$form.quantitySold} aria-invalid={!!$errors.quantitySold} />
			{#if $errors.quantitySold}<span class="field-error">{$errors.quantitySold[0]}</span>{/if}
		</div>

		<div class="field">
			<label for="transactionDate">Date &amp; Time</label>
			<input id="transactionDate" name="transactionDate" type="datetime-local" bind:value={$form.transactionDate} aria-invalid={!!$errors.transactionDate} />
			{#if $errors.transactionDate}<span class="field-error">{$errors.transactionDate[0]}</span>{/if}
		</div>
	</div>

	{#if selectedProduct && quantitySold > 0}
		<div class="preview">
			<span>Revenue: <strong>₱{fmt(previewRevenue)}</strong></span>
			<span>Gross profit: <strong class:positive={previewGrossProfit >= 0} class:negative={previewGrossProfit < 0}>₱{fmt(previewGrossProfit)}</strong></span>
		</div>
	{/if}

	<div class="form-actions">
		<button type="submit" class="btn-primary" disabled={$submitting}>
			{$submitting ? 'Saving…' : 'Record Sale'}
		</button>
	</div>
</form>

<style>
	.form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
	.field { display: flex; flex-direction: column; gap: 0.25rem; }
	.field-full { grid-column: 1 / -1; }
	label { font-size: 0.85rem; font-weight: 500; }
	input, select { padding: 0.4rem 0.6rem; border: 1px solid var(--border, #ccc); border-radius: 4px; font-size: 0.9rem; background: var(--input, #fff); color: var(--foreground, #000); }
	input[aria-invalid='true'], select[aria-invalid='true'] { border-color: var(--destructive, red); }
	.field-error { color: var(--destructive, red); font-size: 0.8rem; }
	.form-error { color: var(--destructive, red); font-size: 0.9rem; margin-bottom: 0.75rem; padding: 0.5rem 0.75rem; border: 1px solid var(--destructive, red); border-radius: 4px; }
	.price-info { grid-column: 1 / -1; display: flex; gap: 1.25rem; flex-wrap: wrap; font-size: 0.85rem; padding: 0.5rem 0.75rem; background: var(--muted, #f3f4f6); border-radius: 4px; }
	.preview { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: var(--muted, #f3f4f6); border-radius: 4px; font-size: 0.875rem; }
	.positive { color: #16a34a; }
	.negative { color: var(--destructive, red); }
	.form-actions { margin-top: 1rem; }
	.btn-primary { padding: 0.45rem 1rem; background: var(--primary, red); color: var(--primary-foreground, #fff); border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; font-weight: 500; }
	.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
