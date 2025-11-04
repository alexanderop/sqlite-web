---
title: SQLiteClient API
description: Complete API reference for the SQLiteClient class
---

The `SQLiteClient` is the main interface for interacting with the SQLite database.

## createSQLiteClient

Creates a new SQLite client instance.

```typescript
function createSQLiteClient<TSchema extends SchemaRegistry>(
  config: SQLiteConfig<TSchema>
): Promise<SQLiteClient<TSchema>>;
```

### Parameters

```typescript
interface SQLiteConfig<TSchema extends SchemaRegistry> {
  /** Zod schema registry mapping table names to schemas */
  schema: TSchema;

  /** Database filename with optional VFS */
  filename: string;

  /** Array of migrations to run */
  migrations: Migration[];
}

interface Migration {
  /** Unique version number */
  version: number;

  /** SQL statements to execute */
  sql: string;
}
```

### Returns

`Promise<SQLiteClient<TSchema>>` - A promise that resolves to the configured client.

### Example

```typescript
import { createSQLiteClient } from "@alexop/sqlite-core";
import { z } from "zod";

const db = await createSQLiteClient({
  schema: {
    users: z.object({
      id: z.string(),
      name: z.string(),
    }),
  } as const,
  filename: "file:app.sqlite3?vfs=opfs",
  migrations: [
    {
      version: 1,
      sql: "CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL)",
    },
  ],
});
```

## query

Starts a SELECT query on a table.

```typescript
query<TTable extends keyof TSchema>(
  table: TTable
): QueryBuilder<TableRow<TSchema, TTable>, never>
```

### Parameters

- `table` - The table name (must exist in schema)

### Returns

A `QueryBuilder` instance for chaining query methods.

### Example

```typescript
const users = await db
  .query("users")
  .where("age", ">", 18)
  .orderBy("name", "ASC")
  .all();
```

## insert

Inserts a new row into a table.

```typescript
insert<TTable extends keyof TSchema>(
  table: TTable
): InsertBuilder<TSchema, TTable>
```

### Parameters

- `table` - The table name (must exist in schema)

### Returns

An `InsertBuilder` instance for specifying values.

### Example

```typescript
await db.insert("users").values({
  id: crypto.randomUUID(),
  name: "Alice",
  age: 30,
});
```

## update

Updates existing rows in a table.

```typescript
update<TTable extends keyof TSchema>(
  table: TTable
): UpdateBuilder<TSchema, TTable>
```

### Parameters

- `table` - The table name (must exist in schema)

### Returns

An `UpdateBuilder` instance for specifying conditions and values.

### Example

```typescript
await db.update("users").where("id", "=", "123").set({ age: 31 }).execute();
```

## delete

Deletes rows from a table.

```typescript
delete<TTable extends keyof TSchema>(
  table: TTable
): DeleteBuilder<TSchema, TTable>
```

### Parameters

- `table` - The table name (must exist in schema)

### Returns

A `DeleteBuilder` instance for specifying conditions.

### Example

```typescript
await db.delete("users").where("id", "=", "123").execute();
```

## raw

Executes raw SQL and returns typed results.

```typescript
raw<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T[]>
```

### Parameters

- `sql` - The SQL query to execute
- `params` - Optional array of parameters for prepared statements

### Returns

`Promise<T[]>` - Array of result rows

### Example

```typescript
interface UserCount {
  count: number;
}

const result = await db.raw<UserCount>(
  "SELECT COUNT(*) as count FROM users WHERE age > ?",
  [18]
);

console.log(result[0].count);
```

## exec

Executes SQL without returning results.

```typescript
exec(sql: string): Promise<void>
```

### Parameters

- `sql` - The SQL statement to execute

### Returns

`Promise<void>`

### Example

```typescript
await db.exec("PRAGMA foreign_keys = ON");
await db.exec("DELETE FROM users WHERE age < 18");
```

## subscribeToTable

Subscribes to changes on a table.

```typescript
subscribeToTable<TTable extends keyof TSchema>(
  table: TTable,
  callback: () => void
): () => void
```

### Parameters

- `table` - The table name to subscribe to
- `callback` - Function called when table changes

### Returns

Unsubscribe function

### Example

```typescript
const unsubscribe = db.subscribeToTable("users", () => {
  console.log("Users table changed!");
});

// Later, cleanup
unsubscribe();
```

## notifyTable

Notifies subscribers that a table has changed.

```typescript
notifyTable<TTable extends keyof TSchema>(
  table: TTable
): void
```

### Parameters

- `table` - The table name that changed

### Example

```typescript
await db.insert('users').values({ ... });
db.notifyTable('users'); // Triggers reactive updates
```

## close

Closes the database connection and releases resources.

```typescript
close(): Promise<void>
```

### Returns

`Promise<void>` - Resolves when the database is fully closed

### Description

