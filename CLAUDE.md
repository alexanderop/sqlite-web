# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SQLite Web is a browser-based SQLite library using WASM and OPFS (Origin Private File System) for persistent storage. It provides a **type-safe TypeScript API** with **Zod schema validation** and a **query builder pattern** inspired by Nuxt Content's queryCollection API. Includes Vue 3 integration through composables and plugins.

## Monorepo Structure

This is a pnpm workspace monorepo with two core packages and examples:

- **`packages/core`** (`@alexop/sqlite-core`): Framework-agnostic SQLite client using sqlite-wasm
- **`packages/vue`** (`@alexop/sqlite-vue`): Vue 3 plugin and composables (depends on core)
- **`examples/vue-app`**: Example Vue application

Workspace dependencies use `workspace:*` protocol (e.g., `@alexop/sqlite-core: workspace:*` in vue package).

## Build Commands

```bash
# Install all dependencies
pnpm install

# Build all packages (must build core before vue due to dependency)
pnpm build
# or
pnpm -r run build

# Build specific package
pnpm --filter @alexop/sqlite-core build
pnpm --filter @alexop/sqlite-vue build

# Run Vue example app
pnpm dev:vue
```

## Architecture

### Core Package (`@alexop/sqlite-core`)

The core package wraps sqlite-wasm's worker-based API with a type-safe query builder:

- **Schema Definition**: Uses Zod schemas to define table structure and enable type inference
- **Initialization**: Lazy initialization on first query. Creates SQLite worker and opens database with OPFS VFS
- **Worker Communication**: Uses `sqlite3Worker1Promiser` for async communication with the SQLite worker
- **Migration System**: Runs migrations sorted by version number during initialization
- **Pub/Sub**: Custom event emitter for table change notifications (Map-based, table -> Set<callback>)
- **Query Builder API**: Chainable query builder inspired by Nuxt Content's queryCollection
  - `query(table)`: Start a SELECT query with full type inference
  - `insert(table)`: Insert with Zod validation
  - `update(table)`: Update with WHERE conditions and Zod validation
  - `delete(table)`: Delete with WHERE conditions
  - `exec()` and `raw()`: Direct SQL access for advanced usage

Key implementation details:
- Schema registry provides compile-time type safety for table names, column names, and values
- Query builder methods (`where`, `select`, `orderBy`, `limit`, `skip`) are fully typed
- Results use `rowMode: "object"` to return objects instead of arrays
- `select()` narrows return type to only selected fields
- Zod validates data on insert/update operations
- Each client instance maintains its own worker and database connection

**Type System Architecture**:
- `SchemaRegistry`: Maps table names to Zod schemas
- `TableRow<TSchema, TTable>`: Infers row type from schema
- `QueryResult<TRow, TSelected>`: Conditional type for select projection
- All builder methods preserve and narrow types through the chain

### Vue Package (`@alexop/sqlite-vue`)

Provides Vue integration through dependency injection:

- **Plugin**: `createSQLite()` installs plugin with schema, provides `Promise<SQLiteClient>` via injection key
- **Composables**:
  - `useSQLiteClientAsync()`: Returns the client promise (must be called during setup, not inside async functions)
  - `useSQLiteQuery()`: Reactive query composable that accepts a query builder function and auto-subscribes to table changes

**Critical Vue Pattern**: `useSQLiteClientAsync()` must be called during component setup (not inside async functions) because it uses `inject()`. Store the promise, then await it later:

```typescript
// Correct: Call inject() during setup
const dbPromise = useSQLiteClientAsync();

async function addTodo() {
  const db = await dbPromise; // Await the stored promise
  await db.insert("todos").values({ title: "New todo" });
  db.notifyTable("todos");
}
```

### Reactive Query Flow

1. `useSQLiteQuery()` accepts a function that receives the DB client and returns a promise (query builder result)
2. On mount, awaits client and executes the query function
3. Subscribes to specified tables via the `tables` option
4. When `db.notifyTable(table)` is called, all subscribers re-run their queries
5. Returns reactive refs for `rows`, `loading`, `error`, and `refresh()`

## Browser Requirements

SQLite WASM requires specific headers for SharedArrayBuffer support:

```typescript
// vite.config.ts
server: {
  headers: {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp"
  }
},
optimizeDeps: {
  exclude: ["@sqlite.org/sqlite-wasm"]
}
```

## Publishing

Packages are published to npm with public access:

```bash
# Must build first
pnpm -r run build

# Publish core (independent)
cd packages/core
npm publish --access public

# Publish vue (after core is published, since it depends on core)
cd packages/vue
npm publish --access public
```

## Common Patterns

### 1. Define Schema with Zod

```typescript
import { z } from "zod";

const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean().default(false),
  createdAt: z.string().default(() => new Date().toISOString()),
});

const dbSchema = {
  todos: todoSchema,
  users: userSchema,
} as const;
```

### 2. Create Type-Safe Client

```typescript
import { createSQLiteClient } from "@alexop/sqlite-core";

const db = await createSQLiteClient({
  schema: dbSchema,
  filename: "file:app.sqlite3?vfs=opfs",
  migrations: [
    {
      version: 1,
      sql: `CREATE TABLE todos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    }
  ]
});
```

### 3. Query with Type Safety

```typescript
// Full type safety - autocomplete for tables, columns, and values
const todos = await db.query("todos")
  .where("completed", "=", false)
  .orderBy("createdAt", "DESC")
  .limit(10)
  .all();
// Type: Array<{ id: string, title: string, completed: boolean, createdAt: string }>

// Select specific fields (type narrows automatically)
const titles = await db.query("todos")
  .select("id", "title")
  .where("completed", "=", true)
  .all();
// Type: Array<{ id: string, title: string }>

// Get single result
const todo = await db.query("todos")
  .where("id", "=", "123")
  .first();
// Type: { ... } | null

// Count
const count = await db.query("todos")
  .where("completed", "=", false)
  .count();
// Type: number
```

### 4. Mutations with Validation

```typescript
// Insert - validates against schema
await db.insert("todos").values({
  id: crypto.randomUUID(),
  title: "Buy groceries",
  completed: false,
});
// ✅ TypeScript error if missing required fields or wrong types

// Update
await db.update("todos")
  .where("id", "=", "123")
  .set({ completed: true })
  .execute();

// Delete
await db.delete("todos")
  .where("completed", "=", true)
  .execute();
```

### 5. Vue Integration

```typescript
// In main.ts - define schema and create plugin
import { createSQLite } from "@alexop/sqlite-vue";
import { z } from "zod";

const dbSchema = {
  todos: z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean().default(false),
  })
} as const;

app.use(createSQLite({
  schema: dbSchema,
  filename: "file:app.sqlite3?vfs=opfs",
  migrations: [...]
}));

// In components - use reactive query
const { rows: todos, loading, error } = useSQLiteQuery(
  (db) => db.query("todos").orderBy("createdAt", "DESC").all(),
  { tables: ["todos"] }
);
// rows is fully typed as Ref<Array<Todo> | null>
```

### 6. Table Change Notifications

After mutations, call `db.notifyTable("table_name")` to trigger reactive updates:

```typescript
async function addTodo() {
  const db = await dbPromise;
  await db.insert("todos").values({ title: newTitle.value });
  db.notifyTable("todos"); // Triggers re-run of all subscribers
}
```

### 7. Advanced: Raw SQL Access

For complex queries not supported by the builder:

```typescript
const results = await db.raw<CustomType>("SELECT * FROM todos WHERE ...", [params]);
await db.exec("PRAGMA foreign_keys = ON");
```
