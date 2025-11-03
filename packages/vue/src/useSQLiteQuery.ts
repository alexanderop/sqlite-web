import { type Ref, onBeforeUnmount, onMounted, ref } from "vue";
import { useSQLiteClientAsync } from "./useSQLiteClientAsync";
import type { SQLiteClient, SchemaRegistry } from "@alexop/sqlite-core";

export interface UseSQLiteQueryReturn<T> {
  rows: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<Error | null>;
  refresh: () => Promise<void>;
}

/**
 * Reactive query composable that uses the query builder
 * @param queryFn - Function that receives the DB client and returns a query builder result
 * @param options - Options including tables to watch for changes
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
      options.tables.forEach((table) => {
        if (!db) return;
        const unsub = db.subscribe(table, run);
        unsubs.push(unsub);
      });
    }
  });

  onBeforeUnmount(() => {
    unsubs.forEach((u) => u());
  });

  return {
    error, loading, refresh: run, rows: rows as Ref<T | null>,
  };
}
