/**
 * Browser tests for Error Handling
 *
 * These tests verify that:
 * - SQL syntax errors are caught and reported
 * - Invalid table/column names throw errors
 * - Constraint violations (UNIQUE, NOT NULL, FOREIGN KEY) are handled
 * - Zod validation errors provide clear messages
 * - Database initialization errors are caught
 * - Raw SQL errors are handled properly
 *
 * Run with: pnpm --filter @alexop/sqlite-core test
 */

import { describe, it, expect } from "vitest";
import { createSQLiteClient } from "../index";
import { z } from "zod";

// Test schema
const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean().default(false),
});

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

const testSchema = {
  todos: todoSchema,
  users: userSchema,
} as const;

describe("SQL Syntax Errors", () => {
  it("should throw error for invalid SQL in raw query", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    await db.query("todos").all(); // Initialize

    // Invalid SQL syntax
    await expect(db.raw("SELCT * FROM todos")).rejects.toThrow();
  });

  it("should throw error for invalid table name in raw query", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    await db.query("todos").all();

    await expect(db.raw("SELECT * FROM nonexistent_table")).rejects.toThrow();
  });

  it("should throw error for invalid column name in raw query", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    await db.query("todos").all();

    await expect(db.raw("SELECT nonexistent_column FROM todos")).rejects.toThrow();
  });

  it("should throw error for malformed exec statement", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    await db.query("todos").all();

    await expect(db.exec("CREATE TABLE (")).rejects.toThrow();
  });
});

describe("Constraint Violations", () => {
  it("should throw error for UNIQUE constraint violation", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "Alice", email: "alice@example.com" });

    // Try to insert duplicate email
    await expect(
      db.insert("users").values({ id: 2, name: "Bob", email: "alice@example.com" })
    ).rejects.toThrow();
  });

  it("should throw error for PRIMARY KEY constraint violation", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Task 1" });

    // Try to insert duplicate primary key
    await expect(db.insert("todos").values({ id: "1", title: "Task 2" })).rejects.toThrow();
  });

  it("should throw error for NOT NULL constraint violation", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    // Try to insert NULL for NOT NULL column using raw SQL
    await expect(db.raw("INSERT INTO todos (id, title) VALUES (?, ?)", ["1", null])).rejects.toThrow();
  });

  it("should throw error for FOREIGN KEY constraint violation when enabled", async () => {
    const db = await createSQLiteClient({
      schema: {
        categories: z.object({ id: z.string(), name: z.string() }),
        todos: z.object({
          id: z.string(),
          title: z.string(),
          categoryId: z.string(),
        }),
      },
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `
            PRAGMA foreign_keys = ON;
            CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL);
            CREATE TABLE todos (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              categoryId TEXT NOT NULL,
              FOREIGN KEY (categoryId) REFERENCES categories(id)
            );
          `,
        },
      ],
    });

    await db.query("todos").all(); // Initialize

    // Try to insert todo with non-existent category
    await expect(
      db.raw("INSERT INTO todos (id, title, categoryId) VALUES (?, ?, ?)", ["1", "Task", "nonexistent"])
    ).rejects.toThrow();
  });
});

describe("Zod Validation Error Messages", () => {
  it("should provide clear error for invalid email format", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL)`,
        },
      ],
    });

    try {
      await db.insert("users").values({
        id: 1,
        name: "Test",
        email: "not-an-email",
      });
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.message).toBeTruthy();
      // Zod includes validation details in the error
      expect(error.toString()).toContain("email");
    }
  });

  it("should provide clear error for missing required field", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL)`,
        },
      ],
    });

    try {
      await db.insert("users").values({
        id: 1,
        // name is missing
        email: "test@example.com",
      } as any);
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      // Zod errors have an issues/errors array
      expect(error).toBeTruthy();
      // Zod error structure: error.issues or error.errors contains validation details
      const errorDetails = JSON.stringify(error.issues || error.errors || error);
      expect(errorDetails.toLowerCase()).toContain("name");
    }
  });

  it("should provide clear error for wrong type", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL)`,
        },
      ],
    });

    try {
      await db.insert("users").values({
        id: "not-a-number" as any,
        name: "Test",
        email: "test@example.com",
      });
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.message).toBeTruthy();
    }
  });
});

describe("Migration Errors", () => {
  it("should throw error for invalid migration SQL", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABEL todos (`, // Invalid SQL
        },
      ],
    });

    // Migrations run on first query, so error happens here
    await expect(db.query("todos").all()).rejects.toThrow();
  });

  it("should throw error when migration references non-existent table", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `ALTER TABLE nonexistent ADD COLUMN test TEXT`,
        },
      ],
    });

    // Migrations run on first query, so error happens here
    await expect(db.query("todos").all()).rejects.toThrow();
  });
});

