/**
 * Property-based tests for StockService (Stock-In operations)
 * Feature: jhaerin-tire-supply-ims
 *
 * Property 1:  Stock-In quantity invariant
 * Property 8:  Stock-In edit recalculation
 * Property 11: Stock-In delete decrements quantity
 * Property 2:  Stock-Out quantity invariant (valid case)
 * Property 3:  Stock-Out rejection when insufficient
 *
 * Validates: Requirements 9.1, 9.3, 9.4, 10.1, 10.3, 18.5
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import type { DBAdapter } from '$lib/db/db.interface.js';
import { InsufficientStockError, NotFoundError } from '$lib/errors.js';

// ── In-memory DBAdapter ───────────────────────────────────────────────────────

type Row = Record<string, unknown>;

class InMemoryDB implements DBAdapter {
	private tables: Map<string, Row[]> = new Map();

	private getTable(name: string): Row[] {
		if (!this.tables.has(name)) this.tables.set(name, []);
		return this.tables.get(name)!;
	}

	async query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
		const s = sql.trim().replace(/\s+/g, ' ');

		if (/SELECT \* FROM stock_in_transactions WHERE id = \?/i.test(s)) {
			return this.getTable('stock_in_transactions').filter((r) => r.id === params[0]) as unknown as T[];
		}
		if (/SELECT \* FROM stock_out_transactions WHERE id = \?/i.test(s)) {
			return this.getTable('stock_out_transactions').filter((r) => r.id === params[0]) as unknown as T[];
		}
		if (/SELECT id, quantity FROM tire_products WHERE id = \?/i.test(s)) {
			return this.getTable('tire_products').filter((r) => r.id === params[0]).map((r) => ({ id: r.id, quantity: r.quantity })) as unknown as T[];
		}
		throw new Error(`InMemoryDB.query: unsupported SQL: ${sql}`);
	}

	async execute(sql: string, params: unknown[] = []): Promise<void> {
		const s = sql.trim().replace(/\s+/g, ' ');

		if (/^INSERT INTO stock_in_transactions/i.test(s)) {
			const [id, tpId, dpId, qty, td, notes, ca, ua] = params;
			this.getTable('stock_in_transactions').push({ id, tire_product_id: tpId, delivery_provider_id: dpId, quantity: qty, transaction_date: td, notes, created_at: ca, updated_at: ua });
			return;
		}
		if (/^INSERT INTO stock_out_transactions/i.test(s)) {
			const [id, tpId, qty, reason, td, ca, ua] = params;
			this.getTable('stock_out_transactions').push({ id, tire_product_id: tpId, quantity: qty, reason, transaction_date: td, created_at: ca, updated_at: ua });
			return;
		}
		if (/^UPDATE tire_products SET quantity = quantity \+ \?/i.test(s)) {
			const [delta, , id] = params;
			const row = this.getTable('tire_products').find((r) => r.id === id);
			if (row) row.quantity = (row.quantity as number) + (delta as number);
			return;
		}
		if (/^UPDATE tire_products SET quantity = quantity - \?/i.test(s)) {
			const [delta, , id] = params;
			const row = this.getTable('tire_products').find((r) => r.id === id);
			if (row) row.quantity = (row.quantity as number) - (delta as number);
			return;
		}
		if (/^UPDATE stock_in_transactions/i.test(s)) {
			const [tpId, dpId, qty, td, notes, ua, id] = params;
			const row = this.getTable('stock_in_transactions').find((r) => r.id === id);
			if (row) { row.tire_product_id = tpId; row.delivery_provider_id = dpId; row.quantity = qty; row.transaction_date = td; row.notes = notes; row.updated_at = ua; }
			return;
		}
		if (/^DELETE FROM stock_in_transactions WHERE id = \?/i.test(s)) {
			const t = this.getTable('stock_in_transactions');
			const idx = t.findIndex((r) => r.id === params[0]);
			if (idx !== -1) t.splice(idx, 1);
			return;
		}
		if (/^DELETE FROM stock_out_transactions WHERE id = \?/i.test(s)) {
			const t = this.getTable('stock_out_transactions');
			const idx = t.findIndex((r) => r.id === params[0]);
			if (idx !== -1) t.splice(idx, 1);
			return;
		}
		throw new Error(`InMemoryDB.execute: unsupported SQL: ${sql}`);
	}

	async transaction(fn: (tx: DBAdapter) => Promise<void>): Promise<void> {
		await fn(this);
	}

	seedProduct(id: string, quantity: number): void {
		this.getTable('tire_products').push({ id, brand: 'B', size: 'S', pattern: 'P', quantity, unit_cost_price: 100, retail_price: 120, delivery_provider_id: null, low_stock_threshold: null, is_archived: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
	}

	getQty(id: string): number {
		const row = this.getTable('tire_products').find((r) => r.id === id);
		return row ? (row.quantity as number) : -1;
	}
}

// ── Mock ──────────────────────────────────────────────────────────────────────

vi.mock('$lib/db/index.js', () => {
	let _db: InMemoryDB | null = null;
	return {
		getDb: async () => { if (!_db) _db = new InMemoryDB(); return _db; },
		__setDb: (db: InMemoryDB) => { _db = db; }
	};
});

const { stockService } = await import('./stock.service.js');
const dbModule = await import('$lib/db/index.js');
const setDb = (dbModule as unknown as { __setDb: (db: InMemoryDB) => void }).__setDb;

function freshDb(productId: string, qty: number): InMemoryDB {
	const db = new InMemoryDB();
	db.seedProduct(productId, qty);
	setDb(db);
	return db;
}

const PRODUCT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TX_DATE = '2024-06-01T10:00:00.000Z';
const arbPosInt = fc.integer({ min: 1, max: 500 });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StockService property tests', () => {

	/**
	 * Property 1: Stock-In quantity invariant
	 * Validates: Requirements 9.1
	 */
	describe('Property 1: Stock-In quantity invariant', () => {
		it('product quantity equals Q + N after createStockIn', async () => {
			// Feature: jhaerin-tire-supply-ims, Property 1: Stock-In quantity invariant
			await fc.assert(
				fc.asyncProperty(arbPosInt, arbPosInt, async (initialQty, stockInQty) => {
					const db = freshDb(PRODUCT_ID, initialQty);
					await stockService.createStockIn({ tireProductId: PRODUCT_ID, deliveryProviderId: null, quantity: stockInQty, transactionDate: TX_DATE, notes: null });
					expect(db.getQty(PRODUCT_ID)).toBe(initialQty + stockInQty);
				}),
				{ numRuns: 100 }
			);
		});
	});

	/**
	 * Property 8: Stock-In edit recalculation
	 * Validates: Requirements 9.3
	 */
	describe('Property 8: Stock-In edit recalculation', () => {
		it('product quantity equals preEditQty + (newQty - oldQty) after updateStockIn', async () => {
			// Feature: jhaerin-tire-supply-ims, Property 8: Stock-In edit recalculation
			await fc.assert(
				fc.asyncProperty(arbPosInt, arbPosInt, arbPosInt, async (initialQty, oldQty, newQty) => {
					const db = freshDb(PRODUCT_ID, initialQty);
					const txn = await stockService.createStockIn({ tireProductId: PRODUCT_ID, deliveryProviderId: null, quantity: oldQty, transactionDate: TX_DATE, notes: null });
					const qtyAfterCreate = db.getQty(PRODUCT_ID); // initialQty + oldQty
					await stockService.updateStockIn(txn.id, { tireProductId: PRODUCT_ID, deliveryProviderId: null, quantity: newQty, transactionDate: TX_DATE, notes: null });
					expect(db.getQty(PRODUCT_ID)).toBe(qtyAfterCreate + (newQty - oldQty));
				}),
				{ numRuns: 100 }
			);
		});
	});

	/**
	 * Property 11: Stock-In delete decrements quantity
	 * Validates: Requirements 9.4
	 */
	describe('Property 11: Stock-In delete decrements quantity', () => {
		it('product quantity equals Q - N after deleteStockIn (N <= Q)', async () => {
			// Feature: jhaerin-tire-supply-ims, Property 11: Stock-In delete decrements quantity
			await fc.assert(
				fc.asyncProperty(arbPosInt, async (qty) => {
					const db = freshDb(PRODUCT_ID, qty);
					const stockInQty = fc.sample(fc.integer({ min: 1, max: qty }), 1)[0];
					const txn = await stockService.createStockIn({ tireProductId: PRODUCT_ID, deliveryProviderId: null, quantity: stockInQty, transactionDate: TX_DATE, notes: null });
					const qtyAfterCreate = db.getQty(PRODUCT_ID);
					await stockService.deleteStockIn(txn.id);
					const finalQty = db.getQty(PRODUCT_ID);
					expect(finalQty).toBe(qtyAfterCreate - stockInQty);
					expect(finalQty).toBeGreaterThanOrEqual(0);
				}),
				{ numRuns: 100 }
			);
		});

		it('deleteStockIn throws InsufficientStockError when quantity would go negative', async () => {
			// Seed with 0 quantity, create a stock-in, then manually reduce product qty below txn qty
			const db = freshDb(PRODUCT_ID, 10);
			const txn = await stockService.createStockIn({ tireProductId: PRODUCT_ID, deliveryProviderId: null, quantity: 10, transactionDate: TX_DATE, notes: null });
			// Manually drain the product quantity to 0 (simulate other operations)
			const row = (db as unknown as { tables: Map<string, Row[]> }).tables.get('tire_products')!.find((r) => r.id === PRODUCT_ID)!;
			row.quantity = 0;
			await expect(stockService.deleteStockIn(txn.id)).rejects.toBeInstanceOf(InsufficientStockError);
		});
	});

	/**
	 * Property 2: Stock-Out quantity invariant (valid case)
	 * Validates: Requirements 10.1, 10.3, 18.5
	 */
	describe('Property 2: Stock-Out quantity invariant', () => {
		it('product quantity equals Q - N after createStockOut (N <= Q)', async () => {
			// Feature: jhaerin-tire-supply-ims, Property 2: Stock-Out quantity invariant (valid case)
			await fc.assert(
				fc.asyncProperty(arbPosInt, async (initialQty) => {
					const db = freshDb(PRODUCT_ID, initialQty);
					const outQty = fc.sample(fc.integer({ min: 1, max: initialQty }), 1)[0];
					await stockService.createStockOut({ tireProductId: PRODUCT_ID, quantity: outQty, reason: 'test', transactionDate: TX_DATE });
					const finalQty = db.getQty(PRODUCT_ID);
					expect(finalQty).toBe(initialQty - outQty);
					expect(finalQty).toBeGreaterThanOrEqual(0);
				}),
				{ numRuns: 100 }
			);
		});
	});

	/**
	 * Property 3: Stock-Out rejection when insufficient
	 * Validates: Requirements 10.3, 18.5
	 */
	describe('Property 3: Stock-Out rejection when insufficient', () => {
		it('createStockOut throws InsufficientStockError when N > Q and quantity remains Q', async () => {
			// Feature: jhaerin-tire-supply-ims, Property 3: Stock-Out rejection when insufficient
			await fc.assert(
				fc.asyncProperty(arbPosInt, async (initialQty) => {
					const db = freshDb(PRODUCT_ID, initialQty);
					const excessQty = initialQty + fc.sample(fc.integer({ min: 1, max: 100 }), 1)[0];
					await expect(
						stockService.createStockOut({ tireProductId: PRODUCT_ID, quantity: excessQty, reason: 'test', transactionDate: TX_DATE })
					).rejects.toBeInstanceOf(InsufficientStockError);
					expect(db.getQty(PRODUCT_ID)).toBe(initialQty);
				}),
				{ numRuns: 100 }
			);
		});
	});
});
