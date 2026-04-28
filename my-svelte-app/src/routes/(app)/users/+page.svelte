<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { goto } from '$app/navigation';
	import RoleGuard from '$lib/components/RoleGuard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const sf = superForm(data.form, {
		action: '?/create',
		onResult({ result }) {
			if (result.type === 'redirect' || result.type === 'success') {
				goto('/users', { invalidateAll: true });
			}
		}
	});
	const { form, errors, enhance, submitting } = sf;

	let search = $state('');
	let filterRole = $state('all');
	let filterActive = $state('all');
	let showCreateForm = $state(false);

	const filtered = $derived(
		data.users.filter((u) => {
			const matchSearch = !search || u.email.toLowerCase().includes(search.toLowerCase());
			const matchRole = filterRole === 'all' || u.role === filterRole;
			const matchActive = filterActive === 'all' || (filterActive === 'active' ? u.is_active : !u.is_active);
			return matchSearch && matchRole && matchActive;
		})
	);
</script>

<RoleGuard role="owner">
	<div class="page">
		<div class="page-header">
			<h1>User Management</h1>
			<button class="btn-primary" onclick={() => (showCreateForm = !showCreateForm)}>
				{showCreateForm ? 'Cancel' : '+ New User'}
			</button>
		</div>

		{#if showCreateForm}
			<section class="card">
				<h2>Create New User</h2>
				{#if $errors._errors}<p class="form-error">{$errors._errors[0]}</p>{/if}
				<form method="POST" action="?/create" use:enhance>
					<div class="form-grid">
						<div class="field">
							<label for="name">Full Name</label>
							<input id="name" name="name" type="text" bind:value={$form.name} aria-invalid={!!$errors.name} autocomplete="name" />
							{#if $errors.name}<span class="field-error">{$errors.name[0]}</span>{/if}
						</div>
						<div class="field">
							<label for="email">Email</label>
							<input id="email" name="email" type="email" bind:value={$form.email} aria-invalid={!!$errors.email} autocomplete="email" />
							{#if $errors.email}<span class="field-error">{$errors.email[0]}</span>{/if}
						</div>
						<div class="field">
							<label for="password">Password</label>
							<input id="password" name="password" type="password" bind:value={$form.password} aria-invalid={!!$errors.password} autocomplete="new-password" />
							{#if $errors.password}<span class="field-error">{$errors.password[0]}</span>{/if}
						</div>
						<div class="field">
							<label for="role">Role</label>
							<select id="role" name="role" bind:value={$form.role} aria-invalid={!!$errors.role}>
								<option value="owner">Owner</option>
								<option value="staff">Staff</option>
							</select>
							{#if $errors.role}<span class="field-error">{$errors.role[0]}</span>{/if}
						</div>
					</div>
					<div class="form-actions">
						<button type="submit" class="btn-primary" disabled={$submitting}>{$submitting ? 'Creating…' : 'Create User'}</button>
					</div>
				</form>
			</section>
		{/if}

		<section class="card">
			<div class="list-header">
				<h2>Users</h2>
				<div class="filters">
					<input type="search" placeholder="Search by email…" bind:value={search} aria-label="Search users" />
					<select bind:value={filterRole} aria-label="Filter by role">
						<option value="all">All roles</option>
						<option value="owner">Owner</option>
						<option value="staff">Staff</option>
					</select>
					<select bind:value={filterActive} aria-label="Filter by status">
						<option value="all">All statuses</option>
						<option value="active">Active</option>
						<option value="inactive">Inactive</option>
					</select>
				</div>
			</div>

			{#if filtered.length === 0}
				<p class="empty">No users found.</p>
			{:else}
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>Email</th>
								<th>Role</th>
								<th>Status</th>
								<th>Created</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each filtered as u (u.id)}
								<tr>
									<td>{u.email}</td>
									<td><span class="badge badge-{u.role}">{u.role}</span></td>
									<td><span class="badge {u.is_active ? 'badge-active' : 'badge-inactive'}">{u.is_active ? 'Active' : 'Inactive'}</span></td>
									<td class="timestamp">{new Date(u.created_at).toLocaleDateString()}</td>
									<td>
										{#if u.is_active}
											<form method="POST" action="?/deactivate" style="display:inline">
												<input type="hidden" name="id" value={u.id} />
												<button type="submit" class="btn-danger-sm" onclick={(e) => { if (!confirm('Deactivate this user?')) e.preventDefault(); }}>Deactivate</button>
											</form>
										{/if}
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
	.page-header { display: flex; align-items: center; justify-content: space-between; }
	h1 { font-size: 1.5rem; font-weight: 700; }
	h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; }
	.card { background: var(--card, #fff); border: 1px solid var(--border, #ccc); border-radius: 6px; padding: 1.25rem; }
	.form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
	.field { display: flex; flex-direction: column; gap: 0.25rem; }
	label { font-size: 0.85rem; font-weight: 500; }
	input, select { padding: 0.4rem 0.6rem; border: 1px solid var(--border, #ccc); border-radius: 4px; font-size: 0.9rem; background: var(--input, #fff); color: var(--foreground, #000); }
	input[aria-invalid='true'], select[aria-invalid='true'] { border-color: var(--destructive, red); }
	.field-error { color: var(--destructive, red); font-size: 0.8rem; }
	.form-error { color: var(--destructive, red); font-size: 0.9rem; margin-bottom: 0.75rem; }
	.form-actions { margin-top: 1rem; }
	.btn-primary { padding: 0.45rem 1rem; background: var(--primary, red); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; font-weight: 500; }
	.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn-danger-sm { padding: 0.25rem 0.6rem; background: var(--destructive, red); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
	.list-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
	.list-header h2 { margin-bottom: 0; }
	.filters { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.filters input, .filters select { padding: 0.35rem 0.6rem; font-size: 0.85rem; }
	.empty { font-size: 0.85rem; color: var(--muted-foreground, #6b7280); }
	.table-wrap { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
	th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border, #ccc); font-weight: 600; white-space: nowrap; }
	td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border, #e5e7eb); vertical-align: middle; }
	tr:last-child td { border-bottom: none; }
	.badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
	.badge-owner { background: #7c3aed; color: #fff; }
	.badge-staff { background: var(--muted, #e5e7eb); color: var(--muted-foreground, #374151); }
	.badge-active { background: #16a34a; color: #fff; }
	.badge-inactive { background: var(--muted, #e5e7eb); color: var(--muted-foreground, #6b7280); }
	.timestamp { white-space: nowrap; font-size: 0.85rem; }
</style>
