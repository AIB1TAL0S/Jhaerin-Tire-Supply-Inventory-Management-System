import { getDb } from '$lib/db/index.js';
import { notificationService } from '$lib/services/notification.service.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DateRange {
	from: string; // ISO date string
	to: string;   // ISO date string
}

export interface ProductRank {
	tireProductId: string;
	brand: string;
	size: string;
	pattern: string;
	totalSold: number;
}

export interface RevenueSummary {
	period: string;
	revenue: number;
	grossProfit: number;
}

export interface ProfitMargin {
	tireProductId: string;
	brand: string;
	size: string;
	pattern: string;
	retailPrice: number;
	unitCostPrice: number;
	marginPercent: number;
}

export interface ForecastPoint {
	date: string;
	predictedSales: number;
}

export interface ForecastResult {
	forecast: ForecastPoint[];
	insufficientData?: boolean;
	notice?: string;
}

export type ReportType = 'inventory' | 'sales' | 'revenue' | 'profit';

// ── Helpers ──────────────────────────────────────────────────────────────────

function granularityFormat(granularity: 'day' | 'week' | 'month'): string {
	switch (granularity) {
		case 'day':   return `strftime('%Y-%m-%d', transaction_date)`;
		case 'week':  return `strftime('%Y-W%W', transaction_date)`;
		case 'month': return `strftime('%Y-%m', transaction_date)`;
	}
}

// ── Service ──────────────────────────────────────────────────────────────────

