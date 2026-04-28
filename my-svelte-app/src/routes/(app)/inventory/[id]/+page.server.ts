import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { fail, redirect, error } from '@sveltejs/kit';
import { updateProductSchema } from '$lib/schemas/tire-product.schema';
import { inventoryService } from '$lib/services/inventory.service';
import { NotFoundError, ValidationError } from '$lib/errors';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	let product;
	try {
		product = await inventoryService.getProduct(params.id);
	} catch (err) {
		if (err instanceof NotFoundError) {
			error(404, 'Product not found');
		}
		throw err;
	}

	const form = await superValidate(
		{
			brand: product.brand,
			size: product.size,
			pattern: product.pattern,
			unitCostPrice: product.unitCostPrice,
			retailPrice: product.retailPrice,
			deliveryProviderId: product.deliveryProviderId,
			lowStockThreshold: product.lowStockThreshold
		},
		zod(updateProductSchema)
	);

	return { product, form };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const form = await superValidate(request, zod(updateProductSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await inventoryService.updateProduct(params.id, form.data);
		} catch (err) {
			if (err instanceof NotFoundError) {
				error(404, 'Product not found');
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

		redirect(303, '/inventory');
	},

	archive: async ({ params }) => {
		try {
			await inventoryService.archiveProduct(params.id);
		} catch (err) {
			if (err instanceof NotFoundError) {
				error(404, 'Product not found');
			}
			throw err;
		}

		redirect(303, '/inventory');
	}
};
