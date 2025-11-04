import type {
  SQLiteClient as CoreClient,
  Migration,
} from "@alexop/sqlite-core";
import type { z } from "zod";
import { QueryBuilder } from "./query-builder";
import {
  InsertBuilder,
  UpdateBuilder,
  DeleteBuilder,
} from "./mutation-builders";
import { Transaction } from "./transaction";
import type { SchemaRegistry, TableName, TableRow } from "./types";

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
 * import { createSQLiteClient } from '@alexop/sqlite-orm';
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
  transaction<T>(fn: (tx: Transaction<TSchema>) => Promise<T>): Promise<T>;

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
export type Options<TSchema extends SchemaRegistry> = {
  /** Schema registry mapping table names to their Zod object schemas */
  schema: TSchema;
  /** Database filename (stored in OPFS - Origin Private File System) */
  filename: string;
  /** Optional array of database migrations to run on initialization */
  migrations?: Migration[];
};

/**
 * Create a wrapper around the core SQLite client that adds ORM functionality
 * @internal
 */
export function createClientWrapper<TSchema extends SchemaRegistry>(
  coreClient: CoreClient,
  schema: TSchema
): SQLiteClient<TSchema> {
  // Helper to execute queries
  async function executeQuery<T = unknown>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    return coreClient.raw<T>(sql, params);
  }

  return {
    // Query builder
    query<TTable extends TableName<TSchema>>(table: TTable) {
      const tableSchema = schema[table] as z.ZodObject<z.ZodRawShape>;
      return QueryBuilder.create<TableRow<TSchema, TTable>>(
        executeQuery,
        String(table),
        tableSchema
      );
    },

    // Insert builder
    insert<TTable extends TableName<TSchema>>(table: TTable) {
      const tableSchema = schema[table] as z.ZodObject<z.ZodRawShape>;
      return new InsertBuilder(executeQuery, String(table), tableSchema);
    },

    // Update builder
    update<TTable extends TableName<TSchema>>(table: TTable) {
      const tableSchema = schema[table] as z.ZodObject<z.ZodRawShape>;
      return new UpdateBuilder(executeQuery, String(table), tableSchema);
    },

    // Delete builder
    delete<TTable extends TableName<TSchema>>(table: TTable) {
      return new DeleteBuilder(executeQuery, String(table));
    },

    // Transaction support
    async transaction<T>(
      fn: (tx: Transaction<TSchema>) => Promise<T>
    ): Promise<T> {
      await executeQuery("BEGIN TRANSACTION", []);
      const tx = new Transaction(executeQuery, schema);

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
      return new Transaction(executeQuery, schema);
    },

    // Pass-through methods to core client
    notifyTable(table: TableName<TSchema>) {
      coreClient.notifyTable(String(table));
    },

    subscribe(table: TableName<TSchema>, cb: () => void) {
      return coreClient.subscribe(String(table), cb);
    },

    exec(sql: string, params?: unknown[]) {
      return coreClient.exec(sql, params);
    },

    raw<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
      return coreClient.raw<T>(sql, params);
    },

    close() {
      return coreClient.close();
    },

    isClosed() {
      return coreClient.isClosed();
    },
  };
}
