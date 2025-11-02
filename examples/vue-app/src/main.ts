import { createApp } from "vue";
import App from "./App.vue";
import { createSQLite } from "@alexop/sqlite-vue";
import { z } from "zod";

// Define Zod schema for the database
const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean().default(false),
  createdAt: z.string().default(() => new Date().toISOString()),
});

const dbSchema = {
  todos: todoSchema,
} as const;

const sqlite = createSQLite({
  schema: dbSchema,
  filename: "file:app.sqlite3?vfs=opfs",
  migrations: [
    {
      version: 1,
      sql: `
        CREATE TABLE IF NOT EXISTS todos (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          completed INTEGER DEFAULT 0,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
    },
  ],
});

createApp(App).use(sqlite).mount("#app");
