<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { goto } from '$app/navigation';
	import ProductTable from '$lib/components/ProductTable.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showCreateForm = $state(false);

	const { form, errors, enhance, submitting, message } = superForm(data.form, {
		action: '?/create',
		onResult({ result }) {
			if (result.type === 'success') {
				showCreateForm = false;
				goto('/inventory', { invalidateAll: true });
			}
		}
	});

	function handlePrev() {
		const newOffset = Math.max(0, data.offset - 50);
		goto(`/inventory?offset=${newOffset}`);
	}

	function handleNext() {
		const newOffset = data.offset + 50;
		goto(`/inventory?offset=${newOffset}`);
	}
</script>

<div class="page">
	<div class="page-header">
		<h1>Inventory</h1>
		<button
			class="btn-primary"
			onclick={() => (showCreateForm = !showCreateForm)}
			aria-expanded={showCreateForm}
		>
			{showCreateForm ? 'Cancel' : '+ New Product'}
		</button>
	</div>

	<!-- Create product form (inline) -->
	{#if showCreateForm}
		<div class="create-form-section">
			<h2>New Product</h2>

			{#if $errors._errors}
				<p class="form-error">{$errors._errors[0]}</p>
			{/if}

			<form method="POST" action="?/create" use:enhance>
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
						{$submitting ? 'Saving…' : 'Create Product'}
					</button>
					<button type="button" class="btn-secondary" onclick={() => (showCreateForm = false)}>
						Cancel
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Product list -->
	<ProductTable
		products={data.products}
		offset={data.offset}
		pageSize={50}
		onprev={handlePrev}
		onnext={handleNext}
	/>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
	}

	h2 {
		font-size: 1.1rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	.create-form-section {
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
	}
</style>
