<script lang="ts">
	import { enhance } from '$app/forms';
	import RoleGuard from '$lib/components/RoleGuard.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let backing = $state(false);
	let restoring = $state(false);
</script>

<RoleGuard role="owner">
	<div class="page">
		<div class="page-header">
			<div>
				<a href="/settings" class="back-link">← Back to Settings</a>
				<h1>Data Backup &amp; Restore</h1>
			</div>
		</div>

		{#if form?.error}
			<p class="error-msg" role="alert">{form.error}</p>
		{/if}
		{#if form?.success}
			<p class="success-msg" role="status">
				{#if form.url}Backup created: <a href={form.url} target="_blank" rel="noopener">Download</a>{:else}Restore completed successfully.{/if}
			</p>
		{/if}

		<!-- Trigger backup -->
		<section class="card">
			<h2>Create Backup</h2>
			<p class="hint">Exports all local data to JSON and uploads to Supabase Storage.</p>
			<form method="POST" action="?/backup" use:enhance={() => { backing = true; return async ({ update }) => { backing = false; await update(); }; }}>
				<button type="submit" class="btn-primary" disabled={backing}>
					{backing ? 'Creating backup…' : 'Create Backup Now'}
				</button>
			</form>
		</section>

		<!-- Backup list & restore -->
		<section class="card">
			<h2>Available Backups</h2>
			{#if data.backups.length === 0}
				<p class="empty">No backups found. Create one above.</p>
			{:else}
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>Filename</th>
								<th>Created</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each data.backups as b (b.id)}
								<tr>
									<td class="mono">{b.name}</td>
									<td class="timestamp">{b.createdAt ? new Date(b.createdAt).toLocaleString() : '—'}</td>
									<td>
										<div class="row-actions">
											<a href={b.url} target="_blank" rel="noopener" class="action-link">Download</a>
											<form method="POST" action="?/restore" use:enhance={() => {
												if (!confirm('Restore this backup? This will overwrite all current data.')) return () => {};
												restoring = true;
												return async ({ update }) => { restoring = false; await update(); };
											}}>
												<input type="hidden" name="url" value={b.url} />
												<button type="submit" class="btn-danger-sm" disabled={restoring}>
													{restoring ? 'Restoring…' : 'Restore'}
												</button>
											</form>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	</div>
</RoleGuard>

<style>
	.page { display: flex; flex-direction: column; gap: 1.5rem; }
	.page-header { display: flex; align-items: flex-start; gap: 1rem; }
	.back-link { font-size: 0.85rem; color: var(--muted-foreground, #888); text-decoration: none; display: block; margin-bottom: 0.25rem; }
	.back-link:hover { text-decoration: underline; }
	h1 { font-size: 1.5rem; font-weight: 700; }
	h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.75rem; }
	.card { background: var(--card, #fff); border: 1px solid var(--border, #ccc); border-radius: 6px; padding: 1.25rem; }
	.hint { font-size: 0.85rem; color: var(--muted-foreground, #6b7280); margin-bottom: 1rem; }
	.empty { font-size: 0.85rem; color: var(--muted-foreground, #6b7280); }
	.error-msg { font-size: 0.9rem; color: var(--destructive, red); background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 0.75rem 1rem; white-space: pre-wrap; }
	.success-msg { font-size: 0.9rem; color: #16a34a; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 0.75rem 1rem; }
	.btn-primary { padding: 0.45rem 1rem; background: var(--primary, red); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; font-weight: 500; }
	.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn-danger-sm { padding: 0.25rem 0.6rem; background: var(--destructive, red); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
	.btn-danger-sm:disabled { opacity: 0.6; cursor: not-allowed; }
	.table-wrap { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
	th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border, #ccc); font-weight: 600; white-space: nowrap; }
	td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border, #e5e7eb); vertical-align: middle; }
	tr:last-child td { border-bottom: none; }
	.mono { font-family: monospace; font-size: 0.8rem; word-break: break-all; }
	.timestamp { white-space: nowrap; font-size: 0.85rem; }
	.row-actions { display: flex; align-items: center; gap: 0.75rem; }
	.action-link { color: var(--primary, red); font-size: 0.85rem; text-decoration: none; }
	.action-link:hover { text-decoration: underline; }
</style>
