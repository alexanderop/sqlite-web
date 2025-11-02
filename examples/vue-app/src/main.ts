import { createApp } from "vue";
import App from "./App.vue";
import { createSQLite } from "@alexop/sqlite-vue";

const sqlite = createSQLite({
  filename: "file:app.sqlite3?vfs=opfs",
  migrations: [
    {
      version: 1,
      sql: `
        CREATE TABLE IF NOT EXISTS todos (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL
        );
      `
    }
  ]
});

createApp(App).use(sqlite).mount("#app");
