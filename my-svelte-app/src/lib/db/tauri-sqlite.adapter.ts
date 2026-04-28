import type { DBAdapter } from './db.interface.js';

/**
 * DBAdapter implementation backed by the Tauri SQLite plugin.
 * Only used when running inside a Tauri desktop context.
 */
export class TauriSQLiteAdapter implements DBAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any = null;
  private readonly path: string;

  constructor(path = 'sqlite:jts-ims.db') {
    this.path = path;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getDb(): Promise<any> {
    if (!this.db) {
      // Dynamic import so the module is only resolved on the Tauri target
      const { Database } = await import('@tauri-apps/plugin-sql');
      this.db = await Database.load(this.path);
    }
    return this.db;
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = await this.getDb();
    return db.select<T>(sql, params);
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const db = await this.getDb();
    await db.execute(sql, params);
  }

  async transaction(fn: (tx: DBAdapter) => Promise<void>): Promise<void> {
    const db = await this.getDb();
    // The Tauri SQLite plugin exposes a transaction helper
    await db.execute('BEGIN');
    try {
      // Provide a thin tx adapter that reuses the same connection
      const tx: DBAdapter = {
        query: <T>(sql: string, params: unknown[] = []) => db.select<T>(sql, params),
        execute: (sql: string, params: unknown[] = []) => db.execute(sql, params),
        transaction: (innerFn) => fn(innerFn as unknown as DBAdapter), // nested — reuse same tx
      };
      await fn(tx);
      await db.execute('COMMIT');
    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }
  }
}
