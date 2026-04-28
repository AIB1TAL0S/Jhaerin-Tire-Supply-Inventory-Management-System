<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const { form, errors, enhance, submitting } = superForm(data.form);
</script>

<div class="auth-container">
	<h1>Register New User</h1>

	{#if $errors._errors}
		<p class="error-banner">{$errors._errors[0]}</p>
	{/if}

	<form method="POST" use:enhance>
		<div class="field">
			<label for="name">Full Name</label>
			<input
				id="name"
				name="name"
				type="text"
				bind:value={$form.name}
				aria-invalid={!!$errors.name}
				autocomplete="name"
			/>
			{#if $errors.name}
				<span class="field-error">{$errors.name[0]}</span>
			{/if}
		</div>

		<div class="field">
			<label for="email">Email</label>
			<input
				id="email"
				name="email"
				type="email"
				bind:value={$form.email}
				aria-invalid={!!$errors.email}
				autocomplete="email"
			/>
			{#if $errors.email}
				<span class="field-error">{$errors.email[0]}</span>
			{/if}
		</div>

		<div class="field">
			<label for="password">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				bind:value={$form.password}
				aria-invalid={!!$errors.password}
				autocomplete="new-password"
			/>
			{#if $errors.password}
				<span class="field-error">{$errors.password[0]}</span>
			{/if}
		</div>

		<div class="field">
			<label for="role">Role</label>
			<select id="role" name="role" bind:value={$form.role} aria-invalid={!!$errors.role}>
				<option value="owner">Owner</option>
				<option value="staff">Staff</option>
			</select>
			{#if $errors.role}
				<span class="field-error">{$errors.role[0]}</span>
			{/if}
		</div>

		<button type="submit" disabled={$submitting}>
			{$submitting ? 'Creating account…' : 'Create Account'}
		</button>
	</form>
</div>

<style>
	.auth-container {
		max-width: 400px;
		margin: 4rem auto;
		padding: 2rem;
	}

	h1 {
		margin-bottom: 1.5rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 1rem;
	}

	input,
	select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border, #ccc);
		border-radius: 4px;
		font-size: 1rem;
	}

	input[aria-invalid='true'],
	select[aria-invalid='true'] {
		border-color: red;
	}

	.field-error {
		color: red;
		font-size: 0.85rem;
	}

	.error-banner {
		color: red;
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}

	button {
		width: 100%;
		padding: 0.6rem;
		font-size: 1rem;
		cursor: pointer;
	}
</style>
