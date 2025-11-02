import type { InjectionKey } from "vue";
import type { SQLiteClient } from "@alexop/sqlite-core";

export const SQLITE_CLIENT_KEY: InjectionKey<Promise<SQLiteClient>> =
  Symbol("SQLITE_CLIENT");
