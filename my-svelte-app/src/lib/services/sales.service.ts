import { getDb } from '$lib/db/index.js';
import type { SalesTransaction } from '$lib/types/index.js';
import type { SaleInput } from '$lib/schemas/sales.schema.js';
import { InsufficientStockError, NotFoundError } from '$lib/errors.js';

export interface SaleFilters {
  tireProductId?: string;
  brand?: string;
  dateFrom?: string;
  dateTo?: string;
  month?: string; // YYYY-MM format
  limit?: number;
  offset?: number;
}

function mapRow(row: Record<string, unknown>): SalesTransaction {
  return {
    id: row.id as string,
    tireProductId: row.tire_product_id as string,
    quantitySold: row.quantity_sold as number,
    unitRetailPrice: row.unit_retail_price as number,
    unitCostPrice: row.unit_cost_price as number,
    revenue: row.revenue as number,
    grossProfit: row.gross_profit as number,
    transactionDate: row.transaction_date as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

class SalesService {
  async createSale(data: SaleInput): Promise<SalesTransaction> {
    const db = await getDb();

    const products = await db.query<Record<string, unknown>>(
      'SELECT id, quantity, retail_price, unit_cost_price FROM tire_products WHERE id = ? AND is_archived = 0',
      [data.tireProductId]
    );
    if (products.length === 0) throw new NotFoundError('TireProduct', data.tireProductId);

    const product = products[0];
    const currentQty = product.quantity as number;
    const unitRetailPrice = product.retail_price as number;
    const unitCostPrice = product.unit_cost_price as number;

    if (data.quantitySold > currentQty) {
      throw new InsufficientStockError(currentQty, data.quantitySold);
    }

    const revenue = data.quantitySold * unitRetailPrice;
    const grossProfit = revenue - data.quantitySold * unitCostPrice;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO sales_transactions
          (id, tire_product_id, quantity_sold, unit_retail_price, unit_cost_price,
           revenue, gross_profit, transaction_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.tireProductId, data.quantitySold, unitRetailPrice, unitCostPrice, revenue, grossProfit, data.transactionDate, now, now]
      );
      await tx.execute(
        'UPDATE tire_products SET quantity = quantity - ?, updated_at = ? WHERE id = ?',
        [data.quantitySold, now, data.tireProductId]
      );
    });

    const rows = await db.query<Record<string, unknown>>('SELECT * FROM sales_transactions WHERE id = ?', [id]);
    return mapRow(rows[0]);
  }

  async updateSale(id: string, data: SaleInput): Promise<SalesTransaction> {
    const db = await getDb();

    const existing = await db.query<Record<string, unknown>>('SELECT * FROM sales_transactions WHERE id = ?', [id]);
    if (existing.length === 0) throw new NotFoundError('SalesTransaction', id);

    const oldQty = existing[0].quantity_sold as number;

    const products = await db.query<Record<string, unknown>>(
      'SELECT id, quantity, retail_price, unit_cost_price FROM tire_products WHERE id = ? AND is_archived = 0',
      [data.tireProductId]
    );
    if (products.length === 0) throw new NotFoundError('TireProduct', data.tireProductId);

    const product = products[0];
    const unitRetailPrice = product.retail_price as number;
    const unitCostPrice = product.unit_cost_price as number;
    const revenue = data.quantitySold * unitRetailPrice;
    const grossProfit = revenue - data.quantitySold * unitCostPrice;
    const delta = oldQty - data.quantitySold;
    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      await tx.execute(
        `UPDATE sales_transactions
         SET tire_product_id = ?, quantity_sold = ?, unit_retail_price = ?, unit_cost_price = ?,
             revenue = ?, gross_profit = ?, transaction_date = ?, updated_at = ?
         WHERE id = ?`,
        [data.tireProductId, data.quantitySold, unitRetailPrice, unitCostPrice, revenue, grossProfit, data.transactionDate, now, id]
      );
      await tx.execute(
        'UPDATE tire_products SET quantity = quantity + ?, updated_at = ? WHERE id = ?',
        [delta, now, data.tireProductId]
      );
    });

    const rows = await db.query<Record<string, unknown>>('SELECT * FROM sales_transactions WHERE id = ?', [id]);
    return mapRow(rows[0]);
  }

  async deleteSale(id: string): Promise<void> {
    const db = await getDb();

    const existing = await db.query<Record<string, unknown>>('SELECT * FROM sales_transactions WHERE id = ?', [id]);
    if (existing.length === 0) throw new NotFoundError('SalesTransaction', id);

    const sale = existing[0];
    const quantitySold = sale.quantity_sold as number;
    const tireProductId = sale.tire_product_id as string;
    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      await tx.execute('DELETE FROM sales_transactions WHERE id = ?', [id]);
      await tx.execute(
        'UPDATE tire_products SET quantity = quantity + ?, updated_at = ? WHERE id = ?',
        [quantitySold, now, tireProductId]
      );
    });
  }

  async listSales(filters: SaleFilters = {}): Promise<SalesTransaction[]> {
    const db = await getDb();
    const { tireProductId, brand, dateFrom, dateTo, month, limit = 50, offset = 0 } = filters;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (tireProductId) { conditions.push('st.tire_product_id = ?'); params.push(tireProductId); }
    if (brand) { conditions.push('tp.brand = ?'); params.push(brand); }
    if (dateFrom) { conditions.push('st.transaction_date >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('st.transaction_date <= ?'); params.push(dateTo); }
    if (month) { conditions.push("strftime('%Y-%m', st.transaction_date) = ?"); params.push(month); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT st.*
      FROM sales_transactions st
      JOIN tire_products tp ON tp.id = st.tire_product_id
      ${where}
      ORDER BY st.transaction_date DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const rows = await db.query<Record<string, unknown>>(sql, params);
    return rows.map(mapRow);
  }
}

export const salesService = new SalesService();