describe("Raw SQL and Advanced Queries", () => {
  it("should handle errors in complex JOIN queries", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `
            CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL);
            CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, userId INTEGER);
          `,
        },
      ],
    });

    await db.query("todos").all();

    // Invalid JOIN syntax
    await expect(
      db.raw("SELECT * FROM todos JOIN users ON nonexistent_column = users.id")
    ).rejects.toThrow();
  });

  it("should handle parameter binding errors", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    await db.query("todos").all();

    // More parameters than placeholders
    await expect(db.raw("SELECT * FROM todos WHERE id = ?", ["1", "extra"])).rejects.toThrow();
  });

  it("should handle aggregate function errors", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    await db.query("todos").all();

    // Invalid aggregate function
    await expect(db.raw("SELECT INVALID_FUNC(id) FROM todos")).rejects.toThrow();
  });
});

describe("Edge Cases and Boundary Conditions", () => {
  it("should handle empty string values correctly", async () => {
    const emptyStringSchema = {
      todos: z.object({
        id: z.string(),
        title: z.string(), // Allow empty strings
        completed: z.boolean().default(false),
      }),
    } as const;

    const db = await createSQLiteClient({
      schema: emptyStringSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    // Empty string should be allowed if schema permits
    await db.insert("todos").values({ id: "1", title: "" });

    const result = await db.query("todos").first();
    expect(result?.title).toBe("");
  });

  it("should handle NULL values in optional fields", async () => {
    const optionalSchema = {
      users: z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
        bio: z.string().nullable().optional(),
      }),
    } as const;

    const db = await createSQLiteClient({
      schema: optionalSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, bio TEXT)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "Test", email: "test@example.com" });

    const result = await db.query("users").first();
    expect(result?.bio).toBeNull();
  });

  it("should handle very long strings", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    // Generate a very long string (10,000 characters)
    const longString = "a".repeat(10000);

    await db.insert("todos").values({ id: "1", title: longString });

    const result = await db.query("todos").first();
    expect(result?.title).toBe(longString);
    expect(result?.title.length).toBe(10000);
  });

  it("should handle concurrent operations without errors", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    // Initialize database first to avoid race condition during migration
    await db.query("todos").all();

    // Now run multiple operations in parallel
    await Promise.all([
      db.insert("todos").values({ id: "1", title: "Task 1" }),
      db.insert("todos").values({ id: "2", title: "Task 2" }),
      db.insert("todos").values({ id: "3", title: "Task 3" }),
    ]);

    const result = await db.query("todos").all();
    expect(result).toHaveLength(3);
  });
});

describe("Query Builder Edge Cases", () => {
  it("should handle empty result sets gracefully", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    const result = await db.query("todos").all();
    expect(result).toEqual([]);

    const first = await db.query("todos").first();
    expect(first).toBeNull();

    const count = await db.query("todos").count();
    expect(count).toBe(0);
  });

  it("should handle queries on table with zero rows after deletions", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Task" });
    await db.delete("todos").where("id", "=", "1").execute();

    const result = await db.query("todos").all();
    expect(result).toEqual([]);
  });
});

describe("Error Recovery", () => {
  it("should allow operations after failed insert", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "Alice", email: "alice@example.com" });

    // Try to insert duplicate (will fail)
    try {
      await db.insert("users").values({ id: 2, name: "Bob", email: "alice@example.com" });
    } catch (error) {
      // Expected error
    }

    // Should be able to insert valid data after error
    await db.insert("users").values({ id: 3, name: "Charlie", email: "charlie@example.com" });

    const result = await db.query("users").all();
    expect(result).toHaveLength(2);
  });

  it("should allow operations after failed query", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    // Try invalid raw query
    try {
      await db.raw("SELECT * FROM nonexistent");
    } catch (error) {
      // Expected error
    }

    // Should be able to run valid queries after error
    await db.insert("todos").values({ id: "1", title: "Task" });
    const result = await db.query("todos").all();
    expect(result).toHaveLength(1);
  });
});

describe("Type Coercion and Data Integrity", () => {
  it("should handle number to string conversion in SQLite", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    // SQLite allows type flexibility - inserting number for text column
    await db.raw("INSERT INTO todos (id, title) VALUES (?, ?)", ["1", 12345]);

    const result = await db.query("todos").first();
    // SQLite coerces 12345 to string "12345"
    expect(result?.title).toBe("12345");
  });

  it("should preserve boolean as 0/1 consistently", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Task", completed: true });

    const result = await db.query("todos").where("completed", "=", 1).first();
    expect(result).not.toBeNull();
    expect(result?.completed).toBe(1);
  });
});
