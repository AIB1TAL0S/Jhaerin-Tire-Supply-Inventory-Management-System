<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const { form, errors, enhance, submitting, message } = superForm(data.form);
</script>

<div class="auth-container">
	<h1>Sign In</h1>

	{#if $errors._errors}
		<p class="error-banner">{$errors._errors[0]}</p>
	{/if}

	<form method="POST" use:enhance>
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
				autocomplete="current-password"
			/>
			{#if $errors.password}
				<span class="field-error">{$errors.password[0]}</span>
			{/if}
		</div>

		<button type="submit" disabled={$submitting}>
			{$submitting ? 'Signing in…' : 'Sign In'}
		</button>

		<p class="link-row">
			<a href="/reset-password">Forgot password?</a>
		</p>
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

	input {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border, #ccc);
		border-radius: 4px;
		font-size: 1rem;
	}

	input[aria-invalid='true'] {
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

	.link-row {
		margin-top: 1rem;
		text-align: center;
		font-size: 0.9rem;
	}
</style>
