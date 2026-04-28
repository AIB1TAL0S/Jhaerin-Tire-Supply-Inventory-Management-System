import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { supabase } from '$lib/supabase';
import type { Actions, PageServerLoad } from './$types';

const resetSchema = z.object({
	email: z.string().email()
});

export const load: PageServerLoad = async () => {
	return {
		form: await superValidate(zod(resetSchema)),
		submitted: false
	};
};

export const actions: Actions = {
	default: async ({ request, url }) => {
		const form = await superValidate(request, zod(resetSchema));

		if (!form.valid) {
			return fail(400, { form, submitted: false });
		}

		const { email } = form.data;

		// Always call resetPasswordForEmail — ignore the result to avoid
		// leaking whether the email is registered (Req 3.2)
		await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${url.origin}/auth/callback`
		});

		// Return generic confirmation regardless of outcome (Req 3.2)
		return { form, submitted: true };
	}
};
