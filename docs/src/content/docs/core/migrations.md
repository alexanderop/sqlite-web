---
title: Migrations
description: Manage database schema changes with version-based migrations
---

SQLite Web includes a built-in migration system that runs automatically when the database is initialized.

## Basic Migrations

Define migrations as an array of objects with `version` and `sql` properties:

```typescript
const db = await createSQLiteClient({
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
});
```

## Migration Execution

Migrations run automatically:

1. On the first query (lazy initialization)
2. In order by version number (1, 2, 3, ...)
3. Only migrations not yet applied are run
4. Migration state is tracked in an internal table

```typescript
const db = await createSQLiteClient({
  schema: dbSchema,
  filename: "file:app.sqlite3?vfs=opfs",
  migrations: [
    { version: 1, sql: "CREATE TABLE users ..." },
    { version: 2, sql: "CREATE TABLE posts ..." },
    { version: 3, sql: "ALTER TABLE users ADD COLUMN bio TEXT" },
  ],
});

// First query triggers migration execution
const users = await db.query("users").all();
// Migrations 1, 2, 3 run in order
```

## Adding New Migrations

When you need to change your schema, add a new migration with the next version number:

```typescript
// Initial migrations
const migrations = [
  {
    version: 1,
    sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL)`,
  },
];

// Later, add a new column
const migrations = [
  {
    version: 1,
    sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL)`,
  },
  {
    version: 2,
    sql: `ALTER TABLE todos ADD COLUMN completed INTEGER DEFAULT 0`,
  },
];

// Even later, add another table
const migrations = [
  {
    version: 1,
    sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL)`,
  },
  {
    version: 2,
    sql: `ALTER TABLE todos ADD COLUMN completed INTEGER DEFAULT 0`,
  },
  {
    version: 3,
    sql: `CREATE TABLE tags (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
  },
];
```

:::caution
Never modify existing migrations that have been deployed to users. Always add new migrations with incremented version numbers.
:::

## Multi-Statement Migrations

Each migration can contain multiple SQL statements:

```typescript
{
  version: 2,
  sql: `
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE todo_categories (
      todoId TEXT,
      categoryId TEXT,
      PRIMARY KEY (todoId, categoryId),
      FOREIGN KEY (todoId) REFERENCES todos(id),
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );

    CREATE INDEX idx_todo_categories_todo ON todo_categories(todoId);
  `
}
```

## Common Migration Patterns

### Creating Tables

```typescript
{
  version: 1,
  sql: `
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `
}
```

### Adding Columns

```typescript
{
  version: 2,
  sql: `ALTER TABLE users ADD COLUMN bio TEXT`
}
```

:::note
SQLite's `ALTER TABLE` is limited. You can only:

- Add columns with `ADD COLUMN`
- Rename columns with `RENAME COLUMN` (SQLite 3.25+)
- Rename tables with `RENAME TO`

For other changes, see [Modifying Columns](#modifying-columns) below.
:::

### Creating Indexes

```typescript
{
  version: 3,
  sql: `
    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_todos_completed ON todos(completed);
  `
}
```

### Adding Foreign Keys

Foreign keys must be added when creating the table:

```typescript
{
  version: 4,
  sql: `
    CREATE TABLE comments (
      id TEXT PRIMARY KEY,
      todoId TEXT NOT NULL,
      text TEXT NOT NULL,
      FOREIGN KEY (todoId) REFERENCES todos(id) ON DELETE CASCADE
    )
  `
}
```

Enable foreign key enforcement:

```typescript
{
  version: 1,
  sql: `PRAGMA foreign_keys = ON`
}
```

### Modifying Columns

SQLite doesn't support `ALTER COLUMN` directly. Use a temporary table:

```typescript
{
  version: 5,
  sql: `
    -- Create new table with desired schema
    CREATE TABLE users_new (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      age INTEGER,  -- Changed from TEXT to INTEGER
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Copy data
    INSERT INTO users_new (id, email, name, createdAt)
    SELECT id, email, name, createdAt FROM users;

    -- Drop old table
    DROP TABLE users;

    -- Rename new table
    ALTER TABLE users_new RENAME TO users;
  `
}
```

### Seed Data

Include initial data in migrations:

```typescript
{
  version: 6,
  sql: `
    INSERT INTO categories (id, name) VALUES
      ('1', 'Work'),
      ('2', 'Personal'),
      ('3', 'Shopping');
  `
}
```

## Migration Organization

For large projects, organize migrations in separate files:

```typescript
// migrations/001-initial.ts
export const migration001 = {
  version: 1,
  sql: `CREATE TABLE users (...)`,
};

// migrations/002-add-todos.ts
export const migration002 = {
  version: 2,
  sql: `CREATE TABLE todos (...)`,
};

// migrations/index.ts
import { migration001 } from "./001-initial";
import { migration002 } from "./002-add-todos";

export const migrations = [migration001, migration002];

// app.ts
import { migrations } from "./migrations";

const db = await createSQLiteClient({
  schema: dbSchema,
  filename: "file:app.sqlite3?vfs=opfs",
  migrations,
});
```

## Version Tracking

Migrations are tracked in an internal `__migrations__` table:

```sql
CREATE TABLE IF NOT EXISTS __migrations__ (
  version INTEGER PRIMARY KEY,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

You can query this table to see which migrations have run:

```typescript
const applied = await db.raw<{ version: number }>(
  "SELECT version FROM __migrations__ ORDER BY version"
);

console.log(
  "Applied migrations:",
  applied.map((m) => m.version)
);
```

## Development Workflow

During development, you might want to reset the database:

```typescript
// Clear all data (for development only!)
await db.exec("DROP TABLE IF EXISTS users");
await db.exec("DROP TABLE IF EXISTS todos");
await db.exec("DROP TABLE IF EXISTS __migrations__");

// Migrations will run again on next query
const users = await db.query("users").all();
```

:::danger
Never do this in production! You'll lose all user data.
:::

## Production Considerations

### Testing Migrations

Always test migrations before deploying:

```typescript
// Create a test database
const testDb = await createSQLiteClient({
  schema: dbSchema,
  filename: "file:test.sqlite3?vfs=opfs",
  migrations: [...existingMigrations, newMigration],
});

// Run a test query to trigger migrations
await testDb.query("users").all();

// Verify the schema
const tables = await testDb.raw(
  "SELECT name FROM sqlite_master WHERE type='table'"
);
console.log(tables);
```

### Backwards Compatibility

When adding new columns, use defaults to ensure existing code works:

```typescript
// Old schema
const oldSchema = {
  users: z.object({
    id: z.string(),
    name: z.string(),
  })
} as const;

// New schema - add optional/default field
const newSchema = {
  users: z.object({
    id: z.string(),
    name: z.string(),
    bio: z.string().optional(),  // Safe - existing rows have NULL
  })
} as const;

// Migration
{
  version: 2,
  sql: `ALTER TABLE users ADD COLUMN bio TEXT`  // NULL by default
}
```

### Data Migrations

Sometimes you need to transform existing data:

```typescript
{
  version: 7,
  sql: `
    -- Add new column
    ALTER TABLE todos ADD COLUMN priority TEXT DEFAULT 'medium';

    -- Update existing rows based on some logic
    UPDATE todos SET priority = 'high' WHERE title LIKE '%urgent%';
    UPDATE todos SET priority = 'low' WHERE completed = 1;
  `
}
```

## Best Practices

1. **Never modify existing migrations** - Always add new ones
2. **Use version numbers** - Start at 1 and increment
3. **Test before deploying** - Verify migrations work on sample data
4. **Add defaults** - New columns should have defaults or be optional
5. **Keep migrations small** - One logical change per migration
6. **Document complex migrations** - Add comments explaining why
7. **Backup before major changes** - Especially for data transformations

## Next Steps

- [Schema Definition](/core/schema/) - Learn how to update your Zod schemas
- [Browser Setup](/guides/browser-setup/) - Configure your build tool
- [Type Safety](/guides/type-safety/) - Ensure migrations maintain type safety
