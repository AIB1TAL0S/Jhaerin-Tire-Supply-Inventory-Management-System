<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const sf = superForm(data.settingsForm, {
		action: '?/saveSettings',
		onResult({ result }) {
			if (result.type === 'success') goto('/settings', { invalidateAll: true });
		}
	});
	const { form, errors, enhance, submitting } = sf;

	const pf = superForm(data.providerForm, {
		action: '?/createProvider',
		onResult({ result }) {
			if (result.type === 'success') goto('/settings', { invalidateAll: true });
		}
	});
	const { form: pForm, errors: pErrors, enhance: pEnhance, submitting: pSubmitting } = pf;
</script>

<div class="page">
	<h1>Settings</h1>

	<!-- System Settings -->
	<section class="card">
		<h2>System Settings</h2>
		{#if $errors._errors}<p class="form-error">{$errors._errors[0]}</p>{/if}
		<form method="POST" action="?/saveSettings" use:enhance>
			<div class="form-grid">
				<div class="field">
					<label for="globalLowStockThreshold">Global Low Stock Threshold</label>
					<input id="globalLowStockThreshold" name="globalLowStockThreshold" type="number" min="0" bind:value={$form.globalLowStockThreshold} aria-invalid={!!$errors.globalLowStockThreshold} />
					{#if $errors.globalLowStockThreshold}<span class="field-error">{$errors.globalLowStockThreshold[0]}</span>{/if}
				</div>
				<div class="field">
					<label for="deadStockWindowDays">Dead Stock Window (days)</label>
					<input id="deadStockWindowDays" name="deadStockWindowDays" type="number" min="1" bind:value={$form.deadStockWindowDays} aria-invalid={!!$errors.deadStockWindowDays} />
					{#if $errors.deadStockWindowDays}<span class="field-error">{$errors.deadStockWindowDays[0]}</span>{/if}
				</div>
				<div class="field">
					<label for="theme">Theme</label>
					<select id="theme" name="theme" bind:value={$form.theme}>
						<option value="dark">Dark</option>
						<option value="light">Light</option>
					</select>
				</div>
				<div class="field">
					<label for="dateFormat">Date Format</label>
					<input id="dateFormat" name="dateFormat" type="text" placeholder="YYYY-MM-DD" bind:value={$form.dateFormat} />
				</div>
				<div class="field">
					<label for="defaultDateRange">Default Date Range</label>
					<select id="defaultDateRange" name="defaultDateRange" bind:value={$form.defaultDateRange}>
						<option value="day">Day</option>
						<option value="week">Week</option>
						<option value="month">Month</option>
					</select>
				</div>
				<div class="field field-full">
					<label for="powersyncEndpoint">PowerSync Endpoint</label>
					<input id="powersyncEndpoint" name="powersyncEndpoint" type="url" placeholder="https://…" bind:value={$form.powersyncEndpoint} />
				</div>
				<div class="field field-full">
					<label for="powersyncToken">PowerSync Token</label>
					<input id="powersyncToken" name="powersyncToken" type="password" bind:value={$form.powersyncToken} />
				</div>
			</div>
			<div class="form-actions">
				<button type="submit" class="btn-primary" disabled={$submitting}>{$submitting ? 'Saving…' : 'Save Settings'}</button>
			</div>
		</form>
	</section>

	<!-- Delivery Providers -->
	<section class="card">
		<h2>Delivery Providers</h2>

		{#if data.providers.length === 0}
			<p class="empty">No delivery providers yet.</p>
		{:else}
			<ul class="provider-list">
				{#each data.providers as p (p.id)}
					<li class="provider-item">
						<span>{p.name}</span>
						<form method="POST" action="?/deleteProvider">
							<input type="hidden" name="id" value={p.id} />
							<button type="submit" class="btn-danger-sm" onclick={(e) => { if (!confirm(`Delete "${p.name}"?`)) e.preventDefault(); }}>Delete</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="add-provider">
			<h3>Add Provider</h3>
			{#if $pErrors._errors}<p class="form-error">{$pErrors._errors[0]}</p>{/if}
			<form method="POST" action="?/createProvider" use:pEnhance class="inline-form">
				<div class="field">
					<label for="providerName">Name</label>
					<input id="providerName" name="name" type="text" bind:value={$pForm.name} aria-invalid={!!$pErrors.name} placeholder="Provider name" />
					{#if $pErrors.name}<span class="field-error">{$pErrors.name[0]}</span>{/if}
				</div>
				<button type="submit" class="btn-primary" disabled={$pSubmitting}>{$pSubmitting ? 'Adding…' : 'Add Provider'}</button>
			</form>
		</div>
	</section>
</div>

<style>
	.page { display: flex; flex-direction: column; gap: 1.5rem; }
	h1 { font-size: 1.5rem; font-weight: 700; }
	h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; }
	h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.75rem; }
	.card { background: var(--card, #fff); border: 1px solid var(--border, #ccc); border-radius: 6px; padding: 1.25rem; }
	.form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
	.field { display: flex; flex-direction: column; gap: 0.25rem; }
	.field-full { grid-column: 1 / -1; }
	label { font-size: 0.85rem; font-weight: 500; }
	input, select { padding: 0.4rem 0.6rem; border: 1px solid var(--border, #ccc); border-radius: 4px; font-size: 0.9rem; background: var(--input, #fff); color: var(--foreground, #000); }
	input[aria-invalid='true'] { border-color: var(--destructive, red); }
	.field-error { color: var(--destructive, red); font-size: 0.8rem; }
	.form-error { color: var(--destructive, red); font-size: 0.9rem; margin-bottom: 0.75rem; }
	.form-actions { margin-top: 1rem; }
	.btn-primary { padding: 0.45rem 1rem; background: var(--primary, red); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; font-weight: 500; }
	.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
	.empty { font-size: 0.85rem; color: var(--muted-foreground, #6b7280); margin-bottom: 1rem; }
	.provider-list { list-style: none; padding: 0; margin: 0 0 1.25rem; display: flex; flex-direction: column; gap: 0.4rem; }
	.provider-item { display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; border-bottom: 1px solid var(--border, #e5e7eb); font-size: 0.9rem; }
	.provider-item:last-child { border-bottom: none; }
	.btn-danger-sm { padding: 0.25rem 0.6rem; background: var(--destructive, red); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
	.add-provider { border-top: 1px solid var(--border, #e5e7eb); padding-top: 1rem; margin-top: 0.5rem; }
	.inline-form { display: flex; align-items: flex-end; gap: 0.75rem; flex-wrap: wrap; }
	.inline-form .field { flex: 1; min-width: 180px; }
</style>
