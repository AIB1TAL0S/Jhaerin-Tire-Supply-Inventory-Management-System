import type { DBAdapter } from './db.interface.js';

/**
 * Run the full schema SQL against the provided adapter.
 * Uses IF NOT EXISTS guards so it is safe to call on every app launch.
 */
export async function migrate(db: DBAdapter): Promise<void> {
  // Import the schema SQL as a raw string via Vite's ?raw query
  const { default: schemaSql } = await import('./schema.sql?raw');

  // Split on statement boundaries and execute each one individually.
  // SQLite (both adapters) does not support multi-statement execute calls.
  const statements = schemaSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    await db.execute(stmt);
  }
}
