---
title: Vue Plugin Setup
description: Configure the SQLite Vue plugin in your application
---

The SQLite Vue plugin installs the database client globally and makes it available to all components via dependency injection.

## Installation

First, install the package:

```bash
pnpm add @alexop/sqlite-vue zod
```

## Basic Setup

Configure the plugin in your `main.ts`:

```typescript
import { createApp } from "vue";
import { createSQLite } from "@alexop/sqlite-vue";
import { z } from "zod";
import App from "./App.vue";

// 1. Define your schema
const dbSchema = {
  todos: z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean().default(false),
    createdAt: z.string().default(() => new Date().toISOString()),
  }),
} as const;

// 2. Create the app
const app = createApp(App);

// 3. Install the plugin
app.use(
  createSQLite({
    schema: dbSchema,
    filename: "file:app.sqlite3?vfs=opfs",
    migrations: [
      {
        version: 1,
        sql: `
        CREATE TABLE todos (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          completed INTEGER DEFAULT 0,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `,
      },
    ],
  })
);

// 4. Mount the app
app.mount("#app");
```

## Configuration Options

The `createSQLite()` function accepts the same options as `createSQLiteClient()`:

```typescript
interface SQLiteConfig<TSchema extends SchemaRegistry> {
  /** Zod schema registry */
  schema: TSchema;

  /** Database filename with VFS */
  filename: string;

  /** Migration definitions */
  migrations: Array<{
    version: number;
    sql: string;
  }>;
}
```

### Schema

Define your database tables as Zod schemas:

```typescript
const dbSchema = {
  users: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
  }),
  posts: z.object({
    id: z.string(),
    userId: z.string(),
    title: z.string(),
    content: z.string(),
  }),
} as const;
```

Always use `as const` for proper type inference!

### Filename

Specify the database file and VFS:

```typescript
// OPFS (recommended) - persistent storage
filename: "file:app.sqlite3?vfs=opfs";

// Memory - data lost on refresh
filename: ":memory:";

// Different databases for different contexts
filename: "file:users.sqlite3?vfs=opfs";
```

### Migrations

Define schema migrations:

```typescript
migrations: [
  {
    version: 1,
    sql: `CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )`,
  },
  {
    version: 2,
    sql: `ALTER TABLE users ADD COLUMN email TEXT`,
  },
];
```

See [Migrations](/core/migrations/) for more details.

## Organizing Schema

For large applications, organize your schema in separate files:

```typescript
// db/schema/users.ts
import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

// db/schema/todos.ts
export const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean().default(false),
});

// db/schema/index.ts
import { userSchema } from "./users";
import { todoSchema } from "./todos";

export const dbSchema = {
  users: userSchema,
  todos: todoSchema,
} as const;

// main.ts
import { dbSchema } from "./db/schema";

app.use(
  createSQLite({
    schema: dbSchema,
    // ...
  })
);
```

## Organizing Migrations

Similarly, organize migrations in separate files:

```typescript
// db/migrations/001-initial.ts
export const migration001 = {
  version: 1,
  sql: `
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `,
};

// db/migrations/002-add-todos.ts
export const migration002 = {
  version: 2,
  sql: `
    CREATE TABLE todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0
    )
  `,
};

// db/migrations/index.ts
import { migration001 } from "./001-initial";
import { migration002 } from "./002-add-todos";

export const migrations = [migration001, migration002];

// main.ts
import { migrations } from "./db/migrations";

app.use(
  createSQLite({
    schema: dbSchema,
    filename: "file:app.sqlite3?vfs=opfs",
    migrations,
  })
);
```

## Type Exports

Export types from your schema for use throughout your app:

```typescript
// db/types.ts
import { z } from "zod";
import { dbSchema } from "./schema";

export type User = z.infer<typeof dbSchema.users>;
export type Todo = z.infer<typeof dbSchema.todos>;

// components/TodoItem.vue
import type { Todo } from "@/db/types";

interface Props {
  todo: Todo;
}
```

## Multiple Databases

You can have multiple database instances if needed:

```typescript
// Not common, but possible
const mainDb = createSQLite({
  schema: mainSchema,
  filename: "file:main.sqlite3?vfs=opfs",
  migrations: mainMigrations,
});

const cacheDb = createSQLite({
  schema: cacheSchema,
  filename: "file:cache.sqlite3?vfs=opfs",
  migrations: cacheMigrations,
});

app.use(mainDb);
app.use(cacheDb); // Warning: inject key collision!
```

:::caution
Using multiple SQLite plugins requires custom injection keys to avoid collisions. This is an advanced use case - most apps only need one database.
:::

## Development vs Production

Use environment variables to configure different databases:

```typescript
const filename = import.meta.env.DEV
  ? "file:dev.sqlite3?vfs=opfs"
  : "file:prod.sqlite3?vfs=opfs";

app.use(
  createSQLite({
    schema: dbSchema,
    filename,
    migrations,
  })
);
```

Or use in-memory for testing:

```typescript
const filename =
  import.meta.env.MODE === "test" ? ":memory:" : "file:app.sqlite3?vfs=opfs";
```

## Vite Configuration

Remember to configure Vite for SQLite WASM:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
});
```

See [Browser Setup](/guides/browser-setup/) for details.

## Initialization

The database initializes lazily on the first query:

```typescript
// Plugin installed
app.use(createSQLite({ ... }));

// Database NOT initialized yet
app.mount('#app');

// First component query triggers initialization
const { rows } = useSQLiteQuery(
  (db) => db.query("todos").all(),
  { tables: ["todos"] }
);
// Database initialized, migrations run
```

This ensures:

- Fast app startup
- Migrations only run when needed
- Worker creation is deferred

## Error Handling

Handle plugin initialization errors:

```vue
<script setup lang="ts">
import { useSQLiteQuery } from "@alexop/sqlite-vue";

const { rows, loading, error } = useSQLiteQuery(
  (db) => db.query("todos").all(),
  { tables: ["todos"] }
);
</script>

<template>
  <div v-if="error">
    <h2>Database Error</h2>
    <p>{{ error.message }}</p>
  </div>
  <div v-else-if="loading">Loading...</div>
  <div v-else>
    <!-- Your content -->
  </div>
</template>
```

## Next Steps

- [Composables](/vue/composables/) - Learn the composable APIs
- [Reactive Queries](/vue/reactive-queries/) - Build reactive UIs
- [Schema Definition](/core/schema/) - Define your database schema
- [Migrations](/core/migrations/) - Manage schema changes
