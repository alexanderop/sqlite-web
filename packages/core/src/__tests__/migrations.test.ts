/**
 * Browser tests for migration system
 *
 * These tests verify that migrations:
 * - Run automatically on first query
 * - Execute in order by version number
 * - Only run migrations not yet applied
 * - Track migration state in __migrations__ table
 * - Support multi-statement migrations
 * - Handle common migration patterns
 *
 * Run with: pnpm --filter @alexop/sqlite-core test:run
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createSQLiteClient, type Migration } from "../index";
import { z } from "zod";

// Test schema
const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean().default(false),
  createdAt: z.string().default(() => new Date().toISOString()),
});

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  bio: z.string().optional(),
});

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
});

const testSchema = {
  todos: todoSchema,
  users: userSchema,
  categories: categorySchema,
} as const;

describe("Migrations - Basic Execution", () => {
  it("should run migrations on first query", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
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

    // First query triggers migration execution
    const todos = await db.query("todos").all();
    expect(todos).toEqual([]);

    // Verify table exists by inserting data
    await db.insert("todos").values({
      id: "1",
      title: "Test todo",
      completed: false,
    });

    const result = await db.query("todos").all();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "1",
      title: "Test todo",
      completed: 0, // SQLite stores booleans as 0/1
    });
  });

  it("should run multiple migrations in version order", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL)`,
        },
        {
          version: 2,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    // Trigger migrations
    await db.query("todos").all();

    // Verify both tables exist
    await db.insert("users").values({ id: 1, name: "John", email: "john@example.com" });
    await db.insert("todos").values({ id: "1", title: "Test" });

    const users = await db.query("users").all();
    const todos = await db.query("todos").all();

    expect(users).toHaveLength(1);
    expect(todos).toHaveLength(1);
    expect(todos[0]).toHaveProperty("completed");
    expect(todos[0]).toHaveProperty("createdAt");
  });

  it("should run migrations even when provided out of order", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 3,
          sql: `ALTER TABLE users ADD COLUMN bio TEXT`,
        },
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL)`,
        },
        {
          version: 2,
          sql: `CREATE INDEX idx_users_email ON users(email)`,
        },
      ],
    });

    // Trigger migrations
    await db.query("users").all();

    // Verify table exists with bio column
    await db.insert("users").values({
      id: 1,
      name: "Jane",
      email: "jane@example.com",
      bio: "Developer",
    });

    const users = await db.query("users").all();
    expect(users).toHaveLength(1);
    expect(users[0]).toHaveProperty("bio", "Developer");
  });
});

describe("Migrations - Tracking and State", () => {
  it("should create __migrations__ table to track applied migrations", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL)`,
        },
      ],
    });

    // Trigger migrations
    await db.query("todos").all();

    // Check __migrations__ table exists
    const migrations = await db.raw<{ version: number; applied_at: string }>(
      "SELECT version, applied_at FROM __migrations__ ORDER BY version"
    );

    expect(migrations).toHaveLength(1);
    expect(migrations[0].version).toBe(1);
    expect(migrations[0].applied_at).toBeTruthy();
  });

  it("should only run migrations not yet applied", async () => {
    const filename = `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`;

    // Create database with first migration
    const db1 = await createSQLiteClient({
      schema: testSchema,
      filename,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db1.query("todos").all();

    // Add data
    await db1.insert("todos").values({ id: "1", title: "First todo" });

    // Create new client with additional migrations
    const db2 = await createSQLiteClient({
      schema: testSchema,
      filename,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
        {
          version: 2,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL)`,
        },
        {
          version: 3,
          sql: `CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
        },
      ],
    });

    // Trigger new migrations (will only run version 2 and 3)
    await db2.query("todos").all();

    // Verify migration 1 didn't re-run (data still exists)
    const todos = await db2.query("todos").all();
    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe("First todo");

    // Verify new migrations ran
    await db2.insert("users").values({ id: 1, name: "Test", email: "test@example.com" });
    await db2.insert("categories").values({ id: "1", name: "Work" });

    // Verify migration tracking
    const migrations = await db2.raw<{ version: number }>(
      "SELECT version FROM __migrations__ ORDER BY version"
    );
    expect(migrations.map((m) => m.version)).toEqual([1, 2, 3]);
  });

  it("should not re-run migrations that are already applied", async () => {
    const filename = `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`;

    // Create database with migrations
    const db1 = await createSQLiteClient({
      schema: testSchema,
      filename,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL)`,
        },
        {
          version: 2,
          sql: `INSERT INTO todos (id, title) VALUES ('seed-1', 'Seeded todo')`,
        },
      ],
    });

    await db1.query("todos").all();

    // Re-open database with same migrations
    const db2 = await createSQLiteClient({
      schema: testSchema,
      filename,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL)`,
        },
        {
          version: 2,
          sql: `INSERT INTO todos (id, title) VALUES ('seed-1', 'Seeded todo')`,
        },
      ],
    });

    await db2.query("todos").all();

    // If migrations ran again, we'd get a duplicate key error or 2 rows
    // We should only have 1 seeded row
    const todos = await db2.query("todos").all();
    expect(todos).toHaveLength(1);
    expect(todos[0].id).toBe("seed-1");
  });
});

describe("Migrations - Multi-Statement Migrations", () => {
  it("should execute multiple SQL statements in a single migration", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `
            CREATE TABLE categories (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL
            );

            CREATE INDEX idx_categories_name ON categories(name);
          `,
        },
      ],
    });

    // Trigger migrations
    await db.query("categories").all();

    // Verify all tables and indexes were created
    await db.insert("categories").values({ id: "1", name: "Work" });

    const categories = await db.query("categories").all();

    expect(categories).toHaveLength(1);

    // Verify index exists by checking sqlite_master
    const indexes = await db.raw<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_categories_name'"
    );
    expect(indexes).toHaveLength(1);
  });

  it("should handle migrations with seed data", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
        },
        {
          version: 2,
          sql: `
            INSERT INTO categories (id, name) VALUES ('1', 'Work');
            INSERT INTO categories (id, name) VALUES ('2', 'Personal');
            INSERT INTO categories (id, name) VALUES ('3', 'Shopping');
          `,
        },
      ],
    });

    // Trigger migrations
    await db.query("categories").all();

    const categories = await db.query("categories").all();
    expect(categories).toHaveLength(3);
    expect(categories.map((c) => c.name)).toEqual(["Work", "Personal", "Shopping"]);
  });
});

describe("Migrations - Common Patterns", () => {
  it("should support adding columns with ALTER TABLE", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL)`,
        },
        {
          version: 2,
          sql: `ALTER TABLE users ADD COLUMN bio TEXT`,
        },
      ],
    });

    // Trigger migrations
    await db.query("users").all();

    // Verify column was added
    await db.insert("users").values({
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      bio: "Software developer",
    });

    const users = await db.query("users").all();
    expect(users[0]).toHaveProperty("bio", "Software developer");
  });

  it("should support creating indexes", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL)`,
        },
        {
          version: 2,
          sql: `
            CREATE INDEX idx_users_email ON users(email);
            CREATE INDEX idx_users_name ON users(name);
          `,
        },
      ],
    });

    // Trigger migrations
    await db.query("users").all();

    // Verify indexes exist
    const indexes = await db.raw<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='users' ORDER BY name"
    );

    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("idx_users_email");
    expect(indexNames).toContain("idx_users_name");
  });

  it("should support data migrations (transforming existing data)", async () => {
    const db = await createSQLiteClient({
      schema: {
        todos: todoSchema.extend({ priority: z.string().optional() })
      },
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
        {
          version: 2,
          sql: `
            INSERT INTO todos (id, title, completed) VALUES ('1', 'URGENT: Fix bug', 0);
            INSERT INTO todos (id, title, completed) VALUES ('2', 'Complete project', 1);
            INSERT INTO todos (id, title, completed) VALUES ('3', 'Review code', 0);
          `,
        },
        {
          version: 3,
          sql: `
            ALTER TABLE todos ADD COLUMN priority TEXT DEFAULT 'medium';
            UPDATE todos SET priority = 'high' WHERE title LIKE '%URGENT%';
            UPDATE todos SET priority = 'low' WHERE completed = 1;
          `,
        },
      ],
    });

    // Trigger migrations
    await db.query("todos").all();

    const todos = await db.query("todos").all();
    expect(todos).toHaveLength(3);

    const urgent = todos.find((t) => t.id === "1");
    const completed = todos.find((t) => t.id === "2");
    const normal = todos.find((t) => t.id === "3");

    expect(urgent?.priority).toBe("high");
    expect(completed?.priority).toBe("low");
    expect(normal?.priority).toBe("medium");
  });

  it("should support table modifications using temp table pattern", async () => {
    const db = await createSQLiteClient({
      schema: {
        users: z.object({
          id: z.number(),
          name: z.string(),
          email: z.string(),
          age: z.number(),
        })
      },
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `
            CREATE TABLE users (
              id INTEGER PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT NOT NULL,
              age TEXT  -- Wrong type, should be INTEGER
            )
          `,
        },
        {
          version: 2,
          sql: `INSERT INTO users (id, name, email, age) VALUES (1, 'John', 'john@example.com', '25')`,
        },
        {
          version: 3,
          sql: `
            -- Create new table with correct schema
            CREATE TABLE users_new (
              id INTEGER PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT NOT NULL,
              age INTEGER
            );

            -- Copy data (converting age to integer)
            INSERT INTO users_new (id, name, email, age)
            SELECT id, name, email, CAST(age AS INTEGER) FROM users;

            -- Drop old table
            DROP TABLE users;

            -- Rename new table
            ALTER TABLE users_new RENAME TO users;
          `,
        },
      ],
    });

    // Trigger migrations
    await db.query("users").all();

    const users = await db.query("users").all();
    expect(users).toHaveLength(1);
    expect(users[0].age).toBe(25);
    expect(typeof users[0].age).toBe("number");
  });
});

describe("Migrations - Edge Cases", () => {
  it("should handle empty migrations array", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [],
    });

    // Should work without errors
    await expect(db.exec("SELECT 1")).resolves.toBeDefined();
  });

  it("should handle undefined migrations", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
    });

    // Should work without errors
    await expect(db.exec("SELECT 1")).resolves.toBeDefined();
  });

  it("should handle gaps in version numbers", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
        {
          version: 5,
          sql: `CREATE INDEX idx_todos_completed ON todos(completed)`,
        },
      ],
    });

    // Trigger migrations
    await db.query("todos").all();

    // Verify all migrations ran
    const migrations = await db.raw<{ version: number }>(
      "SELECT version FROM __migrations__ ORDER BY version"
    );
    expect(migrations.map((m) => m.version)).toEqual([1, 5]);

    // Verify functionality
    await db.insert("todos").values({ id: "1", title: "Test" });
    const todos = await db.query("todos").all();
    expect(todos[0]).toHaveProperty("completed");
  });

  it("should query applied migrations using raw query", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        { version: 1, sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT, completed INTEGER, createdAt TEXT)` },
      ],
    });

    // Trigger migrations
    await db.query("todos").all();

    // Query applied migrations as shown in docs
    const applied = await db.raw<{ version: number }>(
      "SELECT version FROM __migrations__ ORDER BY version"
    );

    expect(applied.map((m) => m.version)).toEqual([1]);
  });
});

describe("Migrations - Production Scenarios", () => {
  it("should maintain backwards compatibility when adding optional columns", async () => {
    const filename = `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`;

    // Old schema
    const oldSchema = {
      users: z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
      }),
    } as const;

    const db1 = await createSQLiteClient({
      schema: oldSchema,
      filename,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL)`,
        },
      ],
    });

    // Add data with old schema
    await db1.insert("users").values({ id: 1, name: "Alice", email: "alice@example.com" });

    // New schema with optional field
    const newSchema = {
      users: z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
        bio: z.string().optional(),
      }),
    } as const;

    const db2 = await createSQLiteClient({
      schema: newSchema,
      filename,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL)`,
        },
        {
          version: 2,
          sql: `ALTER TABLE users ADD COLUMN bio TEXT`,
        },
      ],
    });

    // Trigger new migration
    await db2.query("users").all();

    // Old data should still be accessible
    const users = await db2.query("users").all();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ id: 1, name: "Alice", email: "alice@example.com" });
    // SQLite returns null for missing optional columns
    expect(users[0].bio).toBeNull();

    // New inserts can include bio
    await db2.insert("users").values({ id: 2, name: "Bob", email: "bob@example.com", bio: "Developer" });
    const allUsers = await db2.query("users").all();
    expect(allUsers).toHaveLength(2);
  });

  it("should support adding new tables without affecting existing data", async () => {
    const filename = `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`;

    const db1 = await createSQLiteClient({
      schema: { todos: todoSchema },
      filename,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    // Add existing data
    await db1.insert("todos").values({ id: "1", title: "Existing todo" });

    // Add new table
    const db2 = await createSQLiteClient({
      schema: { ...testSchema },
      filename,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
        {
          version: 2,
          sql: `CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
        },
      ],
    });

    await db2.query("categories").all();

    // Old data should be intact
    const todos = await db2.query("todos").all();
    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe("Existing todo");

    // New table should work
    await db2.insert("categories").values({ id: "1", name: "Work" });
    const categories = await db2.query("categories").all();
    expect(categories).toHaveLength(1);
  });
});
