import { sqlite3Worker1Promiser } from "@sqlite.org/sqlite-wasm";
import { parseSQLiteError } from "./errors";
import type { Migration } from "./types";

/**
 * Minimal SQLite client for browser using WASM and OPFS
 *
 * Provides low-level access to SQLite in the browser with raw SQL execution,
 * migration support, and pub/sub for reactive updates. No query builder or
 * schema validation - use @alexop/sqlite-orm for those features.
 *
 * @example
 * ```typescript
 * import { createSQLiteClient } from '@alexop/sqlite-core';
 *
 * const db = await createSQLiteClient({
 *   filename: 'myapp.sqlite3',
 *   migrations: [
 *     {
 *       version: 1,
 *       sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)'
 *     }
 *   ]
 * });
 *
 * // Execute raw SQL
 * await db.exec('INSERT INTO users (name) VALUES (?)', ['Alice']);
 *
 * // Query with type safety
 * type User = { id: number; name: string };
 * const users = await db.raw<User>('SELECT * FROM users');
 * ```
 */
export type SQLiteClient = {
  /**
   * Execute raw SQL with parameters
   *
   * For INSERT, UPDATE, DELETE, and DDL statements.
   * Use parameterized queries (?) to prevent SQL injection.
   *
   * @param sql - SQL statement to execute
   * @param params - Optional parameters for placeholders (?)
   * @returns Promise resolving to raw query result
   *
   * @example
   * ```typescript
   * await db.exec('CREATE INDEX idx_email ON users(email)');
   * await db.exec('DELETE FROM users WHERE created_at < ?', [cutoffDate]);
   * ```
   */
  exec(sql: string, params?: unknown[]): Promise<unknown>;

  /**
   * Execute raw SQL query and return typed results
   *
   * For SELECT queries with type safety.
   * Returns result rows as typed array.
   *
   * @template T - Expected row type
   * @param sql - SQL SELECT statement
   * @param params - Optional parameters for placeholders (?)
   * @returns Promise resolving to array of rows
   *
   * @example
   * ```typescript
   * type User = { id: number; name: string; email: string };
   * const users = await db.raw<User>('SELECT * FROM users WHERE age > ?', [18]);
   *
   * type UserCount = { count: number };
   * const result = await db.raw<UserCount>('SELECT COUNT(*) as count FROM users');
   * console.log(result[0].count);
   * ```
   */
  raw<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Close the database connection and release resources
   *
   * Closes the SQLite worker and flushes OPFS storage. After calling close(),
   * all database operations will throw an error. This is essential for proper
   * resource cleanup in SPAs and testing scenarios.
   *
   * Multiple calls to close() are safe (idempotent).
   *
   * @returns Promise that resolves when the database is fully closed
   *
   * @example
   * ```typescript
   * const db = await createSQLiteClient({ filename: 'test.db' });
   * // Use database...
   * await db.close(); // Clean up resources
   * ```
   */
  close(): Promise<void>;

  /**
   * Check if the database connection is closed
   *
   * @returns true if the database has been closed, false otherwise
   *
   * @example
   * ```typescript
   * const db = await createSQLiteClient({ filename: 'test.db' });
   * console.log(db.isClosed()); // false
   * await db.close();
   * console.log(db.isClosed()); // true
   * ```
   */
  isClosed(): boolean;

  /**
   * Subscribe to table change notifications
   *
   * Register a callback to be called when notifyTable() is called for this table.
   * Returns an unsubscribe function. Useful for reactive UI frameworks.
   *
   * @param table - Table name to watch for changes
   * @param cb - Callback function to invoke on changes
   * @returns Unsubscribe function to stop listening
   *
   * @example
   * ```typescript
   * const unsubscribe = db.subscribe('users', () => {
   *   console.log('Users table changed!');
   * });
   *
   * // Later, stop listening
   * unsubscribe();
   * ```
   */
  subscribe(table: string, cb: () => void): () => void;

  /**
   * Notify subscribers that a table has changed
   *
   * Triggers all callbacks registered via subscribe() for this table.
   * Call this after INSERT, UPDATE, or DELETE operations to enable
   * reactive updates in UI frameworks.
   *
   * @param table - Table name that changed
   *
   * @example
   * ```typescript
   * await db.exec('INSERT INTO users (name) VALUES (?)', ['Alice']);
   * db.notifyTable('users'); // Triggers reactive updates
   * ```
   */
  notifyTable(table: string): void;
};

