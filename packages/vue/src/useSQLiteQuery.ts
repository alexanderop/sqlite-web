import { type Ref, onBeforeUnmount, onMounted, ref } from "vue";
import { useSQLiteClientAsync } from "./useSQLiteClientAsync";
import type { SQLiteClient, SchemaRegistry } from "@alexop/sqlite-core";

/**
 * Return type for the useSQLiteQuery composable
 *
 * Provides reactive state for database queries including loading state,
 * error handling, and the ability to manually refresh.
 *
 * @template T - Type of the query result data
 */
export interface UseSQLiteQueryReturn<T> {
  /** Reactive reference to query result data (null until first load) */
  rows: Ref<T | null>;
  /** Reactive reference to loading state (true during query execution) */
  loading: Ref<boolean>;
  /** Reactive reference to any error that occurred during query execution */
  error: Ref<Error | null>;
  /** Function to manually trigger a query refresh */
  refresh: () => Promise<void>;
}

/**
 * Reactive query composable with automatic refresh on table changes
 *
 * This composable executes a database query and provides reactive state for the results.
 * It automatically re-runs the query when specified tables are updated via `db.notifyTable()`.
 *
 * **Lifecycle**:
 * - Query is executed on component mount (onMounted)
 * - Subscriptions to table changes are automatically cleaned up on unmount (onBeforeUnmount)
 * - Query can be manually refreshed using the returned `refresh()` function
 *
 * **Reactivity**:
 * - `rows`: Updates when query completes successfully
 * - `loading`: True during query execution, false otherwise
 * - `error`: Set if query throws an error, null on success
 *
 * @template T - Type of the query result data
 * @param queryFn - Async function that receives the SQLite client and returns query results
 * @param options - Configuration options
 * @param options.tables - Array of table names to watch for changes (triggers auto-refresh)
 * @returns Reactive query state object with rows, loading, error, and refresh function
 *
 * @example
 * ```typescript
 * // Basic query without auto-refresh
 * import { useSQLiteQuery } from '@alexop/sqlite-vue';
 *
 * const { rows, loading, error } = useSQLiteQuery(
 *   async (db) => db.query('users').all()
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Query with auto-refresh on table changes
 * const { rows, loading, error, refresh } = useSQLiteQuery(
 *   async (db) => db.query('todos')
 *     .where('completed', '=', false)
 *     .orderBy('createdAt', 'DESC')
 *     .all(),
 *   { tables: ['todos'] } // Auto-refresh when todos table changes
 * );
 *
 * // In another part of your component
 * async function addTodo(title: string) {
 *   const db = await dbPromise;
 *   await db.insert('todos').values({ title, completed: false });
 *   db.notifyTable('todos'); // Triggers automatic refresh of the query above
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Using in a component template
 * <script setup lang="ts">
 * import { useSQLiteQuery } from '@alexop/sqlite-vue';
 *
 * const { rows: users, loading, error } = useSQLiteQuery(
 *   async (db) => db.query('users')
 *     .where('status', '=', 'active')
 *     .all(),
 *   { tables: ['users'] }
 * );
 * </script>
 *
 * <template>
 *   <div v-if="loading">Loading...</div>
 *   <div v-else-if="error">Error: {{ error.message }}</div>
 *   <ul v-else-if="users">
 *     <li v-for="user in users" :key="user.id">
 *       {{ user.name }}
 *     </li>
 *   </ul>
 * </template>
 * ```
 *
 * @example
 * ```typescript
 * // Manual refresh
 * const { rows, refresh } = useSQLiteQuery(
 *   async (db) => db.query('posts').all()
 * );
 *
 * async function handleRefresh() {
 *   await refresh(); // Manually re-run the query
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Watch multiple tables
 * const { rows } = useSQLiteQuery(
 *   async (db) => {
 *     const users = await db.query('users').all();
 *     const posts = await db.query('posts').all();
 *     return { users, posts };
 *   },
 *   { tables: ['users', 'posts'] } // Refresh when either table changes
 * );
 * ```
 */
export function useSQLiteQuery<T>(
  queryFn: (db: SQLiteClient<SchemaRegistry>) => Promise<T>,
  options: { tables?: string[] } = {}
): UseSQLiteQueryReturn<T> {
  const rows = ref<T | null>(null);
  const loading = ref(true);
  const error = ref<Error | null>(null);
  let db: SQLiteClient<SchemaRegistry> | null = null;
  const unsubs: Array<() => void> = [];

  async function run() {
    if (!db) return;
    loading.value = true;
    try {
      rows.value = await queryFn(db);
      error.value = null;
    } catch (e) {
      error.value = e as Error;
    } finally {
      loading.value = false;
    }
  }

  onMounted(async () => {
    db = await useSQLiteClientAsync();
    await run();

    if (options.tables) {
      for (const table of options.tables) {
        if (!db) return;
        const unsub = db.subscribe(table, run);
        unsubs.push(unsub);
      }
    }
  });

  onBeforeUnmount(() => {
    for (const u of unsubs) {
      u();
    }
  });

  return {
    error, loading, refresh: run, rows: rows as Ref<T | null>,
  };
}
