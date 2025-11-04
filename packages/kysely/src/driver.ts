import type {
  DatabaseConnection,
  Driver,
  QueryResult,
  TransactionSettings,
} from "kysely";
import type { SQLiteClient } from "@alexop/sqlite-core";

/**
 * Kysely Driver implementation for SQLite WASM client
 *
 * This driver wraps the @alexop/sqlite-core client and adapts it to Kysely's Driver interface.
 * It manages a single connection since the browser SQLite WASM implementation doesn't use connection pooling.
 */
export class SqliteWebDriver implements Driver {
  private client: SQLiteClient | null = null;
  private connection: SqliteWebConnection | null = null;

  constructor(private readonly clientFactory: () => Promise<SQLiteClient>) {}

  /**
   * Initialize the driver by creating the SQLite client
   */
  async init(): Promise<void> {
    if (!this.client) {
      this.client = await this.clientFactory();
      this.connection = new SqliteWebConnection(this.client);
    }
  }

  /**
   * Acquire a connection (returns the single connection)
   * Since SQLite WASM runs in a single worker, we don't pool connections
   */
  async acquireConnection(): Promise<DatabaseConnection> {
    if (!this.connection) {
      throw new Error("Driver not initialized");
    }
    return this.connection;
  }

  /**
   * Release a connection (no-op for SQLite WASM)
   */
  async releaseConnection(): Promise<void> {
    // No-op: we maintain a single connection
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(
    connection: DatabaseConnection,
    _settings: TransactionSettings
  ): Promise<void> {
    await connection.executeQuery({
      sql: "BEGIN TRANSACTION",
      parameters: [],
      query: {} as never,
    });
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery({
      sql: "COMMIT",
      parameters: [],
      query: {} as never,
    });
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery({
      sql: "ROLLBACK",
      parameters: [],
      query: {} as never,
    });
  }

  /**
   * Destroy the driver and close the connection
   */
  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.connection = null;
    }
  }
}

/**
 * Database connection implementation for SQLite WASM
 * Wraps the raw SQLite client to implement Kysely's DatabaseConnection interface
 */
class SqliteWebConnection implements DatabaseConnection {
  constructor(private readonly client: SQLiteClient) {}

  /**
   * Execute a query and return results
   */
  async executeQuery<R>(compiledQuery: {
    sql: string;
    parameters: readonly unknown[];
  }): Promise<QueryResult<R>> {
    const params = [...compiledQuery.parameters];

    // Check if this is a query that returns rows (SELECT, RETURNING, etc.)
    const isSelectQuery = /^\s*(SELECT|PRAGMA|EXPLAIN)/i.test(compiledQuery.sql);
    const hasReturning = /RETURNING/i.test(compiledQuery.sql);

    if (isSelectQuery || hasReturning) {
      // Query returns rows
      const rows = await this.client.raw<R>(compiledQuery.sql, params);
      return {
        rows,
      };
    }

    // For INSERT/UPDATE/DELETE without RETURNING
    await this.client.exec(compiledQuery.sql, params);

    // For now, we can't easily get lastInsertRowid from the exec response
    // We'll need to query it separately for INSERT statements
    let insertId: bigint | undefined;
    if (/^\s*INSERT/i.test(compiledQuery.sql)) {
      const lastIdRows = await this.client.raw<{ last_insert_rowid: number }>(
        "SELECT last_insert_rowid() as last_insert_rowid"
      );
      if (lastIdRows[0]) {
        insertId = BigInt(lastIdRows[0].last_insert_rowid);
      }
    }

    // Get number of affected rows for UPDATE/DELETE
    let numAffectedRows: bigint | undefined;
    if (/^\s*(UPDATE|DELETE|INSERT)/i.test(compiledQuery.sql)) {
      const changesRows = await this.client.raw<{ changes: number }>(
        "SELECT changes() as changes"
      );
      if (changesRows[0]) {
        numAffectedRows = BigInt(changesRows[0].changes);
      }
    }

    return {
      rows: [] as R[],
      numAffectedRows,
      insertId,
    };
  }

  /**
   * Stream query results (not supported in browser SQLite)
   * Falls back to executeQuery
   */
  async *streamQuery<R>(compiledQuery: {
    sql: string;
    parameters: readonly unknown[];
  }): AsyncIterableIterator<QueryResult<R>> {
    // Browser SQLite doesn't support streaming, so we return all results at once
    yield await this.executeQuery<R>(compiledQuery);
  }
}
