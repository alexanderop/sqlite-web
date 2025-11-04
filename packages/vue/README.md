# @alexop/sqlite-vue

Vue 3 plugin and composables for SQLite in the browser.

## Installation

```bash
npm install @alexop/sqlite-vue @alexop/sqlite-core
```

## Usage

### 1. Install the plugin

```typescript
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
      `,
    },
  ],
});

createApp(App).use(sqlite).mount("#app");
```

### 2. Use in components

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useSQLiteQuery, useSQLiteClientAsync } from "@alexop/sqlite-vue";

// Reactive query with automatic updates
const {
  rows: todos,
  loading,
  error,
  refresh,
} = useSQLiteQuery(
  "SELECT * FROM todos ORDER BY rowid DESC",
  [],
  ["todos"] // Watch these tables for changes
);

const newTitle = ref("");

// Get the client promise during setup (inject() must be called at setup time)
const dbPromise = useSQLiteClientAsync();

async function addTodo() {
  const db = await dbPromise;
  await db.exec("INSERT INTO todos (id, title) VALUES (?, ?)", [
    crypto.randomUUID(),
    newTitle.value,
  ]);
  db.notifyTable("todos"); // Trigger reactive updates
  newTitle.value = "";
}
</script>

<template>
  <div>
    <input v-model="newTitle" placeholder="New todo" />
    <button @click="addTodo">Add</button>

    <p v-if="loading">Loading...</p>
    <p v-if="error">{{ error.message }}</p>

    <ul>
      <li v-for="todo in todos" :key="todo.id">
        {{ todo.title }}
      </li>
    </ul>
  </div>
</template>
```

## API

### `createSQLite(options)`

Creates a Vue plugin for SQLite.

**Options:**

- `filename` (string): Database filename
- `migrations` (Migration[]): Optional migrations

### `useSQLiteQuery<T>(sql, params, watchTables)`

Composable for reactive queries.

**Parameters:**

- `sql` (string): SQL query
- `params` (unknown[]): Query parameters
- `watchTables` (string[]): Tables to watch for changes

**Returns:**

- `rows`: Ref with query results
- `loading`: Ref with loading state
- `error`: Ref with error if any
- `refresh`: Function to manually refresh

### `useSQLiteClientAsync()`

Get the SQLite client instance. **Must be called during component setup**, not inside async functions.

**Returns:** `Promise<SQLiteClient>`

**Usage:**

```typescript
// ✅ Correct: Call during setup
const dbPromise = useSQLiteClientAsync();

async function doSomething() {
  const db = await dbPromise;
  // use db...
}

// ❌ Wrong: Don't call inside async functions
async function doSomething() {
  const db = await useSQLiteClientAsync(); // Error: inject() only works in setup
}
```

## Vite Configuration

Add required headers for SharedArrayBuffer:

```typescript
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

## License

MIT
