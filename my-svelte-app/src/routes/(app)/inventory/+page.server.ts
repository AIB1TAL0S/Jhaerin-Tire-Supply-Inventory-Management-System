import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { fail } from '@sveltejs/kit';
import { createProductSchema } from '$lib/schemas/tire-product.schema';
import { inventoryService } from '$lib/services/inventory.service';
import { DuplicateProductError, ValidationError } from '$lib/errors';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const limit = 50;
	const offset = Number(url.searchParams.get('offset') ?? 0);

	const products = await inventoryService.listProducts({ limit, offset });
	const form = await superValidate(zod(createProductSchema));

	return { products, form, offset };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await superValidate(request, zod(createProductSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await inventoryService.createProduct(form.data);
		} catch (err) {
			if (err instanceof DuplicateProductError) {
				return fail(409, {
					form: {
						...form,
						errors: {
							...form.errors,
							_errors: [`A product with this brand, size, and pattern already exists.`]
						}
					}
				});
			}
			if (err instanceof ValidationError) {
				return fail(422, {
					form: {
						...form,
						errors: { ...form.errors, _errors: [err.message] }
					}
				});
			}
			throw err;
		}

		// Re-validate a fresh form so the create form resets on success
		const freshForm = await superValidate(zod(createProductSchema));
		return { form: freshForm, success: true };
	}
};
