---
title: Composables
description: Learn the useSQLiteClientAsync and useSQLiteQuery composables
---

SQLite Web provides two composables for working with the database in Vue components.

## useSQLiteClientAsync

Returns a promise that resolves to the SQLite client. Use this for mutations and direct database access.

### Basic Usage

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useSQLiteClientAsync } from "@alexop/sqlite-vue";

const dbPromise = useSQLiteClientAsync();
const newTitle = ref("");

async function addTodo() {
  const db = await dbPromise;
  await db.insert("todos").values({
    id: crypto.randomUUID(),
    title: newTitle.value,
  });
  db.notifyTable("todos");
  newTitle.value = "";
}
</script>

<template>
  <input v-model="newTitle" @keyup.enter="addTodo" />
  <button @click="addTodo">Add</button>
</template>
```

### Critical Pattern

`useSQLiteClientAsync()` MUST be called during component setup, not inside async functions:

```typescript
// ✅ CORRECT
const dbPromise = useSQLiteClientAsync();

async function addTodo() {
  const db = await dbPromise; // Await the stored promise
}

// ❌ WRONG - will throw error
async function addTodo() {
  const db = await useSQLiteClientAsync(); // inject() called in async context!
}
```

This is because `useSQLiteClientAsync()` uses Vue's `inject()`, which must be called synchronously during setup.

### Type Safety

The client is fully typed based on your schema:

```typescript
const dbPromise = useSQLiteClientAsync();

async function example() {
  const db = await dbPromise;

  // ✅ TypeScript knows 'todos' table exists
  await db.query("todos").all();

  // ❌ TypeScript error - 'invalid' table doesn't exist
  await db.query("invalid").all();

  // ✅ TypeScript enforces correct field types
  await db.insert("todos").values({
    id: "123",
    title: "Buy milk",
  });
}
```

### Mutations

Use the client for all mutations:

```typescript
const dbPromise = useSQLiteClientAsync();

async function createTodo(title: string) {
  const db = await dbPromise;
  await db.insert("todos").values({
    id: crypto.randomUUID(),
    title,
  });
  db.notifyTable("todos"); // Trigger reactive updates
}

async function updateTodo(id: string, completed: boolean) {
  const db = await dbPromise;
  await db.update("todos").where("id", "=", id).set({ completed }).execute();
  db.notifyTable("todos");
}

async function deleteTodo(id: string) {
  const db = await dbPromise;
  await db.delete("todos").where("id", "=", id).execute();
  db.notifyTable("todos");
}
```

## useSQLiteQuery

Returns reactive query results that automatically update when data changes.

### Basic Usage

```vue
<script setup lang="ts">
import { useSQLiteQuery } from "@alexop/sqlite-vue";

const {
  rows: todos,
  loading,
  error,
} = useSQLiteQuery(
  (db) => db.query("todos").orderBy("createdAt", "DESC").all(),
  { tables: ["todos"] }
);
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <ul v-else>
    <li v-for="todo in todos" :key="todo.id">
      {{ todo.title }}
    </li>
  </ul>
</template>
```

### Parameters

```typescript
function useSQLiteQuery<T>(
  queryFn: (db: SQLiteClient) => Promise<T>,
  options?: {
    tables?: string[];
    immediate?: boolean;
  }
): {
  rows: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<Error | null>;
  refresh: () => Promise<void>;
};
```

- **`queryFn`** - Function that receives the DB client and returns a query result
- **`options.tables`** - Array of table names to subscribe to (default: `[]`)
- **`options.immediate`** - Execute immediately on mount (default: `true`)

### Return Value

- **`rows`** - Reactive ref containing query results (null while loading)
- **`loading`** - Reactive ref indicating loading state
- **`error`** - Reactive ref containing any error
- **`refresh`** - Function to manually re-run the query

### Table Subscriptions

Specify which tables to watch for changes:

```typescript
const { rows } = useSQLiteQuery(
  (db) => db.query("todos").where("userId", "=", currentUserId.value).all(),
  { tables: ["todos"] }
);

// When db.notifyTable("todos") is called, the query re-runs automatically
```

Multiple tables:

```typescript
const { rows } = useSQLiteQuery(
  (db) =>
    db.raw(`
    SELECT todos.*, users.name as userName
    FROM todos
    JOIN users ON todos.userId = users.id
  `),
  { tables: ["todos", "users"] }
);
```

### Manual Refresh

Use the `refresh()` function to manually re-run the query:

```typescript
const { rows, refresh } = useSQLiteQuery((db) => db.query("todos").all(), {
  tables: ["todos"],
});

