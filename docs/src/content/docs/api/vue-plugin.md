---
title: Vue Plugin API
description: Complete API reference for the Vue integration
---

The Vue package provides a plugin and composables for reactive SQLite queries in Vue 3 applications.

## createSQLite

Creates a Vue plugin for SQLite integration.

```typescript
function createSQLite<TSchema extends SchemaRegistry>(
  config: SQLiteConfig<TSchema>
): Plugin;
```

### Parameters

```typescript
interface SQLiteConfig<TSchema extends SchemaRegistry> {
  /** Zod schema registry */
  schema: TSchema;

  /** Database filename with VFS */
  filename: string;

  /** Array of migrations */
  migrations: Migration[];
}
```

### Returns

Vue `Plugin` instance to install with `app.use()`.

### Example

```typescript
import { createApp } from "vue";
import { createSQLite } from "@alexop/sqlite-vue";
import { z } from "zod";
import App from "./App.vue";

const app = createApp(App);

app.use(
  createSQLite({
    schema: {
      todos: z.object({
        id: z.string(),
        title: z.string(),
      }),
    } as const,
    filename: "file:app.sqlite3?vfs=opfs",
    migrations: [
      {
        version: 1,
        sql: "CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL)",
      },
    ],
  })
);

app.mount("#app");
```

## useSQLiteClientAsync

Returns a promise that resolves to the SQLite client.

```typescript
function useSQLiteClientAsync<TSchema extends SchemaRegistry>(): Promise<
  SQLiteClient<TSchema>
>;
```

### Returns

`Promise<SQLiteClient<TSchema>>` - Promise resolving to the client.

### Usage Rules

:::caution[Important]
Must be called during component setup, NOT inside async functions. This is a Vue limitation because `useSQLiteClientAsync()` uses `inject()` internally.
:::

### Example

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useSQLiteClientAsync } from '@alexop/sqlite-vue';

// ✅ CORRECT - called during setup
const dbPromise = useSQLiteClientAsync();
const newTitle = ref('');

async function addTodo() {
  // ✅ CORRECT - await the stored promise
  const db = await dbPromise;
  await db.insert('todos').values({
    id: crypto.randomUUID(),
    title: newTitle.value,
  });
  db.notifyTable('todos');
  newTitle.value = '';
}

// ❌ WRONG - inject() called in async context
async function wrongAddTodo() {
  const db = await useSQLiteClientAsync(); // Error!
  await db.insert('todos').values({ ... });
}
</script>

<template>
  <input v-model="newTitle" @keyup.enter="addTodo" />
  <button @click="addTodo">Add Todo</button>
</template>
```

## useSQLiteQuery

Returns reactive query results that auto-update when data changes.

```typescript
function useSQLiteQuery<T>(
  queryFn: (db: SQLiteClient) => Promise<T>,
  options?: UseSQLiteQueryOptions
): UseSQLiteQueryReturn<T>;
```

### Parameters

#### queryFn

A function that receives the database client and returns a query promise.

```typescript
type QueryFn<T> = (db: SQLiteClient) => Promise<T>;
```

#### options

```typescript
interface UseSQLiteQueryOptions {
  /** Tables to subscribe to for reactive updates */
  tables?: string[];

  /** Execute query immediately on mount (default: true) */
  immediate?: boolean;
}
```

### Returns

```typescript
interface UseSQLiteQueryReturn<T> {
  /** Reactive ref containing query results (null while loading) */
  rows: Ref<T | null>;

  /** Reactive ref indicating loading state */
  loading: Ref<boolean>;

  /** Reactive ref containing any error */
  error: Ref<Error | null>;

  /** Function to manually re-run the query */
  refresh: () => Promise<void>;
}
```

### Example

```vue
<script setup lang="ts">
import { useSQLiteQuery } from "@alexop/sqlite-vue";

const {
  rows: todos,
  loading,
  error,
  refresh,
} = useSQLiteQuery(
  (db) =>
    db
      .query("todos")
      .where("completed", "=", false)
      .orderBy("createdAt", "DESC")
      .all(),
  { tables: ["todos"] }
);

async function forceRefresh() {
  await refresh();
}
</script>

<template>
  <div>
    <button @click="forceRefresh" :disabled="loading">Refresh</button>

    <div v-if="loading">Loading...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>
    <ul v-else>
      <li v-for="todo in todos" :key="todo.id">
        {{ todo.title }}
      </li>
    </ul>
  </div>
</template>
```

## Reactive Query Options

### tables

Array of table names to subscribe to. When `db.notifyTable(tableName)` is called on any of these tables, the query automatically re-runs.

```vue
<script setup lang="ts">
// Subscribe to single table
const { rows } = useSQLiteQuery((db) => db.query("todos").all(), {
  tables: ["todos"],
});

// Subscribe to multiple tables
const { rows } = useSQLiteQuery(
  async (db) => {
    const todos = await db.query("todos").all();
    const users = await db.query("users").all();
    return { todos, users };
  },
  { tables: ["todos", "users"] }
);

