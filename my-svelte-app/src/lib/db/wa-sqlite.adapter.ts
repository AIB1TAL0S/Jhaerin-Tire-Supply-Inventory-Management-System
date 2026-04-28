import type { DBAdapter } from './db.interface.js';

/**
 * DBAdapter implementation backed by wa-sqlite (WebAssembly SQLite).
 * Used on the web target (Cloudflare Pages) where the Tauri plugin is unavailable.
 */
export class WaSQLiteAdapter implements DBAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sqlite3: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any = null;
  private readonly dbName: string;
  private initPromise: Promise<void> | null = null;

  constructor(dbName = 'jts-ims') {
    this.dbName = dbName;
  }

  private async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      // Dynamic imports keep wa-sqlite out of the Tauri bundle
      const SQLiteESMFactory = (await import('wa-sqlite/dist/wa-sqlite-async.mjs')).default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { IDBBatchAtomicVFS } = await import('wa-sqlite/src/examples/IDBBatchAtomicVFS.js') as any;
      const sqlite3 = await SQLiteESMFactory();
      const vfs = await IDBBatchAtomicVFS.create(this.dbName, sqlite3);
      sqlite3.vfs_register(vfs, true);
      this.db = await sqlite3.open_v2(this.dbName);
      this.sqlite3 = sqlite3;
    })();
    return this.initPromise;
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.init();
    const rows: T[] = [];
    for await (const stmt of this.sqlite3.statements(this.db, sql)) {
      // Bind parameters
      if (params.length) {
        this.sqlite3.bind_collection(stmt, params);
      }
      const columns: string[] = this.sqlite3.column_names(stmt);
      while ((await this.sqlite3.step(stmt)) === /* SQLITE_ROW */ 100) {
        const row = this.sqlite3.row(stmt);
        const obj: Record<string, unknown> = {};
        columns.forEach((col, i) => { obj[col] = row[i]; });
        rows.push(obj as T);
      }
    }
    return rows;
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    await this.init();
    for await (const stmt of this.sqlite3.statements(this.db, sql)) {
      if (params.length) {
        this.sqlite3.bind_collection(stmt, params);
      }
      await this.sqlite3.step(stmt);
    }
  }

  async transaction(fn: (tx: DBAdapter) => Promise<void>): Promise<void> {
    await this.execute('BEGIN');
    try {
      // Provide a tx-scoped adapter that shares the same connection
      const tx: DBAdapter = {
        query: <T>(sql: string, p: unknown[] = []) => this.query<T>(sql, p),
        execute: (sql: string, p: unknown[] = []) => this.execute(sql, p),
        transaction: (innerFn) => this.transaction(innerFn),
      };
      await fn(tx);
      await this.execute('COMMIT');
    } catch (err) {
      await this.execute('ROLLBACK');
      throw err;
    }
  }
}
