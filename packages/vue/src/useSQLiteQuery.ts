import { ref, onMounted, onBeforeUnmount } from "vue";
import { useSQLiteClientAsync } from "./useSQLiteClientAsync";
import type { SQLiteClient } from "@alexop/sqlite-core";

export function useSQLiteQuery<T = any>(
  sql: string,
  params: unknown[] = [],
  watchTables: string[] = []
) {
  const rows = ref<T[]>([]);
  const loading = ref(true);
  const error = ref<Error | null>(null);
  let db: SQLiteClient | null = null;
  const unsubs: Array<() => void> = [];

  async function run() {
    if (!db) return;
    loading.value = true;
    try {
      rows.value = await db.query<T>(sql, params);
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
    watchTables.forEach((table) => {
      const unsub = db!.subscribe(table, run);
      unsubs.push(unsub);
    });
  });

  onBeforeUnmount(() => {
    unsubs.forEach((u) => u());
  });

  return {
    rows,
    loading,
    error,
    refresh: run
  };
}
