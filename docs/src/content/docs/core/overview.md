---
title: Core Package Overview
description: Understanding the @alexop/sqlite-core package architecture
---

The `@alexop/sqlite-core` package provides a type-safe, framework-agnostic SQLite client for browsers using SQLite WASM and OPFS.

## Key Features

- **Type-Safe Query Builder** - Full TypeScript inference for tables, columns, and values
- **Zod Schema Validation** - Runtime validation for all mutations
- **OPFS Persistence** - Data persists across browser sessions
- **Worker-Based Architecture** - SQLite runs in a Web Worker for better performance
- **Migration System** - Version-based schema migrations
- **Pub/Sub Events** - Table change notifications for reactive UIs

## Architecture

### Worker Communication

SQLite WASM runs in a dedicated Web Worker to avoid blocking the main thread. The client uses `sqlite3Worker1Promiser` to communicate asynchronously with the worker.

```typescript
// Internal architecture (simplified)
class SQLiteClient {
  private worker: Worker;
  private promiser: Promiser;

  async query(table) {
    const result = await this.promiser("exec", {
      sql: "SELECT * FROM ...",
      rowMode: "object",
    });
    return result;
  }
}
```

### Lazy Initialization

The database is initialized on the first query, not when you call `createSQLiteClient()`. This ensures the worker and database are only created when needed.

```typescript
const db = await createSQLiteClient({ ... });
// Worker not created yet

const todos = await db.query("todos").all();
// Worker created, database opened, migrations run
```

### Schema Registry

The schema registry provides compile-time type safety by mapping table names to Zod schemas:

```typescript
const schema = {
  users: z.object({ id: z.string(), name: z.string() }),
  posts: z.object({ id: z.string(), title: z.string() }),
} as const;

// TypeScript knows these tables exist
db.query("users"); // ✅
db.query("posts"); // ✅
db.query("invalid"); // ❌ TypeScript error
```

## Type System

The type system is built around several key types:

```typescript
// Schema registry - maps table names to schemas
type SchemaRegistry = Record<string, z.ZodObject<any>>;

// Row type - infers the shape from a schema
type TableRow<TSchema, TTable> = z.infer<TSchema[TTable]>;

// Query result - conditional based on select() usage
type QueryResult<TRow, TSelected> = TSelected extends never
  ? TRow
  : Pick<TRow, TSelected>;
```

All query builder methods preserve and narrow types through the chain:

```typescript
db.query("todos")
  // Type: QueryBuilder<Todo, never>
  .select("id", "title")
  // Type: QueryBuilder<Todo, "id" | "title">
  .where("completed", "=", true)
  // Type: QueryBuilder<Todo, "id" | "title">
  .all();
// Type: Promise<Array<{ id: string, title: string }>>
```

## Query Execution

Queries use `rowMode: "object"` to return JavaScript objects instead of arrays:

```typescript
// rowMode: "array" (SQLite default)
[["1", "Buy milk", 0]][
  // rowMode: "object" (our default)
  { id: "1", title: "Buy milk", completed: 0 }
];
```

## Pub/Sub System

The client includes a simple pub/sub system for table change notifications:

```typescript
// Subscribe to changes
const unsubscribe = db.subscribeToTable("todos", () => {
  console.log("Todos changed!");
});

// Notify subscribers
await db.insert("todos").values({ ... });
db.notifyTable("todos");

// Cleanup
unsubscribe();
```

This powers the reactive query system in the Vue package.

## Client Instance

Each client instance maintains:

- Its own Web Worker
- Its own database connection
- Its own pub/sub subscriptions
- Its own migration state

```typescript
const db1 = await createSQLiteClient({ filename: "file:db1.sqlite3?vfs=opfs" });
const db2 = await createSQLiteClient({ filename: "file:db2.sqlite3?vfs=opfs" });
// Two separate workers, two separate databases
```

## Next Steps

- [Schema Definition](/core/schema/) - Learn how to define your database schema
- [Query Builder](/core/query-builder/) - Master querying with type safety
- [Mutations](/core/mutations/) - Insert, update, and delete data
- [Migrations](/core/migrations/) - Manage schema changes over time
