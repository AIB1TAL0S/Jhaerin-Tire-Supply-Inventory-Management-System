import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { fail, redirect } from '@sveltejs/kit';
import { registerSchema } from '$lib/schemas/user.schema';
import { supabase } from '$lib/supabase';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Owner-only guard (Req 2.1, 5.1)
	const {
		data: { session }
	} = await supabase.auth.getSession();

	const role =
		session?.user?.user_metadata?.role ?? session?.user?.app_metadata?.role ?? null;

	if (!session || role !== 'owner') {
		redirect(303, '/dashboard');
	}

	return { form: await superValidate(zod(registerSchema)) };
};

export const actions: Actions = {
	default: async ({ request }) => {
		// Re-check owner guard on action (Req 5.1)
		const {
			data: { session }
		} = await supabase.auth.getSession();

		const role =
			session?.user?.user_metadata?.role ?? session?.user?.app_metadata?.role ?? null;

		if (!session || role !== 'owner') {
			redirect(303, '/dashboard');
		}

		const form = await superValidate(request, zod(registerSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const { email, password, role: assignedRole, name } = form.data;

		const { error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: { role: assignedRole, name }
			}
		});

		if (error) {
			const isEmailTaken =
				error.message.toLowerCase().includes('already') ||
				error.message.toLowerCase().includes('registered');

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

		// Redirect back to user management after successful registration
		redirect(303, '/users');
	}
};
