/**
 * Property-based tests for Zod schema round-trip validation
 * Feature: jhaerin-tire-supply-ims, Property 15: Zod schema round-trip validation
 *
 * For any valid domain object, serializing to schema input shape and parsing back
 * SHALL produce an equivalent object with no data loss.
 *
 * Validates: Requirements 18.1, 18.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createProductSchema } from './tire-product.schema.js';
import { stockInSchema } from './stock-in.schema.js';
import { stockOutSchema } from './stock-out.schema.js';
import { saleSchema } from './sales.schema.js';

// ── Arbitraries ──────────────────────────────────────────────────────────────

const arbNonEmptyString = (max = 50) =>
	fc.string({ minLength: 1, maxLength: max }).filter((s) => s.trim().length > 0);

const arbPositivePrice = fc
	.float({ min: Math.fround(0.01), max: Math.fround(9999.99), noNaN: true, noDefaultInfinity: true })
	.map((v) => Math.round(v * 100) / 100);

const arbPricePair = fc.tuple(arbPositivePrice, arbPositivePrice).map(([a, b]) => ({
	unitCostPrice: Math.min(a, b),
	retailPrice: Math.max(a, b) || 0.01
}));

const arbUuid = fc.uuid();

const arbIsoDatetime = fc
	.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
	.map((ms) => new Date(ms).toISOString());

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Property 15: Zod schema round-trip validation', () => {

	it('createProductSchema: valid inputs parse without data loss', () => {
		// Feature: jhaerin-tire-supply-ims, Property 15: Zod schema round-trip validation
		fc.assert(
			fc.property(
				arbNonEmptyString(100),
				arbNonEmptyString(50),
				arbNonEmptyString(100),
				arbPricePair,
				(brand, size, pattern, { unitCostPrice, retailPrice }) => {
					const input = { brand, size, pattern, unitCostPrice, retailPrice, deliveryProviderId: null, lowStockThreshold: null };
					const result = createProductSchema.safeParse(input);
					expect(result.success).toBe(true);
					if (result.success) {
						expect(result.data.brand).toBe(brand);
						expect(result.data.size).toBe(size);
						expect(result.data.pattern).toBe(pattern);
						expect(result.data.unitCostPrice).toBe(unitCostPrice);
						expect(result.data.retailPrice).toBe(retailPrice);
					}
				}
			),
			{ numRuns: 100 }
		);
	});

	it('stockInSchema: valid inputs parse without data loss', () => {
		// Feature: jhaerin-tire-supply-ims, Property 15: Zod schema round-trip validation
		fc.assert(
			fc.property(
				arbUuid,
				fc.integer({ min: 1, max: 1000 }),
				arbIsoDatetime,
				(tireProductId, quantity, transactionDate) => {
					const input = { tireProductId, deliveryProviderId: null, quantity, transactionDate, notes: null };
					const result = stockInSchema.safeParse(input);
					expect(result.success).toBe(true);
					if (result.success) {
						expect(result.data.tireProductId).toBe(tireProductId);
						expect(result.data.quantity).toBe(quantity);
						expect(result.data.transactionDate).toBe(transactionDate);
					}
				}
			),
			{ numRuns: 100 }
		);
	});

	it('stockOutSchema: valid inputs parse without data loss', () => {
		// Feature: jhaerin-tire-supply-ims, Property 15: Zod schema round-trip validation
		fc.assert(
			fc.property(
				arbUuid,
				fc.integer({ min: 1, max: 1000 }),
				arbNonEmptyString(200),
				arbIsoDatetime,
				(tireProductId, quantity, reason, transactionDate) => {
					const input = { tireProductId, quantity, reason, transactionDate };
					const result = stockOutSchema.safeParse(input);
					expect(result.success).toBe(true);
					if (result.success) {
						expect(result.data.tireProductId).toBe(tireProductId);
						expect(result.data.quantity).toBe(quantity);
						expect(result.data.reason).toBe(reason);
					}
				}
			),
			{ numRuns: 100 }
		);
	});

	it('saleSchema: valid inputs parse without data loss', () => {
		// Feature: jhaerin-tire-supply-ims, Property 15: Zod schema round-trip validation
		fc.assert(
			fc.property(
				arbUuid,
				fc.integer({ min: 1, max: 1000 }),
				arbIsoDatetime,
				(tireProductId, quantitySold, transactionDate) => {
					const input = { tireProductId, quantitySold, transactionDate };
					const result = saleSchema.safeParse(input);
					expect(result.success).toBe(true);
					if (result.success) {
						expect(result.data.tireProductId).toBe(tireProductId);
						expect(result.data.quantitySold).toBe(quantitySold);
						expect(result.data.transactionDate).toBe(transactionDate);
					}
				}
			),
			{ numRuns: 100 }
		);
	});

	it('createProductSchema: rejects when retailPrice < unitCostPrice', () => {
		fc.assert(
			fc.property(
				arbNonEmptyString(50),
				arbNonEmptyString(20),
				arbNonEmptyString(50),
				arbPositivePrice,
				arbPositivePrice,
				(brand, size, pattern, a, b) => {
					// Ensure cost > retail
					const unitCostPrice = Math.max(a, b) + 0.01;
					const retailPrice = Math.min(a, b);
					const input = { brand, size, pattern, unitCostPrice, retailPrice, deliveryProviderId: null, lowStockThreshold: null };
					const result = createProductSchema.safeParse(input);
					expect(result.success).toBe(false);
				}
			),
			{ numRuns: 100 }
		);
	});
});
