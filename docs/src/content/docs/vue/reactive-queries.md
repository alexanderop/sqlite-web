---
title: Reactive Queries
description: Build reactive UIs with automatic query updates
---

SQLite Web's reactive query system automatically re-runs queries when data changes, keeping your UI in sync with the database.

## How It Works

The reactive system uses a pub/sub pattern:

1. Component calls `useSQLiteQuery()` with a query function
2. Query executes and component subscribes to specified tables
3. Mutations call `db.notifyTable(tableName)`
4. All subscribers to that table re-run their queries
5. Reactive refs update, triggering component re-renders

```vue
<script setup lang="ts">
import { useSQLiteQuery, useSQLiteClientAsync } from "@alexop/sqlite-vue";

// Subscribe to 'todos' table
const { rows: todos } = useSQLiteQuery(
  (db) => db.query("todos").all(),
  { tables: ["todos"] } // Subscribe here
);

const dbPromise = useSQLiteClientAsync();

async function addTodo() {
  const db = await dbPromise;
  await db.insert("todos").values({
    /* ... */
  });
  db.notifyTable("todos"); // Notify here
  // todos ref automatically updates!
}
</script>
```

## Basic Example

Complete reactive todo list:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useSQLiteQuery, useSQLiteClientAsync } from "@alexop/sqlite-vue";

// Reactive query
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
    <h1>Todos</h1>

    <input
      v-model="newTitle"
      placeholder="What needs to be done?"
      @keyup.enter="addTodo"
    />
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
        <span :class="{ completed: todo.completed }">
          {{ todo.title }}
        </span>
        <button @click="deleteTodo(todo.id)">×</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.completed {
  text-decoration: line-through;
  opacity: 0.6;
}
</style>
```

## Multiple Queries

Different components can subscribe to the same table:

```vue
<!-- TodoList.vue -->
<script setup lang="ts">
const { rows: todos } = useSQLiteQuery((db) => db.query("todos").all(), {
  tables: ["todos"],
});
</script>

<!-- TodoStats.vue -->
<script setup lang="ts">
const { rows: stats } = useSQLiteQuery(
  async (db) => {
    const total = await db.query("todos").count();
    const completed = await db
      .query("todos")
      .where("completed", "=", true)
      .count();
    return { total, completed, remaining: total - completed };
  },
  { tables: ["todos"] }
);
</script>
```

When `db.notifyTable("todos")` is called, BOTH components re-run their queries.

## Cross-Table Queries

Subscribe to multiple tables for joins:

```vue
<script setup lang="ts">
const { rows: todosWithUsers } = useSQLiteQuery(
  async (db) => {
    const todos = await db.query("todos").all();
    const users = await db.query("users").all();

    return todos.map((todo) => {
      const user = users.find((u) => u.id === todo.userId);
      return { ...todo, userName: user?.name };
    });
  },
  { tables: ["todos", "users"] } // Subscribe to both
);
</script>
```

Or use raw SQL:

```vue
<script setup lang="ts">
interface TodoWithUser {
  id: string;
  title: string;
  userName: string;
}

const { rows } = useSQLiteQuery(
  (db) =>
    db.raw<TodoWithUser>(`
    SELECT todos.*, users.name as userName
    FROM todos
    JOIN users ON todos.userId = users.id
  `),
  { tables: ["todos", "users"] }
);
</script>
```

## Filtered Queries

Different queries on the same table:

```vue
<script setup lang="ts">
const { rows: activeTodos } = useSQLiteQuery(
  (db) => db.query("todos").where("completed", "=", false).all(),
  { tables: ["todos"] }
);

const { rows: completedTodos } = useSQLiteQuery(
  (db) => db.query("todos").where("completed", "=", true).all(),
  { tables: ["todos"] }
);
</script>

<template>
  <div>
    <h2>Active ({{ activeTodos?.length ?? 0 }})</h2>
    <ul>
      <li v-for="todo in activeTodos" :key="todo.id">
        {{ todo.title }}
      </li>
    </ul>

    <h2>Completed ({{ completedTodos?.length ?? 0 }})</h2>
    <ul>
      <li v-for="todo in completedTodos" :key="todo.id">
        {{ todo.title }}
      </li>
    </ul>
  </div>
</template>
```

## Reactive Parameters

To make queries reactive to parameter changes, use `watch`:

```vue
<script setup lang="ts">
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

// Re-run when filter changes
watch(filter, () => refresh());
</script>

<template>
  <div>
    <button @click="filter = 'all'">All</button>
    <button @click="filter = 'active'">Active</button>
    <button @click="filter = 'completed'">Completed</button>

    <ul>
      <li v-for="todo in rows" :key="todo.id">
        {{ todo.title }}
      </li>
    </ul>
  </div>
</template>
```

## Optimistic Updates

Update UI immediately, then sync to database:

```vue
<script setup lang="ts">
import { ref } from "vue";

const { rows: todos } = useSQLiteQuery((db) => db.query("todos").all(), {
  tables: ["todos"],
});

const dbPromise = useSQLiteClientAsync();