/**
 * Configuration options for creating a SQLite client
 */
export type Options = {
  /** Database filename (stored in OPFS - Origin Private File System) */
  filename: string;
  /** Optional array of database migrations to run on initialization */
  migrations?: Migration[];
};

/**
 * Create a new SQLite client with WASM and OPFS storage
 *
 * Initializes a SQLite database using WASM with OPFS (Origin Private File System)
 * for persistent storage. The database is lazily initialized on the first query.
 * Migrations are automatically applied in order based on version numbers.
 *
 * @param opts - Configuration options including filename and migrations
 * @returns Promise resolving to a configured SQLiteClient instance
 *
 * @example
 * ```typescript
 * import { createSQLiteClient } from '@alexop/sqlite-core';
 *
 * const db = await createSQLiteClient({
 *   filename: 'myapp.sqlite3',
 *   migrations: [
 *     {
 *       version: 1,
 *       sql: `
 *         CREATE TABLE users (
 *           id INTEGER PRIMARY KEY AUTOINCREMENT,
 *           name TEXT NOT NULL,
 *           email TEXT NOT NULL UNIQUE,
 *           createdAt TEXT DEFAULT CURRENT_TIMESTAMP
 *         )
 *       `
 *     },
 *     {
 *       version: 2,
 *       sql: `
 *         CREATE TABLE posts (
 *           id INTEGER PRIMARY KEY AUTOINCREMENT,
 *           userId INTEGER NOT NULL,
 *           title TEXT NOT NULL,
 *           content TEXT NOT NULL,
 *           FOREIGN KEY (userId) REFERENCES users(id)
 *         )
 *       `
 *     }
 *   ]
 * });
 *
 * // Execute raw SQL
 * await db.exec('INSERT INTO users (name, email) VALUES (?, ?)', ['Alice', 'alice@example.com']);
 *
 * // Query with types
 * type User = { id: number; name: string; email: string };
 * const users = await db.raw<User>('SELECT * FROM users');
 * ```
 */
