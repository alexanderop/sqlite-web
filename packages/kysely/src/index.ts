/**
 * @alexop/sqlite-kysely
 *
 * Kysely dialect for browser-based SQLite using @alexop/sqlite-core.
 * Enables type-safe SQL query building with Kysely in the browser using SQLite WASM and OPFS.
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
 *       filename: 'myapp.db'
 *     })
 *   })
 * });
 *
 * // Use Kysely's type-safe query builder
 * const users = await db
 *   .selectFrom('users')
 *   .select(['name', 'email'])
 *   .where('email', 'like', '%@example.com')
 *   .execute();
 * ```
 *
 * @packageDocumentation
 */

export { SqliteWebDialect } from "./dialect";
export type { SqliteWebDialectConfig } from "./dialect";
export { SqliteWebDriver } from "./driver";
