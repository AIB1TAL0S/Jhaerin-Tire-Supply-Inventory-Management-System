import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { fail } from '@sveltejs/kit';
import { stockInSchema } from '$lib/schemas/stock-in.schema';
import { stockService } from '$lib/services/stock.service';
import { inventoryService } from '$lib/services/inventory.service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const offset = Number(url.searchParams.get('offset') ?? 0);
	const [transactions, products, form] = await Promise.all([
		stockService.listStockIn({ limit: 50, offset }),
		inventoryService.listProducts({}),
		superValidate(zod(stockInSchema))
	]);

	return { transactions, products, form, offset };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await superValidate(request, zod(stockInSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await stockService.createStockIn(form.data);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create stock-in transaction.';
			return fail(500, {
				form: {
					...form,
					errors: { ...form.errors, _errors: [message] }
				}
			});
		}

		const freshForm = await superValidate(zod(stockInSchema));
		return { form: freshForm, success: true };
	}
};
