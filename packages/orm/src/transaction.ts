import type { z } from "zod";
import { QueryBuilder } from "./query-builder";
import { DeleteBuilder, InsertBuilder, UpdateBuilder } from "./mutation-builders";
import type { SchemaRegistry, TableName, TableRow } from "./types";

/**
 * Transaction state enum
 * @internal
 */
enum TransactionState {
  /** Transaction is active and can accept operations */
  Active = "active",
  /** Transaction has been committed */
  Committed = "committed",
  /** Transaction has been rolled back */
  RolledBack = "rolledback",
}

/**
 * Transaction class that wraps SQLite BEGIN/COMMIT/ROLLBACK
 *
 * Provides transactional semantics for database operations. All operations within
 * a transaction are atomic - they either all succeed (commit) or all fail (rollback).
 * Once a transaction is committed or rolled back, it cannot be reused.
 *
 * @template TSchema - Schema registry mapping table names to Zod schemas
 *
 * @example
 * ```typescript
 * // Automatic transaction (recommended)
 * await db.transaction(async (tx) => {
 *   await tx.insert('users').values({ name: 'Alice' });
 *   await tx.insert('posts').values({ userId: 1, title: 'Hello' });
 *   // Automatically commits if successful, rolls back on error
 * });
 *
 * // Manual transaction (advanced)
 * const tx = await db.beginTransaction();
 * try {
 *   const userId = await tx.insert('users').values({ name: 'Bob' });
 *   await tx.insert('posts').values({ userId, title: 'World' });
 *   await tx.commit();
 * } catch (error) {
 *   await tx.rollback();
 *   throw error;
 * }
 * ```
 */
export class Transaction<TSchema extends SchemaRegistry> {
  private state: TransactionState = TransactionState.Active;

  /**
   * Create a new Transaction instance
   * @param executeQuery - Function to execute SQL queries
   * @param schema - Schema registry for type safety
   * @internal
   */
  constructor(
    private executeQuery: <T = unknown>(sql: string, params: unknown[]) => Promise<T[]>,
    private schema: TSchema
  ) {}

  /**
   * Ensure transaction is still active before performing operations
   * @throws {Error} If transaction has been committed or rolled back
   * @internal
   */
  private ensureActive(): void {
    if (this.state === TransactionState.Committed) {
      throw new Error("Cannot perform operations on committed transaction");
    }
    if (this.state === TransactionState.RolledBack) {
      throw new Error("Cannot perform operations on rolled back transaction");
    }
  }

  /**
   * Start a SELECT query within this transaction
   *
   * All queries within a transaction see a consistent snapshot of the database,
   * including uncommitted changes from earlier operations in the same transaction.
   *
   * @template TTable - Name of the table to query
   * @param table - Table name (must exist in schema)
   * @returns QueryBuilder instance for chaining
   * @throws {Error} If transaction is not active
   *
   * @example
   * ```typescript
   * await db.transaction(async (tx) => {
   *   // Query sees changes from within transaction
   *   const users = await tx.query('users')
   *     .where('status', '=', 'active')
   *     .all();
   * });
   * ```
   */
  query<TTable extends TableName<TSchema>>(table: TTable): QueryBuilder<TableRow<TSchema, TTable>> {
    this.ensureActive();
    const tableSchema = this.schema[table] as z.ZodObject<z.ZodRawShape>;
    return QueryBuilder.create<TableRow<TSchema, TTable>>(this.executeQuery, String(table), tableSchema);
  }

  /**
   * Start an INSERT operation within this transaction
   *
   * Inserted rows are only visible within this transaction until commit.
   * If the transaction is rolled back, the insert is undone.
   *
   * @template TTable - Name of the table to insert into
   * @param table - Table name (must exist in schema)
   * @returns InsertBuilder instance for adding values
   * @throws {Error} If transaction is not active
   *
   * @example
   * ```typescript
   * await db.transaction(async (tx) => {
   *   const userId = await tx.insert('users')
   *     .values({ name: 'Alice' });
   *   await tx.insert('profiles')
   *     .values({ userId, bio: 'Hello' });
   * });
   * ```
   */
  insert<TTable extends TableName<TSchema>>(table: TTable): InsertBuilder<TableRow<TSchema, TTable>> {
    this.ensureActive();
    const tableSchema = this.schema[table] as z.ZodObject<z.ZodRawShape>;
    return new InsertBuilder(this.executeQuery, String(table), tableSchema);
  }