export async function createSQLiteClient(
  opts: Options
): Promise<SQLiteClient> {
  let promiser: ReturnType<typeof sqlite3Worker1Promiser> | null = null;
  let dbId: string | null = null;
  let closed = false;

  const emitter = new Map<string, Set<() => void>>();

  /**
   * Emit table change event to all subscribers
   * @param table - Name of the table that changed
   * @internal
   */
  function emit(table: string) {
    const set = emitter.get(table);
    if (!set) {return;}
    for (const cb of set) {cb();}
  }

  /**
   * Subscribe to table change events
   * @param table - Name of the table to watch
   * @param cb - Callback function to invoke on changes
   * @returns Unsubscribe function
   * @internal
   */
  function subscribe(table: string, cb: () => void) {
    if (!emitter.has(table)) {emitter.set(table, new Set());}
    const tableSet = emitter.get(table);
    if (tableSet) {tableSet.add(cb);}
    return () => {
      const tableSet = emitter.get(table);
      if (tableSet) {tableSet.delete(cb);}
    };
  }

  /**
   * Initialize the SQLite worker and database connection
   * Runs lazily on first query. Also applies any pending migrations.
   * @internal
   */
  async function init() {
    if (promiser && dbId) {return;}

    promiser = await new Promise((resolve) => {
      const p = sqlite3Worker1Promiser({
        onready: () => resolve(p),
      });
    });

    if (!promiser) {
      throw new Error("Failed to initialize SQLite worker");
    }

    const openResponse = await promiser("open", {
      filename: opts.filename,
    });

    if (openResponse.type === "error") {
      throw new Error(openResponse.result?.message || "Failed to open database");
    }

    if (!openResponse.result?.dbId) {
      throw new Error("No database ID returned");
    }

    dbId = openResponse.result.dbId as string;

    if (opts.migrations?.length) {
      // Create migrations tracking table
      await promiser("exec", {
        dbId,
        sql: `
          CREATE TABLE IF NOT EXISTS __migrations__ (
            version INTEGER PRIMARY KEY,
            applied_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `,
      });

      // Get already applied migrations
      const appliedResult = await promiser("exec", {
        dbId, returnValue: "resultRows", rowMode: "object", sql: "SELECT version FROM __migrations__ ORDER BY version",
      });

      const appliedVersions = new Set(
        (appliedResult.result?.resultRows ?? []).map((row) => (row as { version: number }).version)
      );

      // Run pending migrations in order
      // eslint-disable-next-line unicorn/no-array-sort
      const ordered = [...opts.migrations].sort((a, b) => a.version - b.version);
      for (const mig of ordered) {
        if (!appliedVersions.has(mig.version)) {
          // eslint-disable-next-line no-await-in-loop
          await promiser("exec", {
            dbId,
            sql: mig.sql,
          });

          // Record migration as applied
          // eslint-disable-next-line no-await-in-loop
          await promiser("exec", {
            bind: [mig.version], dbId, sql: "INSERT INTO __migrations__ (version) VALUES (?)",
          });
        }
      }
    }
  }

  /**
   * Execute SQL statement with parameters
   * Initializes database if needed. Returns raw result from worker.
   * @param sql - SQL statement to execute
   * @param params - Optional bind parameters for placeholders
   * @returns Raw result from SQLite worker
   * @internal
   */
  async function exec(sql: string, params: unknown[] = []) {
    if (closed) {
      throw new Error("Database is closed");
    }

    if (!promiser || !dbId) {
      await init();
    }

    if (!promiser || !dbId) {
      throw new Error("Database not initialized");
    }

    try {
      const result = await promiser("exec", {
        bind: params, dbId, returnValue: "resultRows", rowMode: "object", sql,
      });

      // Check for errors in the result (in case promiser resolves with error)
      if (result.type === "error" || (result.result as unknown as { errorClass?: string })?.errorClass) {
        const message = result.result?.message || "Query failed";
        throw parseSQLiteError(message, sql);
      }

      return result;
    } catch (error: unknown) {
      // Promiser rejected - check if it's an error object from SQLite
      const err = error as { type?: string; result?: { errorClass?: string; message?: string } };
      if (err?.type === "error" || err?.result?.errorClass) {
        const message = err.result?.message || "Query failed";
        throw parseSQLiteError(message, sql);
      }
      // Re-throw if it's a different kind of error
      throw error;
    }
  }

  /**
   * Execute SQL query and return typed result rows
   * Used by query builders to execute queries with type safety
   * @template T - Expected row type
   * @param sql - SQL query to execute
   * @param params - Optional bind parameters for placeholders
   * @returns Array of result rows
   * @internal
   */
  async function executeQuery<T = unknown>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const res = await exec(sql, params);
    // exec() should have already thrown on error, but double-check
    if (res.type === "error") {
      const message = res.result?.message || "Query failed";
      throw parseSQLiteError(message, sql);
    }
    const rows = res.result?.resultRows ?? [];
    return rows as T[];
  }

  return {
    // Raw query access
    exec,
    raw: executeQuery,

    // Resource management
    async close() {
      if (closed) {return;} // Idempotent - safe to call multiple times

      if (promiser && dbId) {
        await promiser("close", { dbId });
      }

      closed = true;
      promiser = null;
      dbId = null;
      emitter.clear();
    },

    isClosed() {
      return closed;
    },

    // Notifications
    notifyTable: emit,
    subscribe,
  };
}

// Re-export types and utilities
export * from "./types";
export * from "./errors";
