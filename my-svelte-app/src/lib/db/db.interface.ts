/**
 * Platform-agnostic database adapter interface.
 * Implemented by TauriSQLiteAdapter (desktop) and WaSQLiteAdapter (web).
 */
export interface DBAdapter {
  /**
   * Execute a SELECT query and return typed rows.
   */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Execute an INSERT / UPDATE / DELETE statement.
   */
  execute(sql: string, params?: unknown[]): Promise<void>;

  /**
   * Run a set of operations inside a single SQLite transaction.
   * The callback receives a transaction-scoped adapter.
   * If the callback throws, the transaction is rolled back.
   */
  transaction(fn: (tx: DBAdapter) => Promise<void>): Promise<void>;
}
