/**
 * Type-safe composables factory
 *
 * This file provides a way to create fully typed composables for your app.
 * Instead of using the generic composables from the main package, you can create
 * schema-specific composables that provide full type inference for your tables,
 * columns, and query results.
 *
 * This is the recommended approach for applications that want maximum type safety.
 */

import { type InjectionKey, inject } from "vue";
import { type Ref, onBeforeUnmount, onMounted, ref } from "vue";
import type { SQLiteClient, SchemaRegistry } from "@alexop/sqlite-orm";
import { SQLITE_CLIENT_KEY } from "./injection";

/**
 * Return type for the typed useSQLiteQuery composable
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
 * Create fully type-safe composables for your specific schema
 *
 * This factory function generates `useSQLiteClientAsync` and `useSQLiteQuery` composables
 * that are typed to your specific database schema. This provides full IntelliSense support
 * for table names, column names, and result types throughout your application.
 *
 * **Setup Pattern**:
 * 1. Define your schema in your main.ts/app setup
 * 2. Create a separate composables file that exports typed composables
 * 3. Import from your composables file instead of the package
 *
 * @template TSchema - Your database schema registry
 * @returns Object containing typed composables
 *
 * @example
 * ```typescript
 * // src/db/schema.ts - Define your schema
 * import { z } from 'zod';
 *
 * export const dbSchema = {
 *   users: z.object({
 *     id: z.number(),
 *     name: z.string(),
 *     email: z.string().email(),
 *     createdAt: z.string()
 *   }),
 *   posts: z.object({
 *     id: z.number(),
 *     userId: z.number(),
 *     title: z.string(),
 *     content: z.string()
 *   })
 * } as const;
 * ```
 *
 * @example
 * ```typescript
 * // src/composables/db.ts - Create typed composables
 * import { createTypedComposables } from '@alexop/sqlite-vue/typed-composables';
 * import type { dbSchema } from '@/db/schema';
 *
 * // Export typed composables
 * export const { useSQLiteClientAsync, useSQLiteQuery } =
 *   createTypedComposables<typeof dbSchema>();
 * ```
 *
 * @example
 * ```vue
 * <!-- Component.vue - Use typed composables -->
 * <script setup lang="ts">
 * import { useSQLiteClientAsync, useSQLiteQuery } from '@/composables/db';
 *
 * // Full type inference for client
 * const dbPromise = useSQLiteClientAsync();
 *
 * // Full type inference for queries - table names autocomplete!
 * const { rows: users, loading, error } = useSQLiteQuery(
 *   async (db) => db.query('users') // 'users' autocompletes!
 *     .where('name', 'LIKE', '%John%') // Columns autocomplete!
 *     .all(),
 *   { tables: ['users'] }
 * );
 *
 * // Insert with full type checking
 * async function addUser(name: string, email: string) {
 *   const db = await dbPromise;
 *   await db.insert('users').values({
 *     name,
 *     email,
 *     createdAt: new Date().toISOString()
 *   }); // All fields are type-checked!
 *   db.notifyTable('users');
 * }
 * </script>
 *
 * <template>
 *   <div v-if="loading">Loading users...</div>
 *   <div v-else-if="error">Error: {{ error.message }}</div>
 *   <ul v-else-if="users">
 *     <li v-for="user in users" :key="user.id">
 *       {{ user.name }} - {{ user.email }}
 *     </li>
 *   </ul>
 * </template>
 * ```
 */
export function createTypedComposables<TSchema extends SchemaRegistry>() {
  /**
   * Get the typed SQLite client promise
   *
   * This is the typed version of `useSQLiteClientAsync` that provides
   * full type inference for your schema.
   *
   * @returns Promise that resolves to the typed SQLite client
   * @throws {Error} If the SQLite plugin was not installed
   */
  function useSQLiteClientAsync(): Promise<SQLiteClient<TSchema>> {
    const promise = inject<Promise<SQLiteClient<TSchema>> | null>(
      SQLITE_CLIENT_KEY as InjectionKey<Promise<SQLiteClient<TSchema>>>,
      null
    );
    if (!promise) {
      throw new Error("SQLite plugin not installed");
    }
    return promise;
  }

  /**
   * Reactive query composable with automatic refresh (typed version)
   *
   * This is the typed version of `useSQLiteQuery` that provides full type inference
   * for your schema, including table names, column names, and result types.
   *
   * @template T - Type of the query result data
   * @param queryFn - Async function that receives the typed SQLite client
   * @param options - Configuration options
   * @param options.tables - Array of table names to watch for changes
   * @returns Reactive query state object
   */
  function useSQLiteQuery<T>(
    queryFn: (db: SQLiteClient<TSchema>) => Promise<T>,
    options: { tables?: string[] } = {}
  ): UseSQLiteQueryReturn<T> {
    const rows = ref<T | null>(null);
    const loading = ref(true);
    const error = ref<Error | null>(null);
    let db: SQLiteClient<TSchema> | null = null;
    const unsubs: Array<() => void> = [];

    async function run() {
      if (!db) {
        return;
      }
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
          if (!db) {
            return;
          }
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
      error,
      loading,
      refresh: run,
      rows: rows as Ref<T | null>,
    };
  }

  return {
    useSQLiteClientAsync,
    useSQLiteQuery,
  };
}
