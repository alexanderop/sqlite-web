import type { App, Plugin } from "vue";
import { SQLITE_CLIENT_KEY } from "./injection";
import {
  type Migration,
  type SchemaRegistry,
  type SQLiteClient,
  createSQLiteClient,
} from "@alexop/sqlite-orm";

/**
 * Configuration options for creating the SQLite Vue plugin
 *
 * @template TSchema - Schema registry mapping table names to Zod schemas
 */
export type SQLiteOptions<TSchema extends SchemaRegistry> = {
  /** Schema registry mapping table names to their Zod object schemas */
  schema: TSchema;
  /** Database filename (stored in OPFS - Origin Private File System) */
  filename: string;
  /** Optional array of database migrations to run on initialization */
  migrations?: Migration[];
};

/**
 * Create a Vue plugin for SQLite with type-safe schema validation
 *
 * This function creates a Vue 3 plugin that provides the SQLite client to your application
 * via dependency injection. The client is automatically initialized and made available
 * through `useSQLiteClientAsync()` composable and as `app.config.globalProperties.$sqlite`.
 *
 * **Important**: The plugin provides a Promise that resolves to the SQLite client, not the
 * client itself. This is because database initialization is asynchronous. Use
 * `useSQLiteClientAsync()` in your components to access the client.
 *
 * @template TSchema - Schema registry mapping table names to Zod schemas
 * @param options - Configuration options including schema, filename, and migrations
 * @returns Vue plugin object with install method
 *
 * @example
 * ```typescript
 * // main.ts
 * import { createApp } from 'vue';
 * import { createSQLite } from '@alexop/sqlite-vue';
 * import { z } from 'zod';
 * import App from './App.vue';
 *
 * const schema = {
 *   users: z.object({
 *     id: z.number(),
 *     name: z.string(),
 *     email: z.string().email()
 *   }),
 *   posts: z.object({
 *     id: z.number(),
 *     userId: z.number(),
 *     title: z.string(),
 *     content: z.string()
 *   })
 * } as const;
 *
 * const sqlitePlugin = createSQLite({
 *   schema,
 *   filename: 'myapp.sqlite3',
 *   migrations: [
 *     {
 *       version: 1,
 *       sql: `
 *         CREATE TABLE users (
 *           id INTEGER PRIMARY KEY AUTOINCREMENT,
 *           name TEXT NOT NULL,
 *           email TEXT NOT NULL UNIQUE
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
 * const app = createApp(App);
 * app.use(sqlitePlugin);
 * app.mount('#app');
 * ```
 *
 * @example
 * ```typescript
 * // Using in a component
 * import { useSQLiteClientAsync } from '@alexop/sqlite-vue';
 *
 * export default {
 *   setup() {
 *     const dbPromise = useSQLiteClientAsync();
 *
 *     async function loadUsers() {
 *       const db = await dbPromise;
 *       const users = await db.query('users').all();
 *       console.log(users);
 *     }
 *
 *     return { loadUsers };
 *   }
 * };
 * ```
 */
export function createSQLite<TSchema extends SchemaRegistry>(
  options: SQLiteOptions<TSchema>
): Plugin {
  const clientPromise = createSQLiteClient(options);

  return {
    install(app: App) {
      // Type assertion needed because injection key uses SchemaRegistry but we have specific TSchema
      app.provide(SQLITE_CLIENT_KEY, clientPromise as unknown as Promise<SQLiteClient<SchemaRegistry>>);
      void clientPromise.then((client) => {
        app.config.globalProperties.$sqlite = client;
      });
    },
  };
}
