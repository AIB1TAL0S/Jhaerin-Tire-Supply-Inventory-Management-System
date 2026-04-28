import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { fail } from '@sveltejs/kit';
import { stockOutSchema } from '$lib/schemas/stock-out.schema';
import { stockService } from '$lib/services/stock.service';
import { inventoryService } from '$lib/services/inventory.service';
import { InsufficientStockError } from '$lib/errors';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const offset = Number(url.searchParams.get('offset') ?? 0);
	const [transactions, products, form] = await Promise.all([
		stockService.listStockOut({ limit: 50, offset }),
		inventoryService.listProducts({}),
		superValidate(zod(stockOutSchema))
	]);

	return { transactions, products, form, offset };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await superValidate(request, zod(stockOutSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await stockService.createStockOut(form.data);
		} catch (err) {
			if (err instanceof InsufficientStockError) {
				return fail(422, {
					form: {
						...form,
						errors: { ...form.errors, _errors: [err.message] }
					}
				});
			}
			const message = err instanceof Error ? err.message : 'Failed to create stock-out transaction.';
			return fail(500, {
				form: {
					...form,
					errors: { ...form.errors, _errors: [message] }
				}
			});
		}

		const freshForm = await superValidate(zod(stockOutSchema));
		return { form: freshForm, success: true };
	}
};
