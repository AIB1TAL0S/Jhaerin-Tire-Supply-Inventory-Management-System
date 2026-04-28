/**
 * Property-based tests for SalesService
 * Feature: jhaerin-tire-supply-ims
 *
 * Property 4: Sales quantity decrement invariant
 * Property 5: Sales revenue and gross profit calculation
 * Property 9: Sales edit recalculation
 * Property 10: Sales delete restores quantity
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { DBAdapter } from '$lib/db/db.interface.js';
import { InsufficientStockError, NotFoundError } from '$lib/errors.js';

// ---------------------------------------------------------------------------
// In-memory DBAdapter — no native SQLite required
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

class InMemoryDB implements DBAdapter {
  private tables: Map<string, Row[]> = new Map();

  private getTable(name: string): Row[] {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name)!;
  }

  /** Minimal SQL interpreter covering the patterns used by SalesService */
  async query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    const s = sql.trim().replace(/\s+/g, ' ');

    // SELECT * FROM <table> WHERE id = ?
    const selectById = s.match(/^SELECT \* FROM (\w+) WHERE id = \?$/i);
    if (selectById) {
      const rows = this.getTable(selectById[1]);
      return rows.filter((r) => r.id === params[0]) as unknown as T[];
    }

    // SELECT id, quantity, retail_price, unit_cost_price FROM tire_products WHERE id = ? AND is_archived = 0
    const selectProduct = s.match(
      /^SELECT id, quantity, retail_price, unit_cost_price FROM tire_products WHERE id = \? AND is_archived = 0$/i
    );
    if (selectProduct) {
      const rows = this.getTable('tire_products');
      return rows.filter(
        (r) => r.id === params[0] && r.is_archived === 0
      ) as unknown as T[];
    }

    // SELECT * FROM <table> WHERE id = ?  (already handled above, but keep as fallback)
    // SELECT * FROM sales_transactions WHERE id = ?
    const selectSale = s.match(/^SELECT \* FROM sales_transactions WHERE id = \?$/i);
    if (selectSale) {
      const rows = this.getTable('sales_transactions');
      return rows.filter((r) => r.id === params[0]) as unknown as T[];
    }

    throw new Error(`InMemoryDB.query: unsupported SQL: ${sql}`);
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const s = sql.trim().replace(/\s+/g, ' ');

    // INSERT INTO sales_transactions (...)
    if (/^INSERT INTO sales_transactions/i.test(s)) {
      const [id, tpId, qty, urp, ucp, rev, gp, td, ca, ua] = params;
      this.getTable('sales_transactions').push({
        id, tire_product_id: tpId, quantity_sold: qty,
        unit_retail_price: urp, unit_cost_price: ucp,
        revenue: rev, gross_profit: gp,
        transaction_date: td, created_at: ca, updated_at: ua,
      });
      return;
    }

    // UPDATE tire_products SET quantity = quantity - ? updated_at = ? WHERE id = ?
    if (/^UPDATE tire_products SET quantity = quantity - \?/i.test(s)) {
      const [delta, , id] = params;
      const rows = this.getTable('tire_products');
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.quantity = (row.quantity as number) - (delta as number);
        row.updated_at = params[1];
      }
      return;
    }

    // UPDATE tire_products SET quantity = quantity + ? updated_at = ? WHERE id = ?
    if (/^UPDATE tire_products SET quantity = quantity \+ \?/i.test(s)) {
      const [delta, , id] = params;
      const rows = this.getTable('tire_products');
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.quantity = (row.quantity as number) + (delta as number);
        row.updated_at = params[1];
      }
      return;
    }

    // UPDATE sales_transactions SET ... WHERE id = ?
    if (/^UPDATE sales_transactions/i.test(s)) {
      const [tpId, qty, urp, ucp, rev, gp, td, ua, id] = params;
      const rows = this.getTable('sales_transactions');
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.tire_product_id = tpId;
        row.quantity_sold = qty;
        row.unit_retail_price = urp;
        row.unit_cost_price = ucp;
        row.revenue = rev;
        row.gross_profit = gp;
        row.transaction_date = td;
        row.updated_at = ua;
      }
      return;
    }

    // DELETE FROM sales_transactions WHERE id = ?
    if (/^DELETE FROM sales_transactions WHERE id = \?$/i.test(s)) {
      const table = this.getTable('sales_transactions');
      const idx = table.findIndex((r) => r.id === params[0]);
      if (idx !== -1) table.splice(idx, 1);
      return;
    }

    throw new Error(`InMemoryDB.execute: unsupported SQL: ${sql}`);
  }

  async transaction(fn: (tx: DBAdapter) => Promise<void>): Promise<void> {
    // In-memory: just run the callback (no real rollback needed for tests)
    await fn(this);
  }

  /** Helper: seed a tire product row */
  seedProduct(id: string, quantity: number, retailPrice: number, costPrice: number): void {
    this.getTable('tire_products').push({
      id,
      brand: 'TestBrand',
      size: '205/55R16',
      pattern: 'TestPattern',
      quantity,
      unit_cost_price: costPrice,
      retail_price: retailPrice,
      delivery_provider_id: null,
      low_stock_threshold: null,
      is_archived: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  /** Helper: get current product quantity */
  getProductQty(id: string): number {
    const row = this.getTable('tire_products').find((r) => r.id === id);
    return row ? (row.quantity as number) : -1;
  }

  /** Helper: get a sale row */
  getSale(id: string): Row | undefined {
    return this.getTable('sales_transactions').find((r) => r.id === id);
  }
}

// ---------------------------------------------------------------------------
// Wire the in-memory DB into the module under test
// ---------------------------------------------------------------------------

// We need to intercept getDb() — use vi.mock at module level
vi.mock('$lib/db/index.js', () => {
  let _db: InMemoryDB | null = null;
  return {
    getDb: async () => {
      if (!_db) _db = new InMemoryDB();
      return _db;
    },
    __setDb: (db: InMemoryDB) => { _db = db; },
  };
});

// Import after mock is set up
const { salesService } = await import('./sales.service.js');
const dbModule = await import('$lib/db/index.js');
const setDb = (dbModule as unknown as { __setDb: (db: InMemoryDB) => void }).__setDb;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshDb(): InMemoryDB {
  const db = new InMemoryDB();
  setDb(db);
  return db;
}

const PRODUCT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TX_DATE = '2024-01-15T10:00:00.000Z';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Positive integer in [1, 1000] */
const arbPosInt = fc.integer({ min: 1, max: 1000 });

/** Positive real price in [1.00, 500.00] with 2 decimal places */
const arbPrice = fc.float({ min: 1, max: 500, noNaN: true, noDefaultInfinity: true })
  .map((v) => Math.round(v * 100) / 100);

/** cost <= retail, both positive */
const arbPricePair = fc.tuple(arbPrice, arbPrice).map(([a, b]) => ({
  costPrice: Math.min(a, b),
  retailPrice: Math.max(a, b) || 1,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SalesService property tests', () => {

  /**
   * Property 4: Sales quantity decrement invariant
   * Validates: Requirements 11.3, 11.4
   *
   * For any product with quantity Q and sale with quantity_sold N where N ≤ Q,
   * after saving the sale the product's quantity SHALL equal Q − N.
   */
  describe('Property 4: Sales quantity decrement invariant', () => {
    it('product quantity decrements by quantitySold after createSale', async () => {
      // Feature: jhaerin-tire-supply-ims, Property 4: Sales quantity decrement invariant
      await fc.assert(
        fc.asyncProperty(
          arbPosInt,
          arbPricePair,
          async (initialQty, { costPrice, retailPrice }) => {
            const db = freshDb();
            db.seedProduct(PRODUCT_ID, initialQty, retailPrice, costPrice);

            const quantitySold = fc.sample(fc.integer({ min: 1, max: initialQty }), 1)[0];

            await salesService.createSale({
              tireProductId: PRODUCT_ID,
              quantitySold,
              transactionDate: TX_DATE,
            });

            const finalQty = db.getProductQty(PRODUCT_ID);
            expect(finalQty).toBe(initialQty - quantitySold);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects sale when quantitySold > product quantity (InsufficientStockError)', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbPosInt,
          arbPricePair,
          async (initialQty, { costPrice, retailPrice }) => {
            const db = freshDb();
            db.seedProduct(PRODUCT_ID, initialQty, retailPrice, costPrice);

            const excessQty = initialQty + fc.sample(fc.integer({ min: 1, max: 100 }), 1)[0];

            await expect(
              salesService.createSale({
                tireProductId: PRODUCT_ID,
                quantitySold: excessQty,
                transactionDate: TX_DATE,
              })
            ).rejects.toBeInstanceOf(InsufficientStockError);

            // Quantity must remain unchanged
            expect(db.getProductQty(PRODUCT_ID)).toBe(initialQty);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Sales revenue and gross profit calculation
   * Validates: Requirements 11.2
   *
   * For any sale with quantity_sold Q, unit_retail_price P, unit_cost_price C:
   *   revenue = Q × P
   *   gross_profit = (Q × P) − (Q × C)
   */
  describe('Property 5: Sales revenue and gross profit calculation', () => {
    it('persisted revenue and grossProfit match formula', async () => {
      // Feature: jhaerin-tire-supply-ims, Property 5: Sales revenue and gross profit calculation
      await fc.assert(
        fc.asyncProperty(
          arbPosInt,
          arbPricePair,
          async (quantitySold, { costPrice, retailPrice }) => {
            const db = freshDb();
            db.seedProduct(PRODUCT_ID, quantitySold, retailPrice, costPrice);

            const sale = await salesService.createSale({
              tireProductId: PRODUCT_ID,
              quantitySold,
              transactionDate: TX_DATE,
            });

            const expectedRevenue = quantitySold * retailPrice;
            const expectedGrossProfit = expectedRevenue - quantitySold * costPrice;

            expect(sale.revenue).toBeCloseTo(expectedRevenue, 10);
            expect(sale.grossProfit).toBeCloseTo(expectedGrossProfit, 10);
            expect(sale.unitRetailPrice).toBe(retailPrice);
            expect(sale.unitCostPrice).toBe(costPrice);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Sales edit recalculation
   * Validates: Requirements 11.7
   *
   * For any existing sale with original quantity_sold O edited to new quantity_sold N:
   *   - product quantity updated by (O − N)
   *   - revenue and gross_profit recalculated with new quantity
   */
  describe('Property 9: Sales edit recalculation', () => {
    it('updateSale applies delta and recalculates financials', async () => {
      // Feature: jhaerin-tire-supply-ims, Property 9: Sales edit recalculation
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 500 }),
          arbPricePair,
          async (totalQty, { costPrice, retailPrice }) => {
            const db = freshDb();
            // Seed with enough stock for both original and new sale
            db.seedProduct(PRODUCT_ID, totalQty, retailPrice, costPrice);

            // Original sale: sell half
            const oldQty = Math.max(1, Math.floor(totalQty / 2));
            const sale = await salesService.createSale({
              tireProductId: PRODUCT_ID,
              quantitySold: oldQty,
              transactionDate: TX_DATE,
            });

            const qtyAfterCreate = db.getProductQty(PRODUCT_ID);

            // New quantity: different from old (could be more or less, within available stock)
            const maxNew = qtyAfterCreate + oldQty; // restore old, then use up to totalQty
            const newQty = fc.sample(fc.integer({ min: 1, max: maxNew }), 1)[0];

            const updated = await salesService.updateSale(sale.id, {
              tireProductId: PRODUCT_ID,
              quantitySold: newQty,
              transactionDate: TX_DATE,
            });

            // Product quantity should reflect delta (oldQty - newQty) applied to post-create qty
            const expectedQty = qtyAfterCreate + (oldQty - newQty);
            expect(db.getProductQty(PRODUCT_ID)).toBe(expectedQty);

            // Revenue and gross profit recalculated
            expect(updated.revenue).toBeCloseTo(newQty * retailPrice, 10);
            expect(updated.grossProfit).toBeCloseTo(newQty * retailPrice - newQty * costPrice, 10);
            expect(updated.quantitySold).toBe(newQty);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Sales delete restores quantity
   * Validates: Requirements 11.8
   *
   * For any deleted sales transaction with quantity_sold N,
   * the associated tire product's quantity SHALL increase by N after deletion.
   */
  describe('Property 10: Sales delete restores quantity', () => {
    it('deleteSale restores product quantity by quantitySold', async () => {
      // Feature: jhaerin-tire-supply-ims, Property 10: Sales delete restores quantity
      await fc.assert(
        fc.asyncProperty(
          arbPosInt,
          arbPricePair,
          async (initialQty, { costPrice, retailPrice }) => {
            const db = freshDb();
            db.seedProduct(PRODUCT_ID, initialQty, retailPrice, costPrice);

            const quantitySold = fc.sample(fc.integer({ min: 1, max: initialQty }), 1)[0];

            const sale = await salesService.createSale({
              tireProductId: PRODUCT_ID,
              quantitySold,
              transactionDate: TX_DATE,
            });

            const qtyAfterSale = db.getProductQty(PRODUCT_ID);
            expect(qtyAfterSale).toBe(initialQty - quantitySold);

            await salesService.deleteSale(sale.id);

            const qtyAfterDelete = db.getProductQty(PRODUCT_ID);
            expect(qtyAfterDelete).toBe(initialQty);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('deleteSale throws NotFoundError for non-existent sale', async () => {
      freshDb();
      await expect(
        salesService.deleteSale('00000000-0000-0000-0000-000000000000')
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
