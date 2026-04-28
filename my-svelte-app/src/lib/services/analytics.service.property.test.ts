/**
 * Property-based tests for AnalyticsService and NotificationService
 * Feature: jhaerin-tire-supply-ims
 *
 * Property 12: Inventory value calculation
 * Property 13: Profit margin calculation
 * Property 14: Low stock alert threshold
 *
 * Validates: Requirements 12.3, 13.1, 14.1, 17.1, 17.2
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import type { DBAdapter } from '$lib/db/db.interface.js';

// ── In-memory DBAdapter ───────────────────────────────────────────────────────

type Row = Record<string, unknown>;

class InMemoryDB implements DBAdapter {
	products: Row[] = [];
	notifications: Row[] = [];

	async query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
		const s = sql.trim().replace(/\s+/g, ' ');

		// getInventoryValue
		if (/COALESCE\(SUM\(quantity \* unit_cost_price\)/i.test(s)) {
			const total = this.products
				.filter((p) => !p.is_archived)
				.reduce((sum, p) => sum + (p.quantity as number) * (p.unit_cost_price as number), 0);
			return [{ total_value: total }] as unknown as T[];
		}

		// getProfitMargins
		if (/\(retail_price - unit_cost_price\) \/ retail_price \* 100 AS margin_percent/i.test(s)) {
			return this.products
				.filter((p) => !p.is_archived)
				.map((p) => ({
					id: p.id,
					brand: p.brand,
					size: p.size,
					pattern: p.pattern,
					retail_price: p.retail_price,
					unit_cost_price: p.unit_cost_price,
					margin_percent: ((p.retail_price as number) - (p.unit_cost_price as number)) / (p.retail_price as number) * 100
				})) as unknown as T[];
		}

		// checkLowStock
		if (/quantity <= COALESCE\(low_stock_threshold, \?\)/i.test(s)) {
			const globalThreshold = params[0] as number;
			return this.products
				.filter((p) => !p.is_archived && (p.quantity as number) <= ((p.low_stock_threshold as number | null) ?? globalThreshold)) as unknown as T[];
		}

		// notifications list
		if (/SELECT \* FROM notifications/i.test(s)) {
			return this.notifications as unknown as T[];
		}

		throw new Error(`InMemoryDB.query: unsupported SQL: ${sql}`);
	}

	async execute(sql: string, params: unknown[] = []): Promise<void> {
		const s = sql.trim().replace(/\s+/g, ' ');
		if (/^INSERT INTO notifications/i.test(s)) {
			const [id, type, message, , payload, createdAt] = params;
			this.notifications.push({ id, type, message, status: 'unread', payload, created_at: createdAt });
			return;
		}
		throw new Error(`InMemoryDB.execute: unsupported SQL: ${sql}`);
	}

	async transaction(fn: (tx: DBAdapter) => Promise<void>): Promise<void> {
		await fn(this);
	}

	seedProduct(id: string, qty: number, costPrice: number, retailPrice: number, threshold: number | null = null): void {
		this.products.push({ id, brand: 'B', size: 'S', pattern: 'P', quantity: qty, unit_cost_price: costPrice, retail_price: retailPrice, low_stock_threshold: threshold, is_archived: 0 });
	}
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('$lib/db/index.js', () => {
	let _db: InMemoryDB | null = null;
	return {
		getDb: async () => { if (!_db) _db = new InMemoryDB(); return _db; },
		__setDb: (db: InMemoryDB) => { _db = db; }
	};
});

// Mock notificationsStore to avoid Svelte store issues in Node
vi.mock('$lib/stores/notifications.store.js', () => ({
	notificationsStore: { update: () => {} }
}));

const { analyticsService } = await import('./analytics.service.js');
const { notificationService } = await import('./notification.service.js');
const dbModule = await import('$lib/db/index.js');
const setDb = (dbModule as unknown as { __setDb: (db: InMemoryDB) => void }).__setDb;

function freshDb(): InMemoryDB {
	const db = new InMemoryDB();
	setDb(db);
	return db;
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const arbPosInt = fc.integer({ min: 1, max: 500 });
const arbPrice = fc
	.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true, noDefaultInfinity: true })
	.map((v) => Math.round(v * 100) / 100);
const arbPricePair = fc.tuple(arbPrice, arbPrice).map(([a, b]) => ({
	costPrice: Math.min(a, b) || 1,
	retailPrice: Math.max(a, b) || 1
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AnalyticsService & NotificationService property tests', () => {

	/**
	 * Property 12: Inventory value calculation
	 * Validates: Requirements 12.3
	 */
	describe('Property 12: Inventory value calculation', () => {
		it('getInventoryValue equals SUM(quantity * unit_cost_price) for all active products', async () => {
			// Feature: jhaerin-tire-supply-ims, Property 12: Inventory value calculation
			await fc.assert(
				fc.asyncProperty(
					fc.array(fc.tuple(arbPosInt, arbPrice), { minLength: 1, maxLength: 20 }),
					async (products) => {
						const db = freshDb();
						let expectedTotal = 0;
						products.forEach(([qty, cost], i) => {
							db.seedProduct(`prod-${i}`, qty, cost, cost + 1);
							expectedTotal += qty * cost;
						});

						const value = await analyticsService.getInventoryValue();
						expect(value).toBeCloseTo(expectedTotal, 5);
					}
				),
				{ numRuns: 100 }
			);
		});
	});

	/**
	 * Property 13: Profit margin calculation
	 * Validates: Requirements 13.1
	 */
	describe('Property 13: Profit margin calculation', () => {
		it('margin = (P - C) / P * 100 and is always in [0, 100]', async () => {
			// Feature: jhaerin-tire-supply-ims, Property 13: Profit margin calculation
			await fc.assert(
				fc.asyncProperty(
					fc.array(arbPricePair, { minLength: 1, maxLength: 20 }),
					async (pairs) => {
						const db = freshDb();
						pairs.forEach(({ costPrice, retailPrice }, i) => {
							db.seedProduct(`prod-${i}`, 10, costPrice, retailPrice);
						});

						const margins = await analyticsService.getProfitMargins();
						expect(margins.length).toBe(pairs.length);

						margins.forEach((m, i) => {
							const { costPrice, retailPrice } = pairs[i];
							const expected = (retailPrice - costPrice) / retailPrice * 100;
							expect(m.marginPercent).toBeCloseTo(expected, 5);
							expect(m.marginPercent).toBeGreaterThanOrEqual(0);
							expect(m.marginPercent).toBeLessThanOrEqual(100);
						});
					}
				),
				{ numRuns: 100 }
			);
		});
	});

	/**
	 * Property 14: Low stock alert threshold
	 * Validates: Requirements 14.1, 17.1, 17.2
	 */
	describe('Property 14: Low stock alert threshold', () => {
		it('every product at or below effective threshold gets a low_stock notification', async () => {
			// Feature: jhaerin-tire-supply-ims, Property 14: Low stock alert threshold
			await fc.assert(
				fc.asyncProperty(
					fc.array(
						fc.record({
							qty: fc.integer({ min: 0, max: 20 }),
							threshold: fc.option(fc.integer({ min: 1, max: 15 }), { nil: null })
						}),
						{ minLength: 1, maxLength: 10 }
					),
					fc.integer({ min: 1, max: 10 }),
					async (products, globalThreshold) => {
						const db = freshDb();
						products.forEach(({ qty, threshold }, i) => {
							db.seedProduct(`prod-${i}`, qty, 100, 120, threshold);
						});

						await notificationService.checkLowStock(globalThreshold);

						// Every product at or below its effective threshold must have a notification
						const lowStockProducts = products.filter(({ qty, threshold }) => {
							const effective = threshold ?? globalThreshold;
							return qty <= effective;
						});

						expect(db.notifications.filter((n) => n.type === 'low_stock').length).toBe(lowStockProducts.length);
					}
				),
				{ numRuns: 100 }
			);
		});
	});
});
