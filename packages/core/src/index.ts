import { sqlite3Worker1Promiser } from "@sqlite.org/sqlite-wasm";
import type { z } from "zod";
import { QueryBuilder } from "./query-builder";
import { DeleteBuilder, InsertBuilder, UpdateBuilder } from "./mutation-builders";
import { Transaction } from "./transaction";
import type { SchemaRegistry, TableName, TableRow } from "./types";

/**
 * Represents a database migration with a version number and SQL statement
 * @example
 * ```typescript
 * const migration: Migration = {
 *   version: 1,
 *   sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)'
 * };
 * ```
 */
export type Migration = {
  /** Unique version number for the migration (must be positive integer) */
  version: number;
  /** SQL statement to execute for this migration */
  sql: string;
};

/**
 * Type-safe SQLite client with Zod schema validation and query builder pattern
 *
 * Provides a fluent API for database operations with compile-time type safety
 * based on your Zod schema definitions. All table names, column names, and values
 * are validated at both compile-time and runtime.
 *
 * @template TSchema - Schema registry mapping table names to Zod schemas
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { createSQLiteClient } from '@alexop/sqlite-core';
 *
 * const schema = {
 *   users: z.object({
 *     id: z.number(),
 *     name: z.string(),
 *     email: z.string().email()
 *   })
 * } as const;
 *
 * const db = await createSQLiteClient({
 *   schema,
 *   filename: 'mydb.sqlite3'
 * });
 *
 * // Type-safe queries
 * const users = await db.query('users').where('name', '=', 'John').all();
 * ```
 */
