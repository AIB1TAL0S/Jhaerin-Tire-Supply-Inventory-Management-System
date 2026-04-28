import { supabase } from '$lib/supabase.js';
import { getDb } from '$lib/db/index.js';
import { notificationService } from '$lib/services/notification.service.js';
import { createProductSchema } from '$lib/schemas/tire-product.schema.js';
import { stockInSchema } from '$lib/schemas/stock-in.schema.js';
import { stockOutSchema } from '$lib/schemas/stock-out.schema.js';
import { saleSchema } from '$lib/schemas/sales.schema.js';

export interface BackupMeta {
  id: string;
  name: string;
  createdAt: string;
  url: string;
}

export const dataService = {
  /**
   * Trigger a manual backup: dump all local SQLite data to JSON and upload to Supabase Storage.
   * Returns the storage URL of the backup file.
   */
  async triggerBackup(): Promise<string> {
    const db = await getDb();

    const [products, stockIn, stockOut, sales, providers, settings] = await Promise.all([
      db.query('SELECT * FROM tire_products'),
      db.query('SELECT * FROM stock_in_transactions'),
      db.query('SELECT * FROM stock_out_transactions'),
      db.query('SELECT * FROM sales_transactions'),
      db.query('SELECT * FROM delivery_providers'),
      db.query('SELECT * FROM settings')
    ]);

    const backup = {
      version: 1,
      createdAt: new Date().toISOString(),
      data: { products, stockIn, stockOut, sales, providers, settings }
    };

    const json = JSON.stringify(backup, null, 2);
    const filename = `backups/jts-ims-backup-${Date.now()}.json`;

    const blob = new Blob([json], { type: 'application/json' });
    const { error } = await supabase.storage.from('backups').upload(filename, blob, {
      contentType: 'application/json',
      upsert: false
    });

    if (error) throw new Error(`Backup upload failed: ${error.message}`);

    const { data: urlData } = supabase.storage.from('backups').getPublicUrl(filename);

    await notificationService.createNotification(
      'report_ready',
      `Backup created successfully: ${filename}`,
      { url: urlData.publicUrl, filename }
    );

    return urlData.publicUrl;
  },

  /**
   * List available backups from Supabase Storage.
   */
  async listBackups(): Promise<BackupMeta[]> {
    const { data, error } = await supabase.storage.from('backups').list('backups', {
      sortBy: { column: 'created_at', order: 'desc' }
    });

    if (error) throw new Error(`Failed to list backups: ${error.message}`);

    return (data ?? []).map((f) => ({
      id: f.id ?? f.name,
      name: f.name,
      createdAt: f.created_at ?? '',
      url: supabase.storage.from('backups').getPublicUrl(`backups/${f.name}`).data.publicUrl
    }));
  },

  /**
   * Restore a backup by ID: download from Supabase Storage, validate against Zod schemas,
   * then apply to the local SQLite DB. Aborts on validation failure.
   */
  async restoreBackup(backupUrl: string): Promise<void> {
    // Download the backup JSON
    const response = await fetch(backupUrl);
    if (!response.ok) throw new Error(`Failed to download backup: ${response.statusText}`);

    const backup = await response.json() as {
      version: number;
      createdAt: string;
      data: {
        products: Record<string, unknown>[];
        stockIn: Record<string, unknown>[];
        stockOut: Record<string, unknown>[];
        sales: Record<string, unknown>[];
        providers: Record<string, unknown>[];
        settings: Record<string, unknown>[];
      };
    };

    // Validate all records against Zod schemas before touching the DB
    const errors: string[] = [];

    for (const p of backup.data.products) {
      const result = createProductSchema.safeParse({
        brand: p.brand, size: p.size, pattern: p.pattern,
        unitCostPrice: p.unit_cost_price, retailPrice: p.retail_price,
        deliveryProviderId: p.delivery_provider_id ?? null,
        lowStockThreshold: p.low_stock_threshold ?? null
      });
      if (!result.success) errors.push(`Product ${p.id}: ${result.error.message}`);
    }

    for (const s of backup.data.stockIn) {
      const result = stockInSchema.safeParse({
        tireProductId: s.tire_product_id, deliveryProviderId: s.delivery_provider_id ?? null,
        quantity: s.quantity, transactionDate: s.transaction_date, notes: s.notes ?? null
      });
      if (!result.success) errors.push(`StockIn ${s.id}: ${result.error.message}`);
    }

    for (const s of backup.data.stockOut) {
      const result = stockOutSchema.safeParse({
        tireProductId: s.tire_product_id, quantity: s.quantity,
        reason: s.reason, transactionDate: s.transaction_date
      });
      if (!result.success) errors.push(`StockOut ${s.id}: ${result.error.message}`);
    }

    for (const s of backup.data.sales) {
      const result = saleSchema.safeParse({
        tireProductId: s.tire_product_id, quantitySold: s.quantity_sold,
        transactionDate: s.transaction_date
      });
      if (!result.success) errors.push(`Sale ${s.id}: ${result.error.message}`);
    }

    if (errors.length > 0) {
      throw new Error(`Restore aborted — validation failed:\n${errors.slice(0, 5).join('\n')}`);
    }

    // Apply the restore inside a transaction
    const db = await getDb();
    await db.transaction(async (tx) => {
      // Clear existing data (order matters for FK constraints)
      await tx.execute('DELETE FROM sales_transactions');
      await tx.execute('DELETE FROM stock_out_transactions');
      await tx.execute('DELETE FROM stock_in_transactions');
      await tx.execute('DELETE FROM tire_products');
      await tx.execute('DELETE FROM delivery_providers');
      await tx.execute('DELETE FROM settings');

      const now = new Date().toISOString();

      for (const p of backup.data.providers) {
        await tx.execute(
          'INSERT INTO delivery_providers (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
          [p.id, p.name, p.created_at ?? now, p.updated_at ?? now]
        );
      }

      for (const p of backup.data.products) {
        await tx.execute(
          `INSERT INTO tire_products (id, brand, size, pattern, quantity, unit_cost_price, retail_price,
           delivery_provider_id, low_stock_threshold, is_archived, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.id, p.brand, p.size, p.pattern, p.quantity, p.unit_cost_price, p.retail_price,
           p.delivery_provider_id ?? null, p.low_stock_threshold ?? null, p.is_archived ?? 0,
           p.created_at ?? now, p.updated_at ?? now]
        );
      }

      for (const s of backup.data.stockIn) {
        await tx.execute(
          `INSERT INTO stock_in_transactions (id, tire_product_id, delivery_provider_id, quantity, transaction_date, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [s.id, s.tire_product_id, s.delivery_provider_id ?? null, s.quantity, s.transaction_date, s.notes ?? null, s.created_at ?? now, s.updated_at ?? now]
        );
      }

      for (const s of backup.data.stockOut) {
        await tx.execute(
          `INSERT INTO stock_out_transactions (id, tire_product_id, quantity, reason, transaction_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [s.id, s.tire_product_id, s.quantity, s.reason, s.transaction_date, s.created_at ?? now, s.updated_at ?? now]
        );
      }

      for (const s of backup.data.sales) {
        await tx.execute(
          `INSERT INTO sales_transactions (id, tire_product_id, quantity_sold, unit_retail_price, unit_cost_price, revenue, gross_profit, transaction_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [s.id, s.tire_product_id, s.quantity_sold, s.unit_retail_price, s.unit_cost_price, s.revenue, s.gross_profit, s.transaction_date, s.created_at ?? now, s.updated_at ?? now]
        );
      }

      for (const s of backup.data.settings) {
        await tx.execute(
          'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
          [s.key, s.value, s.updated_at ?? now]
        );
      }
    });
  }
};
