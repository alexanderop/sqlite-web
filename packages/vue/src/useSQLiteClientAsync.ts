import { inject } from "vue";
import { SQLITE_CLIENT_KEY } from "./injection";
import type { SQLiteClient } from "@alexop/sqlite-core";

export async function useSQLiteClientAsync(): Promise<SQLiteClient> {
  const promise = inject<Promise<SQLiteClient> | null>(SQLITE_CLIENT_KEY, null);
  if (!promise) {
    throw new Error("SQLite plugin not installed");
  }
  return promise;
}
