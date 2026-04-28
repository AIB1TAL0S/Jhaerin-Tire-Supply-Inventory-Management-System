import { analyticsService } from '$lib/services/analytics.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const to = url.searchParams.get('to') ?? new Date().toISOString().slice(0, 10);
	const from = url.searchParams.get('from') ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
	const period = { from, to };

	const [topSelling, leastSelling, profitMargins, revenueSummary, forecast] = await Promise.all([
		analyticsService.getTopSelling(period),
		analyticsService.getLeastSelling(period),
		analyticsService.getProfitMargins(),
		analyticsService.getRevenueSummary(period, 'month'),
		analyticsService.getSalesForecast()
	]);

	return { topSelling, leastSelling, profitMargins, revenueSummary, forecast, period };
};
