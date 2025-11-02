/**
 * Type-safe composables factory
 *
 * This file provides a way to create fully typed composables for your app.
 * Import and use these in your components for full type safety.
 */

import { inject } from "vue";
import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";
import type { SchemaRegistry, SQLiteClient } from "@alexop/sqlite-core";
import { SQLITE_CLIENT_KEY } from "./injection";

export interface UseSQLiteQueryReturn<T> {
  rows: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<Error | null>;
  refresh: () => Promise<void>;
}

/**
 * Create typed composables for your specific schema
 *
 * @example
 * ```ts
 * // In a separate file (e.g., src/composables/db.ts)
 * import { createTypedComposables } from "@alexop/sqlite-vue/typed-composables";
 * import type { dbSchema } from "./main";
 *
 * export const { useSQLiteClientAsync, useSQLiteQuery } =
 *   createTypedComposables<typeof dbSchema>();
 * ```
 *
 * Then import from your file instead of the package:
 * ```ts
 * import { useSQLiteClientAsync, useSQLiteQuery } from "@/composables/db";
 * ```
 */
export function createTypedComposables<TSchema extends SchemaRegistry>() {
  function useSQLiteClientAsync(): Promise<SQLiteClient<TSchema>> {
    const promise = inject<Promise<SQLiteClient<TSchema>> | null>(
      SQLITE_CLIENT_KEY as any,
      null
    );
    if (!promise) {
      throw new Error("SQLite plugin not installed");
    }
    return promise;
  }

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
        options.tables.forEach((table) => {
          const unsub = db!.subscribe(table, run);
          unsubs.push(unsub);
        });
      }
    });

    onBeforeUnmount(() => {
      unsubs.forEach((u) => u());
    });

    return {
      rows: rows as Ref<T | null>,
      loading,
      error,
      refresh: run,
    };
  }

  return {
    useSQLiteClientAsync,
    useSQLiteQuery,
  };
}
