import { inject } from "vue";
import { SQLITE_CLIENT_KEY } from "./injection";
import type { SQLiteClient, SchemaRegistry } from "@alexop/sqlite-orm";

/**
 * Composable to access the SQLite client promise in Vue components
 *
 * Returns a Promise that resolves to the SQLite client. This composable retrieves
 * the client promise from Vue's dependency injection system.
 *
 * **CRITICAL USAGE REQUIREMENT**: This composable MUST be called during component setup,
 * NOT inside async functions or callbacks. This is because it uses Vue's `inject()` API
 * which only works during the synchronous setup phase.
 *
 * @returns Promise that resolves to the SQLite client
 * @throws {Error} If the SQLite plugin was not installed via `app.use(createSQLite(...))`
 *
 * @example
 * ```typescript
 * // ✅ CORRECT: Call during setup, await later
 * import { useSQLiteClientAsync } from '@alexop/sqlite-vue';
 *
 * export default {
 *   setup() {
 *     // Call inject() during setup (synchronous)
 *     const dbPromise = useSQLiteClientAsync();
 *
 *     async function addTodo(title: string) {
 *       // Await the promise when needed
 *       const db = await dbPromise;
 *       await db.insert('todos').values({ title });
 *       db.notifyTable('todos');
 *     }
 *
 *     return { addTodo };
 *   }
 * };
 * ```
 *
 * @example
 * ```typescript
 * // ❌ INCORRECT: Calling inside async function
 * export default {
 *   setup() {
 *     async function addTodo(title: string) {
 *       // This will fail! inject() doesn't work in async context
 *       const dbPromise = useSQLiteClientAsync();
 *       const db = await dbPromise;
 *     }
 *   }
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Using with Composition API (script setup)
 * <script setup lang="ts">
 * import { useSQLiteClientAsync } from '@alexop/sqlite-vue';
 *
 * // Call at top level of setup
 * const dbPromise = useSQLiteClientAsync();
 *
 * async function loadUsers() {
 *   const db = await dbPromise;
 *   const users = await db.query('users').all();
 *   return users;
 * }
 * </script>
 * ```
 */
export function useSQLiteClientAsync(): Promise<SQLiteClient<SchemaRegistry>> {
  const promise = inject<Promise<SQLiteClient<SchemaRegistry>> | null>(SQLITE_CLIENT_KEY, null);
  if (!promise) {
    throw new Error("SQLite plugin not installed");
  }
  return promise;
}
