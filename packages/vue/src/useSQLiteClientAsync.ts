import { inject } from "vue";
import { SQLITE_CLIENT_KEY } from "./injection";
import type { SQLiteClient } from "@alexop/sqlite-core";

export function useSQLiteClientAsync(): Promise<SQLiteClient<any>> {
  const promise = inject<Promise<SQLiteClient<any>> | null>(SQLITE_CLIENT_KEY, null);
  if (!promise) {
    throw new Error("SQLite plugin not installed");
  }
  return promise;
}
