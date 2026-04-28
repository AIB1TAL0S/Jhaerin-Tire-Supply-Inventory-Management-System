import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { fail } from '@sveltejs/kit';
import { saleSchema } from '$lib/schemas/sales.schema';
import { salesService } from '$lib/services/sales.service';
import { inventoryService } from '$lib/services/inventory.service';
import { InsufficientStockError } from '$lib/errors';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const offset = Number(url.searchParams.get('offset') ?? 0);
	const [sales, products, form] = await Promise.all([
		salesService.listSales({ limit: 50, offset }),
		inventoryService.listProducts({}),
		superValidate(zod(saleSchema))
	]);
	return { sales, products, form, offset };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await superValidate(request, zod(saleSchema));
		if (!form.valid) return fail(400, { form });

		try {
			await salesService.createSale(form.data);
		} catch (err) {
			if (err instanceof InsufficientStockError) {
				return fail(422, { form: { ...form, errors: { ...form.errors, _errors: [err.message] } } });
			}
			const message = err instanceof Error ? err.message : 'Failed to create sale.';
			return fail(500, { form: { ...form, errors: { ...form.errors, _errors: [message] } } });
		}

		const freshForm = await superValidate(zod(saleSchema));
		return { form: freshForm, success: true };
	}
};
