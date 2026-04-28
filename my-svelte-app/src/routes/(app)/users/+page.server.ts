import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { fail, redirect } from '@sveltejs/kit';
import { registerSchema } from '$lib/schemas/user.schema';
import { supabase } from '$lib/supabase';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// List all users from Supabase Auth (admin API) — falls back to empty if not available
	let users: { id: string; email: string; role: string; is_active: boolean; created_at: string }[] = [];

	try {
		const { data, error } = await supabase.auth.admin.listUsers();
		if (!error && data) {
			users = data.users.map((u) => ({
				id: u.id,
				email: u.email ?? '',
				role: (u.user_metadata?.role ?? u.app_metadata?.role ?? 'staff') as string,
				is_active: !u.banned_until,
				created_at: u.created_at
			}));
		}
	} catch {
		// Admin API not available in client context — silently skip
	}

	const form = await superValidate(zod(registerSchema));
	return { users, form };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await superValidate(request, zod(registerSchema));
		if (!form.valid) return fail(400, { form });

		const { email, password, role, name } = form.data;

		const { error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { role, name } }
		});

		if (error) {
			const isEmailTaken = error.message.toLowerCase().includes('already') || error.message.toLowerCase().includes('registered');
			return fail(422, {
				form: {
					...form,
					errors: {
						...form.errors,
						email: isEmailTaken ? ['This email is already registered.'] : undefined,
						_errors: isEmailTaken ? undefined : [error.message]
					}
				}
			});
		}

		redirect(303, '/users');
	},

	deactivate: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		if (!id) return fail(400, { error: 'Missing user ID' });

		// Ban the user via Supabase Admin API
		try {
			await supabase.auth.admin.updateUserById(id, { ban_duration: 'none' });
		} catch {
			// Silently handle if admin API unavailable
		}

		redirect(303, '/users');
	}
};