// No subscription (query won't auto-update)
const { rows } = useSQLiteQuery(
  (db) => db.query("todos").all()
  // No tables option
);
</script>
```

### immediate

Controls whether the query executes on mount.

```vue
<script setup lang="ts">
// Executes immediately (default)
const { rows: todos } = useSQLiteQuery((db) => db.query("todos").all(), {
  tables: ["todos"],
  immediate: true,
});

// Waits for manual refresh
const { rows: lazyTodos, refresh } = useSQLiteQuery(
  (db) => db.query("todos").all(),
  { tables: ["todos"], immediate: false }
);

async function loadTodos() {
  await refresh();
}
</script>

<template>
  <button @click="loadTodos">Load Todos</button>
  <ul v-if="lazyTodos">
    <li v-for="todo in lazyTodos" :key="todo.id">
      {{ todo.title }}
    </li>
  </ul>
</template>
```

## Reactive Query Return Values

### rows

Reactive ref containing the query results.

```typescript
const { rows } = useSQLiteQuery((db) => db.query("todos").all(), {
  tables: ["todos"],
});

// Type: Ref<Array<Todo> | null>
// null while loading, Array<Todo> after success
```

Access in template:

```vue
<template>
  <ul v-if="rows">
    <li v-for="todo in rows" :key="todo.id">
      {{ todo.title }}
    </li>
  </ul>
</template>
```

### loading

Reactive ref indicating whether the query is executing.

```typescript
const { loading } = useSQLiteQuery(/* ... */);

// Type: Ref<boolean>
// true while query is running, false otherwise
```

### error

Reactive ref containing any error that occurred.

```typescript
const { error } = useSQLiteQuery(/* ... */);

// Type: Ref<Error | null>
// null on success, Error instance on failure
```

### refresh

Function to manually re-run the query.

```typescript
const { refresh } = useSQLiteQuery(/* ... */);

// Type: () => Promise<void>

// Call it to re-run the query
await refresh();
```

## Type Inference

The Vue composables preserve full type safety:

```typescript
const dbSchema = {
  todos: z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
  }),
} as const;

// All columns
const { rows } = useSQLiteQuery((db) => db.query("todos").all(), {
  tables: ["todos"],
});
// rows type: Ref<Array<{ id: string, title: string, completed: boolean }> | null>

// Selected columns
const { rows } = useSQLiteQuery(
  (db) => db.query("todos").select("id", "title").all(),
  { tables: ["todos"] }
);
// rows type: Ref<Array<{ id: string, title: string }> | null>

// Custom return type
interface Stats {
  total: number;
  completed: number;
}

const { rows } = useSQLiteQuery<Stats>(
  async (db) => {
    const total = await db.query("todos").count();
    const completed = await db
      .query("todos")
      .where("completed", "=", true)
      .count();
    return { total, completed };
  },
  { tables: ["todos"] }
);
// rows type: Ref<Stats | null>
```

## Complete Example

Full todo app with all features:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useSQLiteQuery, useSQLiteClientAsync } from "@alexop/sqlite-vue";

// Query
const {
  rows: todos,
  loading,
  error,
} = useSQLiteQuery(
  (db) => db.query("todos").orderBy("createdAt", "DESC").all(),
  { tables: ["todos"] }
);

// Mutations
const dbPromise = useSQLiteClientAsync();
const newTitle = ref("");

async function addTodo() {
  if (!newTitle.value.trim()) return;

  const db = await dbPromise;
  await db.insert("todos").values({
    id: crypto.randomUUID(),
    title: newTitle.value,
  });

  db.notifyTable("todos");
  newTitle.value = "";
}

async function toggleTodo(id: string, completed: boolean) {
  const db = await dbPromise;
  await db
    .update("todos")
    .where("id", "=", id)
    .set({ completed: !completed })
    .execute();

  db.notifyTable("todos");
}

async function deleteTodo(id: string) {
  const db = await dbPromise;
  await db.delete("todos").where("id", "=", id).execute();

  db.notifyTable("todos");
}
</script>

<template>
  <div>
    <h1>Todos</h1>

    <form @submit.prevent="addTodo">
      <input v-model="newTitle" placeholder="What needs to be done?" />
      <button type="submit">Add</button>
    </form>

    <div v-if="loading">Loading...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>
    <ul v-else-if="todos?.length">
      <li v-for="todo in todos" :key="todo.id">
        <input
          type="checkbox"
          :checked="todo.completed"
          @change="toggleTodo(todo.id, todo.completed)"
        />
        <span :class="{ completed: todo.completed }">
          {{ todo.title }}
        </span>
        <button @click="deleteTodo(todo.id)">Delete</button>
      </li>
    </ul>
    <div v-else>No todos yet. Add one above!</div>
  </div>
</template>

<style scoped>
.completed {
  text-decoration: line-through;
  opacity: 0.6;
}
</style>
```

## Next Steps

- [Plugin Setup](/vue/plugin/) - Configure the plugin
- [Composables Guide](/vue/composables/) - Learn composable patterns
- [Reactive Queries](/vue/reactive-queries/) - Master reactive patterns
- [SQLiteClient API](/api/client/) - Core client API reference
