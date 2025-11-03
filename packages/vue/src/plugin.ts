import type { App, Plugin } from "vue";
import { SQLITE_CLIENT_KEY } from "./injection";
import {
  type Migration,
  type SchemaRegistry,
  createSQLiteClient,
} from "@alexop/sqlite-core";

export type SQLiteOptions<TSchema extends SchemaRegistry> = {
  schema: TSchema;
  filename: string;
  migrations?: Migration[];
};

export function createSQLite<TSchema extends SchemaRegistry>(
  options: SQLiteOptions<TSchema>
): Plugin {
  const clientPromise = createSQLiteClient(options);

  return {
    install(app: App) {
      app.provide(SQLITE_CLIENT_KEY, clientPromise);
      clientPromise.then((client) => {
        app.config.globalProperties.$sqlite = client;
      });
    },
  };
}
