import { inventoryService } from '$lib/services/inventory.service';
import { analyticsService } from '$lib/services/analytics.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const to = url.searchParams.get('to') ?? new Date().toISOString().slice(0, 10);
	const from = url.searchParams.get('from') ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
	const period = { from, to };

	const [products, revenueSummary, topSelling, inventoryValue] = await Promise.all([
		inventoryService.listProducts({ limit: 1000 }),
		analyticsService.getRevenueSummary(period, 'month'),
		analyticsService.getTopSelling(period),
		analyticsService.getInventoryValue()
	]);

	return { products, revenueSummary, topSelling, inventoryValue, period };
};