async function forceRefresh() {
  await refresh();
}
```

### Immediate Execution

Control when the query first runs:

```typescript
// Runs immediately on mount (default)
const { rows } = useSQLiteQuery((db) => db.query("todos").all(), {
  immediate: true,
});

// Waits for manual refresh
const { rows, refresh } = useSQLiteQuery((db) => db.query("todos").all(), {
  immediate: false,
});

// Later...
await refresh();
```

### Complex Queries

Use the full query builder API:

```typescript
const { rows: completedTodos } = useSQLiteQuery(
  (db) =>
    db
      .query("todos")
      .where("completed", "=", true)
      .where("deletedAt", "=", null)
      .orderBy("createdAt", "DESC")
      .limit(50)
      .select("id", "title", "createdAt")
      .all(),
  { tables: ["todos"] }
);
// Type: Ref<Array<{ id: string, title: string, createdAt: string }> | null>
```

### Reactive Parameters

Queries don't automatically re-run when reactive values change. Use `watch` or `computed`:

```typescript
import { ref, watch } from "vue";

const filter = ref<"all" | "active" | "completed">("all");

const { rows, refresh } = useSQLiteQuery(
  (db) => {
    let query = db.query("todos");

    if (filter.value === "active") {
      query = query.where("completed", "=", false);
    } else if (filter.value === "completed") {
      query = query.where("completed", "=", true);
    }

    return query.all();
  },
  { tables: ["todos"] }
);

// Re-run query when filter changes
watch(filter, () => refresh());
```

Or create a composable:

```typescript
function useTodosByFilter(filter: Ref<"all" | "active" | "completed">) {
  const query = computed(() => (db: SQLiteClient) => {
    let q = db.query("todos");

    if (filter.value === "active") {
      q = q.where("completed", "=", false);
    } else if (filter.value === "completed") {
      q = q.where("completed", "=", true);
    }

    return q.all();
  });

  const { rows, loading, error, refresh } = useSQLiteQuery(
    (db) => query.value(db),
    { tables: ["todos"] }
  );

  watch(filter, () => refresh());

  return { rows, loading, error, refresh };
}
```

## Combining Both

Use both composables together:

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
  const db = await dbPromise;
  await db.insert("todos").values({
    id: crypto.randomUUID(),
    title: newTitle.value,
  });
  db.notifyTable("todos"); // Triggers reactive update
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
    <input v-model="newTitle" @keyup.enter="addTodo" />
    <button @click="addTodo">Add</button>

    <div v-if="loading">Loading...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>
    <ul v-else>
      <li v-for="todo in todos" :key="todo.id">
        <input
          type="checkbox"
          :checked="todo.completed"
          @change="toggleTodo(todo.id, todo.completed)"
        />
        {{ todo.title }}
        <button @click="deleteTodo(todo.id)">Delete</button>
      </li>
    </ul>
  </div>
</template>
```

## Error Handling

Both composables handle errors gracefully:

```vue
<script setup lang="ts">
import { useSQLiteQuery, useSQLiteClientAsync } from "@alexop/sqlite-vue";

const { error: queryError } = useSQLiteQuery((db) => db.query("todos").all(), {
  tables: ["todos"],
});

const dbPromise = useSQLiteClientAsync();
const mutationError = ref<Error | null>(null);

async function addTodo() {
  try {
    mutationError.value = null;
    const db = await dbPromise;
    await db.insert("todos").values({
      /* ... */
    });
    db.notifyTable("todos");
  } catch (err) {
    mutationError.value = err as Error;
  }
}
</script>

<template>
  <div v-if="queryError">Query Error: {{ queryError.message }}</div>
  <div v-if="mutationError">Mutation Error: {{ mutationError.message }}</div>
</template>
```

## Best Practices

1. **Call during setup** - Always call composables synchronously in `<script setup>`
2. **Store promises** - Store `useSQLiteClientAsync()` result, don't call it repeatedly
3. **Subscribe to tables** - Always specify `tables` option for reactive queries
4. **Notify after mutations** - Call `db.notifyTable()` after changes
5. **Handle errors** - Check `error` ref and handle mutation errors
6. **Use TypeScript** - Get full type safety for your queries and mutations

## Next Steps

- [Reactive Queries](/vue/reactive-queries/) - Deep dive into reactive patterns
- [Query Builder](/core/query-builder/) - Master the query API
- [Mutations](/core/mutations/) - Learn insert, update, and delete
