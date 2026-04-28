import { getDb } from '$lib/db/index.js';
import type { TireProduct } from '$lib/types/index.js';
import type { CreateProductInput, UpdateProductInput } from '$lib/schemas/tire-product.schema.js';
import { ValidationError, DuplicateProductError, NotFoundError } from '$lib/errors.js';

export interface ProductFilters {
  search?: string;
  brand?: string;
  size?: string;
  pattern?: string;
  deliveryProviderId?: string;
  stockLevel?: 'low' | 'normal' | 'all';
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

function mapRow(row: Record<string, unknown>): TireProduct {
  return {
    id: row.id as string,
    brand: row.brand as string,
    size: row.size as string,
    pattern: row.pattern as string,
    quantity: row.quantity as number,
    unitCostPrice: row.unit_cost_price as number,
    retailPrice: row.retail_price as number,
    deliveryProviderId: row.delivery_provider_id as string | null,
    lowStockThreshold: row.low_stock_threshold as number | null,
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

class InventoryService {
  async listProducts(filters: ProductFilters = {}): Promise<TireProduct[]> {
    const db = await getDb();
    const {
      search,
      brand,
      size,
      pattern,
      deliveryProviderId,
      stockLevel,
      includeArchived = false,
      limit = 50,
      offset = 0,
    } = filters;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (!includeArchived) {
      conditions.push('is_archived = 0');
    }

    if (search) {
      conditions.push('(brand LIKE ? OR size LIKE ? OR pattern LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    if (brand) {
      conditions.push('brand = ?');
      params.push(brand);
    }

    if (size) {
      conditions.push('size = ?');
      params.push(size);
    }

    if (pattern) {
      conditions.push('pattern = ?');
      params.push(pattern);
    }

    if (deliveryProviderId) {
      conditions.push('delivery_provider_id = ?');
      params.push(deliveryProviderId);
    }

    if (stockLevel === 'low') {
      conditions.push('quantity <= COALESCE(low_stock_threshold, 5)');
    } else if (stockLevel === 'normal') {
      conditions.push('quantity > COALESCE(low_stock_threshold, 5)');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM tire_products ${where} ORDER BY brand, size, pattern LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = await db.query<Record<string, unknown>>(sql, params);
    return rows.map(mapRow);
  }

  async getProduct(id: string): Promise<TireProduct> {
    const db = await getDb();
    const rows = await db.query<Record<string, unknown>>(
      'SELECT * FROM tire_products WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      throw new NotFoundError('TireProduct', id);
    }
    return mapRow(rows[0]);
  }

  async createProduct(data: CreateProductInput): Promise<TireProduct> {
    if (data.retailPrice < data.unitCostPrice) {
      throw new ValidationError('Retail price must be >= unit cost price');
    }

    const db = await getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      await db.execute(
        `INSERT INTO tire_products
          (id, brand, size, pattern, quantity, unit_cost_price, retail_price,
           delivery_provider_id, low_stock_threshold, is_archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 0, ?, ?)`,
        [
          id,
          data.brand,
          data.size,
          data.pattern,
          data.unitCostPrice,
          data.retailPrice,
          data.deliveryProviderId ?? null,
          data.lowStockThreshold ?? null,
          now,
          now,
        ]
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE constraint failed')) {
        throw new DuplicateProductError(data.brand, data.size, data.pattern);
      }
      throw err;
    }

    return this.getProduct(id);
  }

  async updateProduct(id: string, data: UpdateProductInput): Promise<TireProduct> {
    const current = await this.getProduct(id);

    const merged = {
      retailPrice: data.retailPrice ?? current.retailPrice,
      unitCostPrice: data.unitCostPrice ?? current.unitCostPrice,
    };

    if (merged.retailPrice < merged.unitCostPrice) {
      throw new ValidationError('Retail price must be >= unit cost price');
    }

    const db = await getDb();
    const now = new Date().toISOString();

    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.brand !== undefined) { sets.push('brand = ?'); params.push(data.brand); }
    if (data.size !== undefined) { sets.push('size = ?'); params.push(data.size); }
    if (data.pattern !== undefined) { sets.push('pattern = ?'); params.push(data.pattern); }
    if (data.unitCostPrice !== undefined) { sets.push('unit_cost_price = ?'); params.push(data.unitCostPrice); }
    if (data.retailPrice !== undefined) { sets.push('retail_price = ?'); params.push(data.retailPrice); }
    if (data.deliveryProviderId !== undefined) { sets.push('delivery_provider_id = ?'); params.push(data.deliveryProviderId); }
    if (data.lowStockThreshold !== undefined) { sets.push('low_stock_threshold = ?'); params.push(data.lowStockThreshold); }

    if (sets.length === 0) {
      return current;
    }

    sets.push('updated_at = ?');
    params.push(now);
    params.push(id);

    await db.execute(
      `UPDATE tire_products SET ${sets.join(', ')} WHERE id = ?`,
      params
    );

    return this.getProduct(id);
  }

  async archiveProduct(id: string): Promise<void> {
    await this.getProduct(id); // throws NotFoundError if missing
    const db = await getDb();
    const now = new Date().toISOString();
    await db.execute(
      'UPDATE tire_products SET is_archived = 1, updated_at = ? WHERE id = ?',
      [now, id]
    );
  }
}

export const inventoryService = new InventoryService();
