# @alexop/sqlite-kysely

Kysely dialect for browser-based SQLite using [@alexop/sqlite-core](https://github.com/alexanderopalic/sqlite-web/tree/main/packages/core).

This package enables you to use [Kysely](https://kysely.dev), the type-safe TypeScript SQL query builder, with SQLite WASM in the browser, using OPFS (Origin Private File System) for persistent storage.

## Features

- ✅ **Type-safe queries** - Full TypeScript support with Kysely's query builder
- ✅ **Browser SQLite** - Runs SQLite WASM in the browser with OPFS persistence
- ✅ **All Kysely features** - Supports SELECT, INSERT, UPDATE, DELETE, JOIN, transactions, and more
- ✅ **Zero configuration** - Works seamlessly with your existing SQLite core setup

## Installation

```bash
npm install kysely @alexop/sqlite-core @alexop/sqlite-kysely
```

## Quick Start

```typescript
import { Kysely } from 'kysely';
import { SqliteWebDialect } from '@alexop/sqlite-kysely';
import { createSQLiteClient } from '@alexop/sqlite-core';

// Define your database schema
interface Database {
  users: {
    id: number;
    name: string;
    email: string;
  };
  posts: {
    id: number;
    userId: number;
    title: string;
    content: string;
  };
}

// Create Kysely instance
const db = new Kysely<Database>({
  dialect: new SqliteWebDialect({
    database: async () => createSQLiteClient({
      filename: 'myapp.db',
      migrations: [
        {
          version: 1,
          sql: `
            CREATE TABLE users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE
            )
          `
        },
        {
          version: 2,
          sql: `
            CREATE TABLE posts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              userId INTEGER NOT NULL,
              title TEXT NOT NULL,
              content TEXT NOT NULL,
              FOREIGN KEY (userId) REFERENCES users(id)
            )
          `
        }
      ]
    })
  })
});

// Use Kysely's type-safe query builder
const users = await db
  .selectFrom('users')
  .select(['name', 'email'])
  .where('email', 'like', '%@example.com')
  .orderBy('name', 'asc')
  .execute();
```

## Usage Examples

### Insert

```typescript
const result = await db
  .insertInto('users')
  .values({
    name: 'Alice',
    email: 'alice@example.com'
  })
  .executeTakeFirstOrThrow();

console.log(result.insertId); // The ID of the inserted row
```

### Select with WHERE and ORDER BY

```typescript
const users = await db
  .selectFrom('users')
  .selectAll()
  .where('name', 'like', 'A%')
  .orderBy('name', 'asc')
  .limit(10)
  .execute();
```

### Update

```typescript
await db
  .updateTable('users')
  .set({ email: 'newemail@example.com' })
  .where('id', '=', 1)
  .execute();
```

### Delete

```typescript
await db
  .deleteFrom('users')
  .where('email', 'like', '%spam.com')
  .execute();
```

### Joins

```typescript
const postsWithAuthors = await db
  .selectFrom('posts')
  .innerJoin('users', 'users.id', 'posts.userId')
  .select([
    'posts.title',
    'posts.content',
    'users.name as authorName',
    'users.email as authorEmail'
  ])
  .execute();
```

### Transactions

```typescript
await db.transaction().execute(async (trx) => {
  // Insert user
  const user = await trx
    .insertInto('users')
    .values({ name: 'Bob', email: 'bob@example.com' })
    .executeTakeFirstOrThrow();

  // Insert post for that user
  await trx
    .insertInto('posts')
    .values({
      userId: Number(user.insertId),
      title: 'First Post',
      content: 'Hello World'
    })
    .execute();

  // Both operations succeed or both are rolled back
});
```

## Browser Requirements

SQLite WASM requires specific HTTP headers for SharedArrayBuffer support. Configure your dev server:

### Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm']
  }
});
```

## API

### `SqliteWebDialect`

Kysely dialect implementation for browser-based SQLite.

#### Constructor Options

```typescript
interface SqliteWebDialectConfig {
  /**
   * SQLite client instance or factory function that creates one
   */
  database: SQLiteClient | (() => Promise<SQLiteClient>);
}
```

## Why Use This?

### Kysely Query Builder

Instead of writing raw SQL strings:

```typescript
const users = await db.raw(
  'SELECT name, email FROM users WHERE email LIKE ? ORDER BY name ASC LIMIT ?',
  ['%@example.com', 10]
);
```

You get type-safe, composable queries:

```typescript
const users = await db
  .selectFrom('users')
  .select(['name', 'email'])
  .where('email', 'like', '%@example.com')
  .orderBy('name', 'asc')
  .limit(10)
  .execute();
```

### TypeScript Benefits

- ✅ **Autocomplete** - Your IDE suggests table names, column names, and methods
- ✅ **Type inference** - Result types are automatically inferred from your queries
- ✅ **Compile-time errors** - Catch typos and invalid queries before runtime
- ✅ **Refactoring safety** - Rename columns and TypeScript finds all usages

## Learn More

- [Kysely Documentation](https://kysely.dev)
- [Kysely API Reference](https://kysely-org.github.io/kysely-apidoc/)
- [@alexop/sqlite-core Documentation](https://github.com/alexanderopalic/sqlite-web/tree/main/packages/core)

## License

MIT
