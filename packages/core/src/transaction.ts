import type { z } from "zod";
import { QueryBuilder } from "./query-builder";
import { InsertBuilder, UpdateBuilder, DeleteBuilder } from "./mutation-builders";
import type { SchemaRegistry, TableName, TableRow } from "./types";

/**
 * Transaction state enum
 */
enum TransactionState {
  Active = "active",
  Committed = "committed",
  RolledBack = "rolledback",
}

/**
 * Transaction class that wraps SQLite BEGIN/COMMIT/ROLLBACK
 */
export class Transaction<TSchema extends SchemaRegistry> {
  private state: TransactionState = TransactionState.Active;

  constructor(
    private executeQuery: (sql: string, params: unknown[]) => Promise<any>,
    private schema: TSchema
  ) {}

  /**
   * Check if transaction is active
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
   * Query builder for SELECT queries
   */
  query<TTable extends TableName<TSchema>>(table: TTable): QueryBuilder<TableRow<TSchema, TTable>> {
    this.ensureActive();
    const tableSchema = this.schema[table] as z.ZodObject<any>;
    return new QueryBuilder(this.executeQuery, String(table), tableSchema);
  }

  /**
   * Insert builder
   */
  insert<TTable extends TableName<TSchema>>(table: TTable): InsertBuilder<TableRow<TSchema, TTable>> {
    this.ensureActive();
    const tableSchema = this.schema[table] as z.ZodObject<any>;
    return new InsertBuilder(this.executeQuery, String(table), tableSchema);
  }

  /**
   * Update builder
   */
  update<TTable extends TableName<TSchema>>(table: TTable): UpdateBuilder<TableRow<TSchema, TTable>> {
    this.ensureActive();
    const tableSchema = this.schema[table] as z.ZodObject<any>;
    return new UpdateBuilder(this.executeQuery, String(table), tableSchema);
  }

  /**
   * Delete builder
   */
  delete<TTable extends TableName<TSchema>>(table: TTable): DeleteBuilder<TableRow<TSchema, TTable>> {
    this.ensureActive();
    return new DeleteBuilder(this.executeQuery, String(table));
  }

  /**
   * Commit the transaction
   */
  async commit(): Promise<void> {
    this.ensureActive();
    await this.executeQuery("COMMIT", []);
    this.state = TransactionState.Committed;
  }

  /**
   * Rollback the transaction
   */
  async rollback(): Promise<void> {
    if (this.state !== TransactionState.Active) {
      return; // Already committed or rolled back
    }
    await this.executeQuery("ROLLBACK", []);
    this.state = TransactionState.RolledBack;
  }
}