export type SQLiteClient<TSchema extends SchemaRegistry> = {
  /**
   * Start a SELECT query on a table with full type inference
   *
   * @template TTable - Name of the table to query
   * @param table - Table name (must exist in schema)
   * @returns QueryBuilder instance for chaining WHERE, SELECT, ORDER BY, etc.
   *
   * @example
   * ```typescript
   * // Select all columns
   * const users = await db.query('users').all();
   *
   * // With conditions and projection
   * const emails = await db.query('users')
   *   .where('age', '>', 18)
   *   .select(['email'])
   *   .all();
   * ```
   */
  query<TTable extends TableName<TSchema>>(
    table: TTable
  ): QueryBuilder<TableRow<TSchema, TTable>>;

  /**
   * Start an INSERT operation on a table with Zod validation
   *
   * @template TTable - Name of the table to insert into
   * @param table - Table name (must exist in schema)
   * @returns InsertBuilder instance for adding values
   *
   * @example
   * ```typescript
   * // Single insert
   * await db.insert('users').values({
   *   name: 'Alice',
   *   email: 'alice@example.com'
   * });
   *
   * // Batch insert
   * await db.insert('users').values([
   *   { name: 'Bob', email: 'bob@example.com' },
   *   { name: 'Charlie', email: 'charlie@example.com' }
   * ]);
   * ```
   */
  insert<TTable extends TableName<TSchema>>(
    table: TTable
  ): InsertBuilder<TableRow<TSchema, TTable>>;

  /**
   * Start an UPDATE operation on a table with Zod validation
   *
   * @template TTable - Name of the table to update
   * @param table - Table name (must exist in schema)
   * @returns UpdateBuilder instance for setting values and conditions
   *
   * @example
   * ```typescript
   * await db.update('users')
   *   .where('id', '=', 1)
   *   .set({ name: 'Updated Name' })
   *   .execute();
   * ```
   */
  update<TTable extends TableName<TSchema>>(
    table: TTable
  ): UpdateBuilder<TableRow<TSchema, TTable>>;

  /**
   * Start a DELETE operation on a table
   *
   * @template TTable - Name of the table to delete from
   * @param table - Table name (must exist in schema)
   * @returns DeleteBuilder instance for adding WHERE conditions
   *
   * @example
   * ```typescript
   * await db.delete('users')
   *   .where('id', '=', 1)
   *   .execute();
   * ```
   */
  delete<TTable extends TableName<TSchema>>(
    table: TTable
  ): DeleteBuilder<TableRow<TSchema, TTable>>;

  /**
   * Execute a function within an automatic transaction
   *
   * Automatically begins a transaction, executes the function, and commits.
   * If the function throws an error, the transaction is automatically rolled back.
   *
   * @template T - Return type of the transaction function
   * @param fn - Async function that receives a Transaction instance
   * @returns Promise resolving to the function's return value
   *
   * @example
   * ```typescript
   * await db.transaction(async (tx) => {
   *   await tx.insert('users').values({ name: 'Alice' });
   *   await tx.insert('posts').values({ userId: 1, title: 'Hello' });
   *   // Automatically commits if successful, rolls back on error
   * });
   * ```
   */
  transaction<T>(
    fn: (tx: Transaction<TSchema>) => Promise<T>
  ): Promise<T>;

  /**
   * Begin a manual transaction
   *
   * Use this when you need explicit control over commit/rollback timing.
   * Don't forget to call commit() or rollback() when done.
   *
   * @returns Promise resolving to a Transaction instance
   *
   * @example
   * ```typescript
   * const tx = await db.beginTransaction();
   * try {
   *   await tx.insert('users').values({ name: 'Alice' });
   *   await tx.commit();
   * } catch (error) {
   *   await tx.rollback();
   *   throw error;
   * }
   * ```
   */
  beginTransaction(): Promise<Transaction<TSchema>>;

  /**
   * Notify subscribers that a table has changed
   *
   * Use this after mutations to trigger reactive updates in Vue components
   * using useSQLiteQuery(). Call this after INSERT, UPDATE, or DELETE operations.
   *
   * @param table - Table name that changed
   *
   * @example
   * ```typescript
   * await db.insert('todos').values({ title: 'New todo' });
   * db.notifyTable('todos'); // Triggers reactive updates
   * ```
   */
  notifyTable(table: TableName<TSchema>): void;

  /**
   * Subscribe to table change notifications
   *
   * Register a callback to be called when notifyTable() is called for this table.
   * Returns an unsubscribe function.
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
  subscribe(table: TableName<TSchema>, cb: () => void): () => void;

  /**
   * Execute raw SQL with parameters
   *
   * For advanced use cases that require direct SQL execution.
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
   * Similar to exec() but returns result rows as typed array.
   * Use this for SELECT queries when you need direct SQL control.
   *
   * @template T - Expected row type
   * @param sql - SQL SELECT statement
   * @param params - Optional parameters for placeholders (?)
   * @returns Promise resolving to array of rows
   *
   * @example
   * ```typescript
   * type UserCount = { count: number };
   * const result = await db.raw<UserCount>(
   *   'SELECT COUNT(*) as count FROM users WHERE age > ?',
   *   [18]
   * );
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
   * const db = await createSQLiteClient({ ... });
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
   * const db = await createSQLiteClient({ ... });
   * console.log(db.isClosed()); // false
   * await db.close();
   * console.log(db.isClosed()); // true
   * ```
   */
  isClosed(): boolean;
};

/**
 * Configuration options for creating a SQLite client
 * @template TSchema - Schema registry mapping table names to Zod schemas
 */
type Options<TSchema extends SchemaRegistry> = {
  /** Schema registry mapping table names to their Zod object schemas */
  schema: TSchema;
  /** Database filename (stored in OPFS - Origin Private File System) */
  filename: string;
  /** Optional array of database migrations to run on initialization */
  migrations?: Migration[];
};