  /**
   * Start an UPDATE operation within this transaction
   *
   * Updated rows are only visible within this transaction until commit.
   * If the transaction is rolled back, the update is undone.
   *
   * @template TTable - Name of the table to update
   * @param table - Table name (must exist in schema)
   * @returns UpdateBuilder instance for setting values and conditions
   * @throws {Error} If transaction is not active
   *
   * @example
   * ```typescript
   * await db.transaction(async (tx) => {
   *   await tx.update('users')
   *     .where('id', '=', 1)
   *     .set({ status: 'verified' });
   * });
   * ```
   */
  update<TTable extends TableName<TSchema>>(table: TTable): UpdateBuilder<TableRow<TSchema, TTable>> {
    this.ensureActive();
    const tableSchema = this.schema[table] as z.ZodObject<z.ZodRawShape>;
    return new UpdateBuilder(this.executeQuery, String(table), tableSchema);
  }

  /**
   * Start a DELETE operation within this transaction
   *
   * Deleted rows are only removed within this transaction until commit.
   * If the transaction is rolled back, the delete is undone.
   *
   * @template TTable - Name of the table to delete from
   * @param table - Table name (must exist in schema)
   * @returns DeleteBuilder instance for adding WHERE conditions
   * @throws {Error} If transaction is not active
   *
   * @example
   * ```typescript
   * await db.transaction(async (tx) => {
   *   await tx.delete('sessions')
   *     .where('expiresAt', '<', Date.now());
   * });
   * ```
   */
  delete<TTable extends TableName<TSchema>>(table: TTable): DeleteBuilder<TableRow<TSchema, TTable>> {
    this.ensureActive();
    return new DeleteBuilder(this.executeQuery, String(table));
  }

  /**
   * Commit the transaction and persist all changes
   *
   * Makes all changes from INSERT, UPDATE, and DELETE operations permanent
   * and visible to other database connections. After committing, the transaction
   * cannot be used anymore.
   *
   * @throws {Error} If transaction is not active
   *
   * @example
   * ```typescript
   * const tx = await db.beginTransaction();
   * try {
   *   await tx.insert('users').values({ name: 'Alice' });
   *   await tx.insert('users').values({ name: 'Bob' });
   *   await tx.commit(); // Both inserts are now permanent
   * } catch (error) {
   *   await tx.rollback();
   *   throw error;
   * }
   * ```
   */
  async commit(): Promise<void> {
    this.ensureActive();
    await this.executeQuery("COMMIT", []);
    this.state = TransactionState.Committed;
  }

  /**
   * Rollback the transaction and undo all changes
   *
   * Discards all changes from INSERT, UPDATE, and DELETE operations made within
   * this transaction. The database returns to the state it was in before the
   * transaction began. Safe to call multiple times (subsequent calls are no-ops).
   *
   * @example
   * ```typescript
   * const tx = await db.beginTransaction();
   * try {
   *   await tx.insert('users').values({ name: 'Alice' });
   *   throw new Error('Something went wrong');
   * } catch (error) {
   *   await tx.rollback(); // Insert is undone
   *   console.log('Transaction rolled back');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Automatic rollback with db.transaction()
   * try {
   *   await db.transaction(async (tx) => {
   *     await tx.insert('users').values({ name: 'Alice' });
   *     throw new Error('Oops');
   *     // Automatically rolls back on error
   *   });
   * } catch (error) {
   *   console.log('Transaction failed and was rolled back');
   * }
   * ```
   */
  async rollback(): Promise<void> {
    if (this.state !== TransactionState.Active) {
      return; // Already committed or rolled back
    }
    await this.executeQuery("ROLLBACK", []);
    this.state = TransactionState.RolledBack;
  }
}
