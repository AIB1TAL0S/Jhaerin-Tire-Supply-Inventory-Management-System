/**
 * Property-based tests for InventoryService
 * Feature: jhaerin-tire-supply-ims
 *
 * Property 6: Retail price ≥ cost price invariant
 * Property 7: Duplicate product rejection
 *
 * Validates: Requirements 8.5, 8.8, 18.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { DBAdapter } from '$lib/db/db.interface.js';
import { ValidationError, DuplicateProductError } from '$lib/errors.js';

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

		// SELECT * FROM tire_products WHERE id = ?
		if (/^SELECT \* FROM tire_products WHERE id = \?$/i.test(s)) {
			return this.getTable('tire_products').filter((r) => r.id === params[0]) as unknown as T[];
		}

		// SELECT COUNT(*) as count FROM tire_products
		if (/^SELECT COUNT\(\*\) as count FROM tire_products$/i.test(s)) {
			return [{ count: this.getTable('tire_products').length }] as unknown as T[];
		}

		// SELECT * FROM tire_products (list all)
		if (/^SELECT \* FROM tire_products/i.test(s)) {
			return this.getTable('tire_products') as unknown as T[];
		}

		throw new Error(`InMemoryDB.query: unsupported SQL: ${sql}`);
	}

	async execute(sql: string, params: unknown[] = []): Promise<void> {
		const s = sql.trim().replace(/\s+/g, ' ');

		if (/^INSERT INTO tire_products/i.test(s)) {
			const [id, brand, size, pattern, unitCostPrice, retailPrice, deliveryProviderId, lowStockThreshold, createdAt, updatedAt] = params;
			// Simulate UNIQUE constraint on (brand, size, pattern)
			const existing = this.getTable('tire_products').find(
				(r) => r.brand === brand && r.size === size && r.pattern === pattern
			);
			if (existing) throw new Error('UNIQUE constraint failed: tire_products.brand, tire_products.size, tire_products.pattern');
			this.getTable('tire_products').push({
				id, brand, size, pattern, quantity: 0,
				unit_cost_price: unitCostPrice, retail_price: retailPrice,
				delivery_provider_id: deliveryProviderId ?? null,
				low_stock_threshold: lowStockThreshold ?? null,
				is_archived: 0, created_at: createdAt, updated_at: updatedAt
			});
			return;
		}

		if (/^UPDATE tire_products/i.test(s)) {
			// Minimal update support — just update the row
			return;
		}

		throw new Error(`InMemoryDB.execute: unsupported SQL: ${sql}`);
	}

	async transaction(fn: (tx: DBAdapter) => Promise<void>): Promise<void> {
		await fn(this);
	}

	count(): number {
		return this.getTable('tire_products').length;
	}
}

// ── Mock getDb ────────────────────────────────────────────────────────────────

vi.mock('$lib/db/index.js', () => {
	let _db: InMemoryDB | null = null;
	return {
		getDb: async () => {
			if (!_db) _db = new InMemoryDB();
			return _db;
		},
		__setDb: (db: InMemoryDB) => { _db = db; }
	};
});

const { inventoryService } = await import('./inventory.service.js');
const dbModule = await import('$lib/db/index.js');
const setDb = (dbModule as unknown as { __setDb: (db: InMemoryDB) => void }).__setDb;

function freshDb(): InMemoryDB {
	const db = new InMemoryDB();
	setDb(db);
	return db;
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const arbStr = (max = 50) => fc.string({ minLength: 1, maxLength: max }).filter((s) => s.trim().length > 0);
const arbPrice = fc
	.float({ min: Math.fround(0.01), max: Math.fround(5000), noNaN: true, noDefaultInfinity: true })
	.map((v) => Math.round(v * 100) / 100);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InventoryService property tests', () => {

	/**
	 * Property 6: Retail price ≥ cost price invariant
	 * Validates: Requirements 8.8, 18.4
	 */
	describe('Property 6: Retail price ≥ cost price invariant', () => {
		it('createProduct rejects when retailPrice < unitCostPrice', async () => {
			// Feature: jhaerin-tire-supply-ims, Property 6: Retail price ≥ cost price invariant
			await fc.assert(
				fc.asyncProperty(
					arbStr(), arbStr(20), arbStr(),
					arbPrice, arbPrice,
					async (brand, size, pattern, a, b) => {
						freshDb();
						const unitCostPrice = Math.max(a, b) + 0.01;
						const retailPrice = Math.min(a, b);
						await expect(
							inventoryService.createProduct({ brand, size, pattern, unitCostPrice, retailPrice, deliveryProviderId: null, lowStockThreshold: null })
						).rejects.toBeInstanceOf(ValidationError);
					}
				),
				{ numRuns: 100 }
			);
		});

		it('createProduct succeeds when retailPrice >= unitCostPrice', async () => {
			// Feature: jhaerin-tire-supply-ims, Property 6: Retail price ≥ cost price invariant
			await fc.assert(
				fc.asyncProperty(
					arbStr(), arbStr(20), arbStr(),
					arbPrice, arbPrice,
					async (brand, size, pattern, a, b) => {
						freshDb();
						const unitCostPrice = Math.min(a, b);
						const retailPrice = Math.max(a, b);
						const product = await inventoryService.createProduct({
							brand, size, pattern, unitCostPrice, retailPrice,
							deliveryProviderId: null, lowStockThreshold: null
						});
						expect(product.retailPrice).toBeGreaterThanOrEqual(product.unitCostPrice);
					}
				),
				{ numRuns: 100 }
			);
		});
	});

	/**
	 * Property 7: Duplicate product rejection
	 * Validates: Requirements 8.5, 18.4
	 */
	describe('Property 7: Duplicate product rejection', () => {
		it('second createProduct with same (brand, size, pattern) throws DuplicateProductError and count stays at 1', async () => {
			// Feature: jhaerin-tire-supply-ims, Property 7: Duplicate product rejection
			await fc.assert(
				fc.asyncProperty(
					arbStr(), arbStr(20), arbStr(),
					arbPrice,
					async (brand, size, pattern, price) => {
						const db = freshDb();
						const base = { brand, size, pattern, unitCostPrice: price, retailPrice: price, deliveryProviderId: null, lowStockThreshold: null };

						// First create succeeds
						await inventoryService.createProduct(base);
						expect(db.count()).toBe(1);

						// Second create with same tuple must throw
						await expect(inventoryService.createProduct(base)).rejects.toBeInstanceOf(DuplicateProductError);

						// Count must remain 1
						expect(db.count()).toBe(1);
					}
				),
				{ numRuns: 100 }
			);
		});
	});
});
