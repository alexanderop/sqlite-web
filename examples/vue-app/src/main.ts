import { createApp } from "vue";
import App from "./App.vue";
import { createSQLite } from "@alexop/sqlite-vue";
import { z } from "zod";

// Define Zod schema for the database
const todoSchema = z.object({
  completed: z.boolean().default(false), createdAt: z.string().default(() => new Date().toISOString()), id: z.string(), title: z.string(),
});

const dbSchema = {
  todos: todoSchema,
} as const;

const sqlite = createSQLite({
  filename: "file:app.sqlite3?vfs=opfs", migrations: [
    {
      sql: `
        CREATE TABLE IF NOT EXISTS todos (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          completed INTEGER DEFAULT 0,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `, version: 1,
    },
  ], schema: dbSchema,
});

createApp(App).use(sqlite).mount("#app");
