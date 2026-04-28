import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { fail, redirect } from '@sveltejs/kit';
import { loginSchema } from '$lib/schemas/user.schema';
import { supabase } from '$lib/supabase';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { form: await superValidate(zod(loginSchema)) };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod(loginSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const { email, password } = form.data;

		const { error } = await supabase.auth.signInWithPassword({ email, password });

		if (error) {
			// Do not reveal which field is wrong — use a generic message (Req 1.2)
			return fail(401, {
				form: {
					...form,
					errors: { ...form.errors, _errors: ['Invalid email or password.'] }
				}
			});
		}

		redirect(303, '/dashboard');
	}
};
