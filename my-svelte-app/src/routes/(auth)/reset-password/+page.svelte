<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const { form, errors, enhance, submitting } = superForm(data.form);
</script>

<div class="auth-container">
	<h1>Reset Password</h1>

	{#if data.submitted}
		<p class="confirmation">
			If that email is registered, you'll receive a reset link shortly. Check your inbox.
		</p>
		<p class="link-row"><a href="/login">Back to sign in</a></p>
	{:else}
		<p class="hint">Enter your email address and we'll send you a reset link.</p>

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

			<button type="submit" disabled={$submitting}>
				{$submitting ? 'Sending…' : 'Send Reset Link'}
			</button>

			<p class="link-row"><a href="/login">Back to sign in</a></p>
		</form>
	{/if}
</div>

<style>
	.auth-container {
		max-width: 400px;
		margin: 4rem auto;
		padding: 2rem;
	}

	h1 {
		margin-bottom: 1rem;
	}

	.hint {
		margin-bottom: 1.25rem;
		font-size: 0.95rem;
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

	.confirmation {
		padding: 1rem;
		background: var(--muted, #f0f0f0);
		border-radius: 4px;
		margin-bottom: 1rem;
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
