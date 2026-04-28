<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import type { StockOutInput } from '$lib/schemas/stock-out.schema';
	import type { TireProduct } from '$lib/types/index';

	interface Props {
		superform: SuperForm<StockOutInput>;
		products: TireProduct[];
	}

	let { superform, products }: Props = $props();

	const { form, errors, enhance, submitting } = superform;
</script>

<form method="POST" action="?/create" use:enhance>
	{#if $errors._errors}
		<p class="form-error" role="alert">{$errors._errors[0]}</p>
	{/if}

	<div class="form-grid">
		<div class="field">
			<label for="tireProductId">Product</label>
			<select
				id="tireProductId"
				name="tireProductId"
				bind:value={$form.tireProductId}
				aria-invalid={!!$errors.tireProductId}
			>
				<option value="">— select product —</option>
				{#each products as p (p.id)}
					<option value={p.id}>{p.brand} {p.size} {p.pattern}</option>
				{/each}
			</select>
			{#if $errors.tireProductId}
				<span class="field-error">{$errors.tireProductId[0]}</span>
			{/if}
		</div>

		<div class="field">
			<label for="quantity">Quantity</label>
			<input
				id="quantity"
				name="quantity"
				type="number"
				min="1"
				bind:value={$form.quantity}
				aria-invalid={!!$errors.quantity}
			/>
			{#if $errors.quantity}
				<span class="field-error">{$errors.quantity[0]}</span>
			{/if}
		</div>

		<div class="field">
			<label for="transactionDate">Date &amp; Time</label>
			<input
				id="transactionDate"
				name="transactionDate"
				type="datetime-local"
				bind:value={$form.transactionDate}
				aria-invalid={!!$errors.transactionDate}
			/>
			{#if $errors.transactionDate}
				<span class="field-error">{$errors.transactionDate[0]}</span>
			{/if}
		</div>

		<div class="field field-full">
			<label for="reason">Reason</label>
			<input
				id="reason"
				name="reason"
				type="text"
				placeholder="e.g. damaged, returned, internal use…"
				bind:value={$form.reason}
				aria-invalid={!!$errors.reason}
			/>
			{#if $errors.reason}
				<span class="field-error">{$errors.reason[0]}</span>
			{/if}
		</div>
	</div>

	<div class="form-actions">
		<button type="submit" class="btn-primary" disabled={$submitting}>
			{$submitting ? 'Saving…' : 'Record Stock-Out'}
		</button>
	</div>
</form>

<style>
	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.75rem;
	}
	.field { display: flex; flex-direction: column; gap: 0.25rem; }
	.field-full { grid-column: 1 / -1; }
	label { font-size: 0.85rem; font-weight: 500; }
	input, select {
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--border, #ccc);
		border-radius: 4px;
		font-size: 0.9rem;
		background: var(--input, #fff);
		color: var(--foreground, #000);
	}
	input[aria-invalid='true'], select[aria-invalid='true'] { border-color: var(--destructive, red); }
	.field-error { color: var(--destructive, red); font-size: 0.8rem; }
	.form-error {
		color: var(--destructive, red);
		font-size: 0.9rem;
		margin-bottom: 0.75rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--destructive, red);
		border-radius: 4px;
	}
	.form-actions { margin-top: 1rem; }
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
	.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
