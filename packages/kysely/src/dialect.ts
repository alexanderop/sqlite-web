import type {
  Dialect,
  DialectAdapter,
  Driver,
  QueryCompiler,
} from "kysely";
import {
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from "kysely";
import type { SQLiteClient } from "@alexop/sqlite-core";
import { SqliteWebDriver } from "./driver";

/**
 * Configuration options for SqliteWebDialect
 */
export interface SqliteWebDialectConfig {
  /**
   * SQLite client instance or factory function that creates one.
   * The factory function is called once when the dialect is initialized.
   *
   * @example
   * ```typescript
   * import { createSQLiteClient } from '@alexop/sqlite-core';
   *
   * new SqliteWebDialect({
   *   database: async () => createSQLiteClient({ filename: 'myapp.db' })
   * })
   * ```
   */
  database: SQLiteClient | (() => Promise<SQLiteClient>);
}

/**
 * Kysely dialect for browser-based SQLite using @alexop/sqlite-core
 *
 * This dialect enables Kysely to work with SQLite WASM in the browser,
 * using OPFS (Origin Private File System) for persistent storage.
 *
 * @example
 * ```typescript
 * import { Kysely } from 'kysely';
 * import { SqliteWebDialect } from '@alexop/sqlite-kysely';
 * import { createSQLiteClient } from '@alexop/sqlite-core';
 *
 * interface Database {
 *   users: {
 *     id: number;
 *     name: string;
 *     email: string;
 *   };
 * }
 *
 * const db = new Kysely<Database>({
 *   dialect: new SqliteWebDialect({
 *     database: async () => createSQLiteClient({
 *       filename: 'myapp.db',
 *       migrations: [...]
 *     })
 *   })
 * });
 *
 * // Use Kysely query builder
 * const users = await db
 *   .selectFrom('users')
 *   .select(['name', 'email'])
 *   .where('email', 'like', '%@example.com')
 *   .execute();
 * ```
 */
export class SqliteWebDialect implements Dialect {
  private config: SqliteWebDialectConfig;

  constructor(config: SqliteWebDialectConfig) {
    this.config = config;
  }

  /**
   * Creates a driver instance that manages the SQLite connection
   */
  createDriver(): Driver {
    return new SqliteWebDriver(async () => {
      if (typeof this.config.database === "function") {
        return await this.config.database();
      }
      return this.config.database;
    });
  }

  /**
   * Creates a query compiler for SQLite
   * Uses Kysely's built-in SQLite query compiler
   */
  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler();
  }

  /**
   * Creates a dialect adapter for SQLite
   * Uses Kysely's built-in SQLite adapter
   */
  createAdapter(): DialectAdapter {
    return new SqliteAdapter();
  }

  /**
   * Creates a database introspector for SQLite schema metadata
   * Uses Kysely's built-in SQLite introspector
   */
  createIntrospector(db: Kysely<unknown>): SqliteIntrospector {
    return new SqliteIntrospector(db);
  }
}