export const analyticsService = {
	/**
	 * Top-selling products ranked by total quantity sold within the period.
	 * Validates: Requirements 12.1
	 */
	async getTopSelling(period: DateRange): Promise<ProductRank[]> {
		const db = await getDb();
		const rows = await db.query<Record<string, unknown>>(
			`SELECT
				st.tire_product_id,
				tp.brand,
				tp.size,
				tp.pattern,
				SUM(st.quantity_sold) AS total_sold
			FROM sales_transactions st
			JOIN tire_products tp ON tp.id = st.tire_product_id
			WHERE st.transaction_date >= ? AND st.transaction_date <= ?
			GROUP BY st.tire_product_id
			ORDER BY total_sold DESC`,
			[period.from, period.to]
		);
		return rows.map((r) => ({
			tireProductId: r.tire_product_id as string,
			brand: r.brand as string,
			size: r.size as string,
			pattern: r.pattern as string,
			totalSold: r.total_sold as number,
		}));
	},

	/**
	 * Least-selling products ranked by total quantity sold within the period.
	 * Validates: Requirements 12.2
	 */
	async getLeastSelling(period: DateRange): Promise<ProductRank[]> {
		const db = await getDb();
		const rows = await db.query<Record<string, unknown>>(
			`SELECT
				st.tire_product_id,
				tp.brand,
				tp.size,
				tp.pattern,
				SUM(st.quantity_sold) AS total_sold
			FROM sales_transactions st
			JOIN tire_products tp ON tp.id = st.tire_product_id
			WHERE st.transaction_date >= ? AND st.transaction_date <= ?
			GROUP BY st.tire_product_id
			ORDER BY total_sold ASC`,
			[period.from, period.to]
		);
		return rows.map((r) => ({
			tireProductId: r.tire_product_id as string,
			brand: r.brand as string,
			size: r.size as string,
			pattern: r.pattern as string,
			totalSold: r.total_sold as number,
		}));
	},

	/**
	 * Total inventory value = SUM(quantity * unit_cost_price) for active products.
	 * Validates: Requirements 12.3
	 */
	async getInventoryValue(): Promise<number> {
		const db = await getDb();
		const rows = await db.query<Record<string, unknown>>(
			`SELECT COALESCE(SUM(quantity * unit_cost_price), 0) AS total_value
			FROM tire_products
			WHERE is_archived = 0`
		);
		return (rows[0]?.total_value as number) ?? 0;
	},

	/**
	 * Revenue and gross profit aggregated by day / week / month.
	 * Validates: Requirements 12.4
	 */
	async getRevenueSummary(
		period: DateRange,
		granularity: 'day' | 'week' | 'month'
	): Promise<RevenueSummary[]> {
		const db = await getDb();
		const fmt = granularityFormat(granularity);
		const rows = await db.query<Record<string, unknown>>(
			`SELECT
				${fmt} AS period,
				SUM(revenue) AS revenue,
				SUM(gross_profit) AS gross_profit
			FROM sales_transactions
			WHERE transaction_date >= ? AND transaction_date <= ?
			GROUP BY ${fmt}
			ORDER BY period ASC`,
			[period.from, period.to]
		);
		return rows.map((r) => ({
			period: r.period as string,
			revenue: r.revenue as number,
			grossProfit: r.gross_profit as number,
		}));
	},

	/**
	 * Profit margin per product = (retail_price - unit_cost_price) / retail_price * 100.
	 * Validates: Requirements 13.1
	 */
	async getProfitMargins(): Promise<ProfitMargin[]> {
		const db = await getDb();
		const rows = await db.query<Record<string, unknown>>(
			`SELECT
				id,
				brand,
				size,
				pattern,
				retail_price,
				unit_cost_price,
				(retail_price - unit_cost_price) / retail_price * 100 AS margin_percent
			FROM tire_products
			WHERE is_archived = 0
			ORDER BY margin_percent DESC`
		);
		return rows.map((r) => ({
			tireProductId: r.id as string,
			brand: r.brand as string,
			size: r.size as string,
			pattern: r.pattern as string,
			retailPrice: r.retail_price as number,
			unitCostPrice: r.unit_cost_price as number,
			marginPercent: r.margin_percent as number,
		}));
	},

	/**
	 * Inventory turnover = total quantity sold / average inventory for the period.
	 * Validates: Requirements 13.2
	 */
	async getInventoryTurnover(period: DateRange): Promise<number> {
		const db = await getDb();

		const soldRows = await db.query<Record<string, unknown>>(
			`SELECT COALESCE(SUM(quantity_sold), 0) AS total_sold
			FROM sales_transactions
			WHERE transaction_date >= ? AND transaction_date <= ?`,
			[period.from, period.to]
		);
		const totalSold = (soldRows[0]?.total_sold as number) ?? 0;

		const avgRows = await db.query<Record<string, unknown>>(
			`SELECT COALESCE(AVG(quantity), 0) AS avg_inventory
			FROM tire_products
			WHERE is_archived = 0`
		);
		const avgInventory = (avgRows[0]?.avg_inventory as number) ?? 0;

		if (avgInventory === 0) return 0;
		return totalSold / avgInventory;
	},

	/**
	 * Linear regression forecast over historical daily sales.
	 * Returns notice when fewer than 30 days of data exist.
	 * Validates: Requirements 13.5, 13.6
	 */
	async getSalesForecast(period?: DateRange): Promise<ForecastResult> {
		const db = await getDb();

		// Default: last 90 days if no period given
		const to = period?.to ?? new Date().toISOString().slice(0, 10);
		const from = period?.from ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

		const rows = await db.query<Record<string, unknown>>(
			`SELECT
				strftime('%Y-%m-%d', transaction_date) AS day,
				SUM(quantity_sold) AS daily_sold
			FROM sales_transactions
			WHERE transaction_date >= ? AND transaction_date <= ?
			GROUP BY day
			ORDER BY day ASC`,
			[from, to]
		);

		if (rows.length < 30) {
			return {
				forecast: [],
				insufficientData: true,
				notice: 'Insufficient data for forecast (fewer than 30 days of history)',
			};
		}

		// Build numeric x-axis (0-based index) and y values
		const n = rows.length;
		const ys = rows.map((r) => r.daily_sold as number);
		const xs = ys.map((_, i) => i);

		const sumX  = xs.reduce((a, b) => a + b, 0);
		const sumY  = ys.reduce((a, b) => a + b, 0);
		const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
		const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);

		const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
		const intercept = (sumY - slope * sumX) / n;

		// Project 30 days forward from the last data point
		const lastDate = new Date(rows[rows.length - 1].day as string);
		const forecast: ForecastPoint[] = [];

		for (let i = 1; i <= 30; i++) {
			const futureDate = new Date(lastDate);
			futureDate.setDate(futureDate.getDate() + i);
			const predicted = Math.max(0, intercept + slope * (n - 1 + i));
			forecast.push({
				date: futureDate.toISOString().slice(0, 10),
				predictedSales: Math.round(predicted * 100) / 100,
			});
		}

		return { forecast };
	},

	/**
	 * Generate a JSON report and upload to Supabase Storage.
	 * Returns the public URL (or a data URL fallback if Supabase is not configured).
	 * Creates a `report_ready` notification on success.
	 * Validates: Requirements 12.6, 12.7
	 */
	async exportReport(type: ReportType, period: DateRange): Promise<string> {
		// Build report data
		let reportData: unknown;

		switch (type) {
			case 'inventory':
				reportData = {
					type,
					generatedAt: new Date().toISOString(),
					inventoryValue: await this.getInventoryValue(),
					profitMargins: await this.getProfitMargins(),
				};
				break;
			case 'sales':
				reportData = {
					type,
					period,
					generatedAt: new Date().toISOString(),
					topSelling: await this.getTopSelling(period),
					leastSelling: await this.getLeastSelling(period),
				};
				break;
			case 'revenue':
				reportData = {
					type,
					period,
					generatedAt: new Date().toISOString(),
					daily: await this.getRevenueSummary(period, 'day'),
					weekly: await this.getRevenueSummary(period, 'week'),
					monthly: await this.getRevenueSummary(period, 'month'),
				};
				break;
			case 'profit':
				reportData = {
					type,
					period,
					generatedAt: new Date().toISOString(),
					profitMargins: await this.getProfitMargins(),
					inventoryTurnover: await this.getInventoryTurnover(period),
				};
				break;
		}

		const json = JSON.stringify(reportData, null, 2);
		const filename = `reports/${type}-${period.from}-${period.to}-${Date.now()}.json`;

		let url: string;

		try {
			// Dynamically import supabase to avoid SSR issues
			const { supabase } = await import('$lib/supabase.js');

			const blob = new Blob([json], { type: 'application/json' });
			const { error } = await supabase.storage.from('reports').upload(filename, blob, {
				contentType: 'application/json',
				upsert: false,
			});

			if (error) throw error;

			const { data: urlData } = supabase.storage.from('reports').getPublicUrl(filename);
			url = urlData.publicUrl;
		} catch {
			// Fallback: data URL when Supabase is not configured or upload fails
			url = `data:application/json;base64,${btoa(unescape(encodeURIComponent(json)))}`;
		}

		// Create report_ready notification
		await notificationService.createNotification(
			'report_ready',
			`Report "${type}" for ${period.from} – ${period.to} is ready.`,
			{ type, period, url }
		);

		return url;
	},
};