async function toggleTodo(id: string) {
  // Find the todo
  const todo = todos.value?.find((t) => t.id === id);
  if (!todo) return;

  // 1. Optimistic update (immediate UI feedback)
  if (todos.value) {
    todos.value = todos.value.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
  }

  // 2. Update database
  try {
    const db = await dbPromise;
    await db
      .update("todos")
      .where("id", "=", id)
      .set({ completed: !todo.completed })
      .execute();

    // 3. Notify to sync with actual data
    db.notifyTable("todos");
  } catch (error) {
    // 4. Revert on error
    console.error("Failed to update:", error);
    db.notifyTable("todos"); // Refresh from database
  }
}
</script>
```

## Manual Refresh

Manually refresh queries when needed:

```vue
<script setup lang="ts">
const { rows, loading, refresh } = useSQLiteQuery(
  (db) => db.query("todos").all(),
  { tables: ["todos"] }
);

async function forceRefresh() {
  await refresh();
}
</script>

<template>
  <div>
    <button @click="forceRefresh" :disabled="loading">Refresh</button>

    <ul>
      <li v-for="todo in rows" :key="todo.id">
        {{ todo.title }}
      </li>
    </ul>
  </div>
</template>
```

## Lazy Loading

Start with `immediate: false` and load on demand:

```vue
<script setup lang="ts">
const { rows, loading, refresh } = useSQLiteQuery(
  (db) => db.query("todos").all(),
  { tables: ["todos"], immediate: false }
);

async function loadTodos() {
  await refresh();
}
</script>

<template>
  <div>
    <button v-if="!rows" @click="loadTodos">Load Todos</button>

    <div v-if="loading">Loading...</div>
    <ul v-else-if="rows">
      <li v-for="todo in rows" :key="todo.id">
        {{ todo.title }}
      </li>
    </ul>
  </div>
</template>
```

## Pagination

Implement pagination with reactive queries:

```vue
<script setup lang="ts">
import { ref, watch } from "vue";

const page = ref(0);
const pageSize = 20;

const { rows, loading, refresh } = useSQLiteQuery(
  (db) =>
    db
      .query("todos")
      .orderBy("createdAt", "DESC")
      .skip(page.value * pageSize)
      .limit(pageSize)
      .all(),
  { tables: ["todos"] }
);

const { rows: totalCount } = useSQLiteQuery((db) => db.query("todos").count(), {
  tables: ["todos"],
});

const totalPages = computed(() =>
  Math.ceil((totalCount.value ?? 0) / pageSize)
);

watch(page, () => refresh());
</script>

<template>
  <div>
    <ul v-if="!loading">
      <li v-for="todo in rows" :key="todo.id">
        {{ todo.title }}
      </li>
    </ul>

    <div>
      <button @click="page--" :disabled="page === 0 || loading">
        Previous
      </button>
      <span>Page {{ page + 1 }} of {{ totalPages }}</span>
      <button @click="page++" :disabled="page >= totalPages - 1 || loading">
        Next
      </button>
    </div>
  </div>
</template>
```

## Computed Queries

Use computed values for derived data:

```vue
<script setup lang="ts">
import { computed } from "vue";

const { rows: todos } = useSQLiteQuery((db) => db.query("todos").all(), {
  tables: ["todos"],
});

const activeTodos = computed(
  () => todos.value?.filter((t) => !t.completed) ?? []
);

const completedTodos = computed(
  () => todos.value?.filter((t) => t.completed) ?? []
);

const stats = computed(() => ({
  total: todos.value?.length ?? 0,
  active: activeTodos.value.length,
  completed: completedTodos.value.length,
}));
</script>

<template>
  <div>
    <p>{{ stats.active }} active, {{ stats.completed }} completed</p>

    <h2>Active</h2>
    <ul>
      <li v-for="todo in activeTodos" :key="todo.id">
        {{ todo.title }}
      </li>
    </ul>
  </div>
</template>
```

## Best Practices

1. **Always notify** - Call `db.notifyTable()` after every mutation
2. **Subscribe to tables** - Specify `tables` option for all reactive queries
3. **Handle loading states** - Show loading indicators during queries
4. **Handle errors** - Display error messages when queries fail
5. **Use computed** - Derive data from queries with `computed()` instead of additional queries
6. **Optimize subscriptions** - Only subscribe to tables that actually change
7. **Batch notifications** - For multiple mutations, notify once at the end

## Performance Tips

### Batch Notifications

When making multiple changes:

```typescript
async function clearCompleted() {
  const db = await dbPromise;
  const completed = await db.query("todos").where("completed", "=", true).all();

  for (const todo of completed) {
    await db.delete("todos").where("id", "=", todo.id).execute();
    // Don't notify here
  }

  // Notify once at the end
  db.notifyTable("todos");
}
```

### Selective Subscriptions

Only subscribe to tables you actually use:

```typescript
// ✅ Good - only subscribes to 'todos'
const { rows } = useSQLiteQuery((db) => db.query("todos").all(), {
  tables: ["todos"],
});

// ❌ Bad - subscribes to all tables (unnecessary re-runs)
const { rows } = useSQLiteQuery(
  (db) => db.query("todos").all(),
  { tables: ["todos", "users", "posts"] } // Too many!
);
```

## Next Steps

- [Composables](/vue/composables/) - Learn the composable APIs in detail
- [Mutations](/core/mutations/) - Master insert, update, and delete
- [Query Builder](/core/query-builder/) - Build complex queries
