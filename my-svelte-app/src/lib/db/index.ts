import type { DBAdapter } from './db.interface.js';

/**
 * Detect the runtime target and export the appropriate DBAdapter as `db`.
 *
 * - Tauri desktop  → TauriSQLiteAdapter  (uses @tauri-apps/plugin-sql)
 * - Web / SSR      → WaSQLiteAdapter     (uses wa-sqlite WASM)
 *
 * The check is deferred to runtime so the same bundle works on both targets.
 */

function isTauri(): boolean {
  return typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__TAURI__ !== undefined;
}

async function createAdapter(): Promise<DBAdapter> {
  if (isTauri()) {
    const { TauriSQLiteAdapter } = await import('./tauri-sqlite.adapter.js');
    return new TauriSQLiteAdapter();
  }
  const { WaSQLiteAdapter } = await import('./wa-sqlite.adapter.js');
  return new WaSQLiteAdapter();
}

// Singleton promise — resolved once on first import
let _db: DBAdapter | null = null;
let _initPromise: Promise<DBAdapter> | null = null;

export async function getDb(): Promise<DBAdapter> {
  if (_db) return _db;
  if (!_initPromise) {
    _initPromise = createAdapter().then((adapter) => {
      _db = adapter;
      return adapter;
    });
  }
  return _initPromise;
}

/**
 * Synchronous accessor — only valid after `getDb()` has resolved.
 * Throws if called before initialisation.
 */
export function db(): DBAdapter {
  if (!_db) {
    throw new Error('DB not initialised. Await getDb() before calling db().');
  }
  return _db;
}

export type { DBAdapter } from './db.interface.js';