/**
 * Create a new SQLite client with type-safe schema validation
 *
 * Initializes a SQLite database using WASM with OPFS (Origin Private File System)
 * for persistent storage. The database is lazily initialized on the first query.
 * Migrations are automatically applied in order based on version numbers.
 *
 * @template TSchema - Schema registry mapping table names to Zod schemas
 * @param opts - Configuration options including schema, filename, and migrations
 * @returns Promise resolving to a configured SQLiteClient instance
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { createSQLiteClient } from '@alexop/sqlite-core';
 *
 * const schema = {
 *   users: z.object({
 *     id: z.number(),
 *     name: z.string(),
 *     email: z.string().email(),
 *     createdAt: z.string().optional()
 *   }),
 *   posts: z.object({
 *     id: z.number(),
 *     userId: z.number(),
 *     title: z.string(),
 *     content: z.string()
 *   })
 * } as const;
 *
 * const db = await createSQLiteClient({
 *   schema,
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
 * // Now you can use the client with full type safety
 * const users = await db.query('users').all();
 * ```
 */
export async function createSQLiteClient<TSchema extends SchemaRegistry>(
  opts: Options<TSchema>
): Promise<SQLiteClient<TSchema>> {
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
    if (!set) return;
    for (const cb of set) cb();
  }

  /**
   * Subscribe to table change events
   * @param table - Name of the table to watch
   * @param cb - Callback function to invoke on changes
   * @returns Unsubscribe function
   * @internal
   */
  function subscribe(table: string, cb: () => void) {
    if (!emitter.has(table)) emitter.set(table, new Set());
    const tableSet = emitter.get(table);
    if (tableSet) tableSet.add(cb);
    return () => {
      const tableSet = emitter.get(table);
      if (tableSet) tableSet.delete(cb);
    };
  }

  /**
   * Initialize the SQLite worker and database connection
   * Runs lazily on first query. Also applies any pending migrations.
   * @internal
   */
  async function init() {
    if (promiser && dbId) return;

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
      const ordered = opts.migrations.slice().sort((a, b) => a.version - b.version);
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

    const result = await promiser("exec", {
      bind: params, dbId, returnValue: "resultRows", rowMode: "object", sql,
    });

    if (result.type === "error") {
      throw new Error(result.result?.message || "Query failed");
    }

    return result;
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
    const rows = res.result?.resultRows ?? [];
    return rows as T[];
  }

  return {
    // Query builder
    query<TTable extends TableName<TSchema>>(table: TTable) {
      const schema = opts.schema[table] as z.ZodObject<z.ZodRawShape>;
      return new QueryBuilder(executeQuery, String(table), schema);
    },

    // Insert builder
    insert<TTable extends TableName<TSchema>>(table: TTable) {
      const schema = opts.schema[table] as z.ZodObject<z.ZodRawShape>;
      return new InsertBuilder(executeQuery, String(table), schema);
    },

    // Update builder
    update<TTable extends TableName<TSchema>>(table: TTable) {
      const schema = opts.schema[table] as z.ZodObject<z.ZodRawShape>;
      return new UpdateBuilder(executeQuery, String(table), schema);
    },

    // Delete builder
    delete<TTable extends TableName<TSchema>>(table: TTable) {
      return new DeleteBuilder(executeQuery, String(table));
    },

    // Transaction support
    async transaction<T>(fn: (tx: Transaction<TSchema>) => Promise<T>): Promise<T> {
      await executeQuery("BEGIN TRANSACTION", []);
      const tx = new Transaction(executeQuery, opts.schema);

      try {
        const result = await fn(tx);
        await tx.commit();
        return result;
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    },

    async beginTransaction(): Promise<Transaction<TSchema>> {
      await executeQuery("BEGIN TRANSACTION", []);
      return new Transaction(executeQuery, opts.schema);
    },

    // Notifications
    notifyTable: emit,
    subscribe,

    // Raw query access
    exec,
    raw: executeQuery,

    // Resource management
    async close() {
      if (closed) return; // Idempotent - safe to call multiple times

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
  };
}

// Re-export types and utilities
export * from "./types";
export * from "./zod-utils";
export { QueryBuilder } from "./query-builder";
export { InsertBuilder, UpdateBuilder, DeleteBuilder } from "./mutation-builders";
export { Transaction } from "./transaction";
