---
title: Quick Start
description: Build your first type-safe SQLite database in minutes
---

This guide will walk you through creating a simple todo list application with SQLite Web.

## 1. Define Your Schema

Create a Zod schema to define your database structure:

```typescript
import { z } from "zod";

const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean().default(false),
  createdAt: z.string().default(() => new Date().toISOString()),
});

// Export the schema registry
export const dbSchema = {
  todos: todoSchema,
} as const;
```

The `as const` assertion is important - it enables TypeScript to infer exact table names and field types.

## 2. Create the SQLite Client

Initialize the client with your schema and migrations:

```typescript
import { createSQLiteClient } from "@alexop/sqlite-core";
import { dbSchema } from "./schema";

const db = await createSQLiteClient({
  schema: dbSchema,
  filename: "file:todos.sqlite3?vfs=opfs",
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
});
```

:::tip
The `filename` parameter uses the OPFS VFS (`?vfs=opfs`) for persistent storage. Data will survive browser refreshes!
:::

## 3. Query with Type Safety

Now you can query your database with full TypeScript autocomplete:

```typescript
// Get all incomplete todos
const incompleteTodos = await db
  .query("todos")
  .where("completed", "=", false)
  .orderBy("createdAt", "DESC")
  .all();
// Type: Array<{ id: string, title: string, completed: boolean, createdAt: string }>

// Get only titles
const titles = await db.query("todos").select("title").all();
// Type: Array<{ title: string }>

// Get a single todo
const todo = await db.query("todos").where("id", "=", "123").first();
// Type: { id: string, title: string, completed: boolean, createdAt: string } | null

// Count todos
const count = await db.query("todos").count();
// Type: number
```

## 4. Insert Data

Add new todos with automatic validation:

```typescript
await db.insert("todos").values({
  id: crypto.randomUUID(),
  title: "Learn SQLite Web",
  completed: false,
});

// TypeScript error: missing required field 'title'
await db.insert("todos").values({
  id: crypto.randomUUID(),
  completed: false,
});
```

## 5. Update and Delete

Modify existing data:

```typescript
// Update
await db
  .update("todos")
  .where("id", "=", "123")
  .set({ completed: true })
  .execute();

// Delete
await db.delete("todos").where("completed", "=", true).execute();
```

## Complete Example

Here's a complete working example:

```typescript
import { createSQLiteClient } from "@alexop/sqlite-core";
import { z } from "zod";

// 1. Define schema
const dbSchema = {
  todos: z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean().default(false),
    createdAt: z.string().default(() => new Date().toISOString()),
  }),
} as const;

// 2. Create client
const db = await createSQLiteClient({
  schema: dbSchema,
  filename: "file:todos.sqlite3?vfs=opfs",
  migrations: [
    {
      version: 1,
      sql: `CREATE TABLE todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    },
  ],
});

// 3. Insert data
await db.insert("todos").values({
  id: crypto.randomUUID(),
  title: "Build something awesome",
});

// 4. Query data
const todos = await db.query("todos").where("completed", "=", false).all();

console.log(todos);
```

## Using with Vue

If you're using Vue 3, check out the [Vue Plugin Setup](/vue/plugin/) guide for reactive query support:

```vue
<script setup lang="ts">
import { useSQLiteQuery } from "@alexop/sqlite-vue";

const { rows: todos, loading } = useSQLiteQuery(
  (db) => db.query("todos").orderBy("createdAt", "DESC").all(),
  { tables: ["todos"] }
);
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else>
    <div v-for="todo in todos" :key="todo.id">
      {{ todo.title }}
    </div>
  </div>
</template>
```

## Next Steps

- [Schema Definition](/core/schema/) - Learn advanced schema patterns
- [Query Builder](/core/query-builder/) - Master the query builder API
- [Mutations](/core/mutations/) - Deep dive into insert, update, and delete
- [Vue Integration](/vue/overview/) - Build reactive Vue applications
