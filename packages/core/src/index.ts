import { sqlite3Worker1Promiser } from "@sqlite.org/sqlite-wasm";
import type { z } from "zod";
import { QueryBuilder } from "./query-builder";
import { DeleteBuilder, InsertBuilder, UpdateBuilder } from "./mutation-builders";
import { Transaction } from "./transaction";
import type { SchemaRegistry, TableName, TableRow } from "./types";

export type Migration = {
  version: number;
  sql: string;
};

/**
 * Type-safe SQLite client with Zod schema validation
 */
export type SQLiteClient<TSchema extends SchemaRegistry> = {
  // Query builder for SELECT queries
  query<TTable extends TableName<TSchema>>(
    table: TTable
  ): QueryBuilder<TableRow<TSchema, TTable>>;

  // Mutation builders
  insert<TTable extends TableName<TSchema>>(
    table: TTable
  ): InsertBuilder<TableRow<TSchema, TTable>>;

  update<TTable extends TableName<TSchema>>(
    table: TTable
  ): UpdateBuilder<TableRow<TSchema, TTable>>;

  delete<TTable extends TableName<TSchema>>(
    table: TTable
  ): DeleteBuilder<TableRow<TSchema, TTable>>;

  // Transaction support
  transaction<T>(
    fn: (tx: Transaction<TSchema>) => Promise<T>
  ): Promise<T>;
  beginTransaction(): Promise<Transaction<TSchema>>;

  // Table change notifications
  notifyTable(table: TableName<TSchema>): void;
  subscribe(table: TableName<TSchema>, cb: () => void): () => void;

  // Raw query access for advanced usage
  exec(sql: string, params?: unknown[]): Promise<unknown>;
  raw<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
};

type Options<TSchema extends SchemaRegistry> = {
  schema: TSchema;
  filename: string;
  migrations?: Migration[];
};

export async function createSQLiteClient<TSchema extends SchemaRegistry>(
  opts: Options<TSchema>
): Promise<SQLiteClient<TSchema>> {
  let promiser: ReturnType<typeof sqlite3Worker1Promiser> | null = null;
  let dbId: string | null = null;

  const emitter = new Map<string, Set<() => void>>();

  function emit(table: string) {
    const set = emitter.get(table);
    if (!set) return;
    for (const cb of set) cb();
  }

  function subscribe(table: string, cb: () => void) {
    if (!emitter.has(table)) emitter.set(table, new Set());
    const tableSet = emitter.get(table);
    if (tableSet) tableSet.add(cb);
    return () => {
      const tableSet = emitter.get(table);
      if (tableSet) tableSet.delete(cb);
    };
  }

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

  async function exec(sql: string, params: unknown[] = []) {
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
  };
}

// Re-export types and utilities
export * from "./types";
export * from "./zod-utils";
export { QueryBuilder } from "./query-builder";
export { InsertBuilder, UpdateBuilder, DeleteBuilder } from "./mutation-builders";
export { Transaction } from "./transaction";