Closes the SQLite worker and flushes OPFS storage. After calling `close()`, all database operations will throw an error with message `"Database is closed"`. This is essential for proper resource cleanup in SPAs and testing scenarios.

Multiple calls to `close()` are safe (idempotent) - subsequent calls will return immediately without error.

### Example

```typescript
const db = await createSQLiteClient({
  schema: { users: userSchema },
  filename: "file:app.sqlite3?vfs=opfs",
  migrations: [],
});

// Use database...
await db.query("users").all();

// Clean up resources when done
await db.close();

// Subsequent operations will throw
try {
  await db.query("users").all();
} catch (error) {
  console.error(error.message); // "Database is closed"
}
```

### Use Cases

**Testing:** Clean up between tests to avoid resource leaks

```typescript
import { afterEach } from "vitest";

let db: SQLiteClient<typeof schema>;

afterEach(async () => {
  await db.close();
});
```

**Vue Component Cleanup:** Close database when component unmounts

```typescript
import { onUnmounted } from 'vue';

const db = await createSQLiteClient({ ... });

onUnmounted(async () => {
  await db.close();
});
```

**Route Changes in SPAs:** Close old database instance when switching routes

```typescript
// Before navigating away
await oldDb.close();
const newDb = await createSQLiteClient({ ... });
```

## isClosed

Check if the database connection is closed.

```typescript
isClosed(): boolean
```

### Returns

`boolean` - `true` if the database has been closed, `false` otherwise

### Example

```typescript
const db = await createSQLiteClient({ ... });

console.log(db.isClosed()); // false

await db.close();
console.log(db.isClosed()); // true

// Use to conditionally close
if (!db.isClosed()) {
  await db.close();
}
```

## QueryBuilder

The query builder provides a fluent API for SELECT queries.

### where

Adds a WHERE condition.

```typescript
where<K extends keyof TRow>(
  column: K,
  operator: Operator,
  value: TRow[K] | TRow[K][]
): QueryBuilder<TRow, TSelected>
```

**Operators:** `=`, `!=`, `>`, `>=`, `<`, `<=`, `LIKE`, `IN`

### select

Selects specific columns.

```typescript
select<K extends keyof TRow>(
  ...columns: K[]
): QueryBuilder<TRow, K>
```

### orderBy

Adds an ORDER BY clause.

```typescript
orderBy<K extends keyof TRow>(
  column: K,
  direction?: 'ASC' | 'DESC'
): QueryBuilder<TRow, TSelected>
```

### limit

Limits the number of results.

```typescript
limit(count: number): QueryBuilder<TRow, TSelected>
```

### skip

Skips a number of results (offset).

```typescript
skip(count: number): QueryBuilder<TRow, TSelected>
```

### all

Executes the query and returns all results.

```typescript
all(): Promise<QueryResult<TRow, TSelected>[]>
```

### first

Executes the query and returns the first result.

```typescript
first(): Promise<QueryResult<TRow, TSelected> | null>
```

### count

Counts the matching rows.

```typescript
count(): Promise<number>
```

## InsertBuilder

Builder for INSERT operations.

### values

Specifies values to insert.

```typescript
values(
  data: z.infer<TSchema[TTable]>
): Promise<void>
```

## UpdateBuilder

Builder for UPDATE operations.

### where

Adds a WHERE condition.

```typescript
where<K extends keyof TRow>(
  column: K,
  operator: Operator,
  value: TRow[K]
): UpdateBuilder<TSchema, TTable>
```

### set

Specifies values to update.

```typescript
set(
  data: Partial<z.infer<TSchema[TTable]>>
): UpdateBuilder<TSchema, TTable>
```

### execute

Executes the update.

```typescript
execute(): Promise<void>
```

## DeleteBuilder

Builder for DELETE operations.

### where

Adds a WHERE condition.

```typescript
where<K extends keyof TRow>(
  column: K,
  operator: Operator,
  value: TRow[K]
): DeleteBuilder<TSchema, TTable>
```

### execute

Executes the delete.

```typescript
execute(): Promise<void>
```

## Type Utilities

### SchemaRegistry

Type for schema definitions.

```typescript
type SchemaRegistry = Record<string, z.ZodObject<any>>;
```

### TableRow

Infers the row type from a schema.

```typescript
type TableRow<
  TSchema extends SchemaRegistry,
  TTable extends keyof TSchema,
> = z.infer<TSchema[TTable]>;
```

### QueryResult

Result type for queries with optional select.

```typescript
type QueryResult<
  TRow,
  TSelected extends keyof TRow | never = never,
> = TSelected extends never ? TRow : Pick<TRow, TSelected>;
```

## Next Steps

- [Query Builder Guide](/core/query-builder/) - Learn query builder patterns
- [Mutations Guide](/core/mutations/) - Learn insert, update, delete
- [Type Safety](/guides/type-safety/) - Understand the type system
