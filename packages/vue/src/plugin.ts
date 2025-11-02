import type { App, Plugin } from "vue";
import { SQLITE_CLIENT_KEY } from "./injection";
import { createSQLiteClient, type Migration } from "@alexop/sqlite-core";

export type SQLiteOptions = {
  filename: string;
  migrations?: Migration[];
};

export function createSQLite(options: SQLiteOptions): Plugin {
  const clientPromise = createSQLiteClient(options);

  return {
    install(app: App) {
      app.provide(SQLITE_CLIENT_KEY, clientPromise);
      clientPromise.then((client) => {
        app.config.globalProperties.$sqlite = client;
      });
    }
  };
}
