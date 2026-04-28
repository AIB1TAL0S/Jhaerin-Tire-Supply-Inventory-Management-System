import { getDb } from '$lib/db/index.js';
import { NotFoundError, InsufficientStockError } from '$lib/errors.js';
import type { StockInTransaction, StockOutTransaction } from '$lib/types/index.js';
import type { StockInInput } from '$lib/schemas/stock-in.schema.js';

export interface StockOutInput {
  tireProductId: string;
  quantity: number;
  reason: string;
  transactionDate: string;
}

export interface TransactionFilters {
  tireProductId?: string;
  deliveryProviderId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface StockInRow {
  id: string;
  tire_product_id: string;
  delivery_provider_id: string | null;
  quantity: number;
  transaction_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface StockOutRow {
  id: string;
  tire_product_id: string;
  quantity: number;
  reason: string;
  transaction_date: string;
  created_at: string;
  updated_at: string;
}

interface ProductRow {
  id: string;
  quantity: number;
}

function rowToStockIn(row: StockInRow): StockInTransaction {
  return {
    id: row.id,
    tireProductId: row.tire_product_id,
    deliveryProviderId: row.delivery_provider_id,
    quantity: row.quantity,
    transactionDate: row.transaction_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToStockOut(row: StockOutRow): StockOutTransaction {
  return {
    id: row.id,
    tireProductId: row.tire_product_id,
    quantity: row.quantity,
    reason: row.reason,
    transactionDate: row.transaction_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class StockService {
  async createStockIn(data: StockInInput): Promise<StockInTransaction> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO stock_in_transactions (id, tire_product_id, delivery_provider_id, quantity, transaction_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.tireProductId, data.deliveryProviderId ?? null, data.quantity, data.transactionDate, data.notes ?? null, now, now]
      );
      await tx.execute(
        `UPDATE tire_products SET quantity = quantity + ?, updated_at = ? WHERE id = ?`,
        [data.quantity, now, data.tireProductId]
      );
    });

    const rows = await db.query<StockInRow>(`SELECT * FROM stock_in_transactions WHERE id = ?`, [id]);
    if (rows.length === 0) throw new NotFoundError('StockInTransaction', id);
    return rowToStockIn(rows[0]);
  }

  async updateStockIn(id: string, data: StockInInput): Promise<StockInTransaction> {
    const db = await getDb();
    const now = new Date().toISOString();

    const existing = await db.query<StockInRow>(`SELECT * FROM stock_in_transactions WHERE id = ?`, [id]);
    if (existing.length === 0) throw new NotFoundError('StockInTransaction', id);

    const oldQty = existing[0].quantity;
    const delta = data.quantity - oldQty;

    await db.transaction(async (tx) => {
      await tx.execute(
        `UPDATE stock_in_transactions
         SET tire_product_id = ?, delivery_provider_id = ?, quantity = ?, transaction_date = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [data.tireProductId, data.deliveryProviderId ?? null, data.quantity, data.transactionDate, data.notes ?? null, now, id]
      );
      await tx.execute(
        `UPDATE tire_products SET quantity = quantity + ?, updated_at = ? WHERE id = ?`,
        [delta, now, data.tireProductId]
      );
    });

    const rows = await db.query<StockInRow>(`SELECT * FROM stock_in_transactions WHERE id = ?`, [id]);
    if (rows.length === 0) throw new NotFoundError('StockInTransaction', id);
    return rowToStockIn(rows[0]);
  }

  async deleteStockIn(id: string): Promise<void> {
    const db = await getDb();
    const now = new Date().toISOString();

    const existing = await db.query<StockInRow>(`SELECT * FROM stock_in_transactions WHERE id = ?`, [id]);
    if (existing.length === 0) throw new NotFoundError('StockInTransaction', id);

    const txn = existing[0];
    const products = await db.query<ProductRow>(`SELECT id, quantity FROM tire_products WHERE id = ?`, [txn.tire_product_id]);
    if (products.length === 0) throw new NotFoundError('TireProduct', txn.tire_product_id);

    const currentQty = products[0].quantity;
    if (currentQty - txn.quantity < 0) {
      throw new InsufficientStockError(currentQty, txn.quantity);
    }

    await db.transaction(async (tx) => {
      await tx.execute(`DELETE FROM stock_in_transactions WHERE id = ?`, [id]);
      await tx.execute(
        `UPDATE tire_products SET quantity = quantity - ?, updated_at = ? WHERE id = ?`,
        [txn.quantity, now, txn.tire_product_id]
      );
    });
  }

  async listStockIn(filters: TransactionFilters = {}): Promise<StockInTransaction[]> {
    const db = await getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.tireProductId) { conditions.push('tire_product_id = ?'); params.push(filters.tireProductId); }
    if (filters.deliveryProviderId) { conditions.push('delivery_provider_id = ?'); params.push(filters.deliveryProviderId); }
    if (filters.dateFrom) { conditions.push('transaction_date >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo) { conditions.push('transaction_date <= ?'); params.push(filters.dateTo); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const rows = await db.query<StockInRow>(
      `SELECT * FROM stock_in_transactions ${where} ORDER BY transaction_date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return rows.map(rowToStockIn);
  }

  async createStockOut(data: StockOutInput): Promise<StockOutTransaction> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const products = await db.query<ProductRow>(`SELECT id, quantity FROM tire_products WHERE id = ?`, [data.tireProductId]);
    if (products.length === 0) throw new NotFoundError('TireProduct', data.tireProductId);

    const currentQty = products[0].quantity;
    if (data.quantity > currentQty) {
      throw new InsufficientStockError(currentQty, data.quantity);
    }

    await db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO stock_out_transactions (id, tire_product_id, quantity, reason, transaction_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, data.tireProductId, data.quantity, data.reason, data.transactionDate, now, now]
      );
      await tx.execute(
        `UPDATE tire_products SET quantity = quantity - ?, updated_at = ? WHERE id = ?`,
        [data.quantity, now, data.tireProductId]
      );
    });

    const rows = await db.query<StockOutRow>(`SELECT * FROM stock_out_transactions WHERE id = ?`, [id]);
    if (rows.length === 0) throw new NotFoundError('StockOutTransaction', id);
    return rowToStockOut(rows[0]);
  }

  async listStockOut(filters: TransactionFilters = {}): Promise<StockOutTransaction[]> {
    const db = await getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.tireProductId) { conditions.push('tire_product_id = ?'); params.push(filters.tireProductId); }
    if (filters.dateFrom) { conditions.push('transaction_date >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo) { conditions.push('transaction_date <= ?'); params.push(filters.dateTo); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const rows = await db.query<StockOutRow>(
      `SELECT * FROM stock_out_transactions ${where} ORDER BY transaction_date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return rows.map(rowToStockOut);
  }
}

export const stockService = new StockService();
