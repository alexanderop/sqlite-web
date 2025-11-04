# @alexop/sqlite-core

Core SQLite client for the browser using SQLite WASM and OPFS.

## Installation

```bash
npm install @alexop/sqlite-core
```

## Usage

```typescript
import { createSQLiteClient } from "@alexop/sqlite-core";

// Create a client with OPFS storage
const client = await createSQLiteClient({
  filename: "file:mydb.sqlite3?vfs=opfs",
  migrations: [
    {
      version: 1,
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        );
      `,
    },
  ],
});

// Execute queries
await client.exec("INSERT INTO users (id, name) VALUES (?, ?)", [
  "1",
  "John Doe",
]);

// Query data
const users = await client.query("SELECT * FROM users");
console.log(users);

// Subscribe to table changes
const unsubscribe = client.subscribe("users", () => {
  console.log("Users table changed!");
});

// Notify subscribers
client.notifyTable("users");

// Cleanup
unsubscribe();
```

## API

### `createSQLiteClient(options)`

Creates a new SQLite client instance.

**Options:**

- `filename` (string): Database filename. Use `file:name.sqlite3?vfs=opfs` for persistent OPFS storage
- `migrations` (Migration[]): Optional array of migrations to run on initialization

**Returns:** `Promise<SQLiteClient>`

### `SQLiteClient`

**Methods:**

- `exec(sql, params?)`: Execute SQL statement
- `query<T>(sql, params?)`: Execute query and return results
- `notifyTable(table)`: Notify subscribers that a table changed
- `subscribe(table, callback)`: Subscribe to table changes, returns unsubscribe function

## Requirements

- Modern browser with OPFS support
- COOP/COEP headers for SharedArrayBuffer support

## License

MIT
