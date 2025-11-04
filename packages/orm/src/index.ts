import { createSQLiteClient as createCoreClient } from "@alexop/sqlite-core";
import { createClientWrapper, type Options, type SQLiteClient } from "./client";

/**
 * Create a new SQLite client with type-safe schema validation and ORM features
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
 * import { createSQLiteClient } from '@alexop/sqlite-orm';
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
export async function createSQLiteClient<
  TSchema extends import("./types").SchemaRegistry,
>(opts: Options<TSchema>): Promise<SQLiteClient<TSchema>> {
  const coreClient = await createCoreClient({
    filename: opts.filename,
    migrations: opts.migrations,
  });

  return createClientWrapper(coreClient, opts.schema);
}

// Re-export everything from core for convenience
export * from "@alexop/sqlite-core";

// Export ORM-specific types and utilities
export * from "./types";
export * from "./query-builder";
export * from "./mutation-builders";
export * from "./transaction";
export * from "./zod-utils";
export * from "./errors";
export type { SQLiteClient, Options } from "./client";
