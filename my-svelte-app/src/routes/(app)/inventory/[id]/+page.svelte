<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const { form, errors, enhance, submitting } = superForm(data.form, {
		action: '?/update'
	});
</script>

<div class="page">
	<div class="page-header">
		<div>
			<a href="/inventory" class="back-link">← Back to Inventory</a>
			<h1>{data.product.brand} {data.product.size} {data.product.pattern}</h1>
		</div>

		<!-- Archive button -->
		<form method="POST" action="?/archive">
			<button
				type="submit"
				class="btn-danger"
				onclick={(e) => {
					if (!confirm('Archive this product? It will be hidden from active inventory.')) {
						e.preventDefault();
					}
				}}
			>
				Archive
			</button>
		</form>
	</div>

	<!-- Product meta -->
	<div class="meta-row">
		<span>Current Qty: <strong>{data.product.quantity}</strong></span>
		<span>Created: {new Date(data.product.createdAt).toLocaleDateString()}</span>
		<span>Updated: {new Date(data.product.updatedAt).toLocaleDateString()}</span>
	</div>

	<!-- Edit form -->
	<div class="form-section">
		<h2>Edit Product</h2>

		{#if $errors._errors}
			<p class="form-error">{$errors._errors[0]}</p>
		{/if}

		<form method="POST" action="?/update" use:enhance>
			<div class="form-grid">
				<div class="field">
					<label for="brand">Brand</label>
					<input
						id="brand"
						name="brand"
						type="text"
						bind:value={$form.brand}
						aria-invalid={!!$errors.brand}
					/>
					{#if $errors.brand}
						<span class="field-error">{$errors.brand[0]}</span>
					{/if}
				</div>

				<div class="field">
					<label for="size">Size</label>
					<input
						id="size"
						name="size"
						type="text"
						bind:value={$form.size}
						aria-invalid={!!$errors.size}
					/>
					{#if $errors.size}
						<span class="field-error">{$errors.size[0]}</span>
					{/if}
				</div>

				<div class="field">
					<label for="pattern">Pattern</label>
					<input
						id="pattern"
						name="pattern"
						type="text"
						bind:value={$form.pattern}
						aria-invalid={!!$errors.pattern}
					/>
					{#if $errors.pattern}
						<span class="field-error">{$errors.pattern[0]}</span>
					{/if}
				</div>

				<div class="field">
					<label for="unitCostPrice">Unit Cost Price</label>
					<input
						id="unitCostPrice"
						name="unitCostPrice"
						type="number"
						step="0.01"
						min="0"
						bind:value={$form.unitCostPrice}
						aria-invalid={!!$errors.unitCostPrice}
					/>
					{#if $errors.unitCostPrice}
						<span class="field-error">{$errors.unitCostPrice[0]}</span>
					{/if}
				</div>

				<div class="field">
					<label for="retailPrice">Retail Price</label>
					<input
						id="retailPrice"
						name="retailPrice"
						type="number"
						step="0.01"
						min="0"
						bind:value={$form.retailPrice}
						aria-invalid={!!$errors.retailPrice}
					/>
					{#if $errors.retailPrice}
						<span class="field-error">{$errors.retailPrice[0]}</span>
					{/if}
				</div>

				<div class="field">
					<label for="lowStockThreshold">Low Stock Threshold</label>
					<input
						id="lowStockThreshold"
						name="lowStockThreshold"
						type="number"
						min="0"
						bind:value={$form.lowStockThreshold}
						aria-invalid={!!$errors.lowStockThreshold}
					/>
					{#if $errors.lowStockThreshold}
						<span class="field-error">{$errors.lowStockThreshold[0]}</span>
					{/if}
				</div>

				<div class="field">
					<label for="deliveryProviderId">Delivery Provider ID (UUID)</label>
					<input
						id="deliveryProviderId"
						name="deliveryProviderId"
						type="text"
						bind:value={$form.deliveryProviderId}
						aria-invalid={!!$errors.deliveryProviderId}
						placeholder="optional"
					/>
					{#if $errors.deliveryProviderId}
						<span class="field-error">{$errors.deliveryProviderId[0]}</span>
					{/if}
				</div>
			</div>

			<div class="form-actions">
				<button type="submit" class="btn-primary" disabled={$submitting}>
					{$submitting ? 'Saving…' : 'Save Changes'}
				</button>
				<a href="/inventory" class="btn-secondary">Cancel</a>
			</div>
		</form>
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		max-width: 800px;
	}

	.page-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.back-link {
		font-size: 0.85rem;
		color: var(--muted-foreground, #888);
		text-decoration: none;
		display: block;
		margin-bottom: 0.25rem;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	h1 {
		font-size: 1.4rem;
		font-weight: 700;
	}

	h2 {
		font-size: 1.05rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	.meta-row {
		display: flex;
		gap: 1.5rem;
		font-size: 0.9rem;
		color: var(--muted-foreground, #888);
		flex-wrap: wrap;
	}

	.form-section {
		background: var(--card, #fff);
		border: 1px solid var(--border, #ccc);
		border-radius: 6px;
		padding: 1.25rem;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.75rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	label {
		font-size: 0.85rem;
		font-weight: 500;
	}

	input {
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--border, #ccc);
		border-radius: 4px;
		font-size: 0.9rem;
		background: var(--input, #fff);
		color: var(--foreground, #000);
	}

	input[aria-invalid='true'] {
		border-color: var(--destructive, red);
	}

	.field-error {
		color: var(--destructive, red);
		font-size: 0.8rem;
	}

	.form-error {
		color: var(--destructive, red);
		font-size: 0.9rem;
		margin-bottom: 0.75rem;
	}

	.form-actions {
		display: flex;
		gap: 0.75rem;
		margin-top: 1rem;
		align-items: center;
	}

	.btn-primary {
		padding: 0.45rem 1rem;
		background: var(--primary, red);
		color: var(--primary-foreground, #fff);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		padding: 0.45rem 1rem;
		background: var(--muted, #e5e7eb);
		color: var(--muted-foreground, #374151);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		text-decoration: none;
		display: inline-block;
	}

	.btn-danger {
		padding: 0.45rem 1rem;
		background: var(--destructive, red);
		color: var(--destructive-foreground, #fff);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
	}
</style>
