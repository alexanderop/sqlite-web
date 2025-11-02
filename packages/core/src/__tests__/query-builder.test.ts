/**
 * Browser tests for Query Builder runtime behavior
 *
 * These tests verify that:
 * - WHERE clause with all operators (=, !=, <, >, <=, >=, LIKE, IN, NOT IN)
 * - Multiple WHERE conditions can be chained
 * - ORDER BY with ASC/DESC directions
 * - LIMIT and SKIP for pagination
 * - SELECT projection returns only selected fields
 * - first() returns single row or null
 * - count() returns correct count
 * - Complex query combinations work correctly
 *
 * Run with: pnpm --filter @alexop/sqlite-core test
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createSQLiteClient } from "../index";
import { z } from "zod";

// Test schema
const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean().default(false),
  priority: z.string().default("medium"),
  createdAt: z.string().default(() => new Date().toISOString()),
});

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  age: z.number().optional(),
});

const testSchema = {
  todos: todoSchema,
  users: userSchema,
} as const;

describe("Query Builder - WHERE Operators", () => {
  it("should filter with = operator", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "First" });
    await db.insert("todos").values({ id: "2", title: "Second" });

    const result = await db.query("todos").where("id", "=", "1").all();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(result[0].title).toBe("First");
  });

  it("should filter with != operator", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "First", completed: false });
    await db.insert("todos").values({ id: "2", title: "Second", completed: true });
    await db.insert("todos").values({ id: "3", title: "Third", completed: false });

    const result = await db.query("todos").where("completed", "!=", 0).all();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should filter with > operator", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "Alice", email: "alice@example.com", age: 25 });
    await db.insert("users").values({ id: 2, name: "Bob", email: "bob@example.com", age: 30 });
    await db.insert("users").values({ id: 3, name: "Charlie", email: "charlie@example.com", age: 35 });

    const result = await db.query("users").where("age", ">", 28).all();

    expect(result).toHaveLength(2);
    expect(result.map((u) => u.name)).toEqual(["Bob", "Charlie"]);
  });

  it("should filter with < operator", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "Alice", email: "alice@example.com", age: 25 });
    await db.insert("users").values({ id: 2, name: "Bob", email: "bob@example.com", age: 30 });

    const result = await db.query("users").where("age", "<", 28).all();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice");
  });

  it("should filter with >= operator", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "Alice", email: "alice@example.com", age: 25 });
    await db.insert("users").values({ id: 2, name: "Bob", email: "bob@example.com", age: 30 });
    await db.insert("users").values({ id: 3, name: "Charlie", email: "charlie@example.com", age: 30 });

    const result = await db.query("users").where("age", ">=", 30).all();

    expect(result).toHaveLength(2);
    expect(result.map((u) => u.name)).toEqual(["Bob", "Charlie"]);
  });

  it("should filter with <= operator", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "Alice", email: "alice@example.com", age: 25 });
    await db.insert("users").values({ id: 2, name: "Bob", email: "bob@example.com", age: 30 });
    await db.insert("users").values({ id: 3, name: "Charlie", email: "charlie@example.com", age: 35 });

    const result = await db.query("users").where("age", "<=", 30).all();

    expect(result).toHaveLength(2);
    expect(result.map((u) => u.name)).toEqual(["Alice", "Bob"]);
  });

  it("should filter with LIKE operator", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "URGENT: Fix bug" });
    await db.insert("todos").values({ id: "2", title: "Review code" });
    await db.insert("todos").values({ id: "3", title: "URGENT: Deploy" });

    const result = await db.query("todos").where("title", "LIKE", "%URGENT%").all();

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(["1", "3"]);
  });

  it("should filter with LIKE for case-insensitive search", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Buy groceries" });
    await db.insert("todos").values({ id: "2", title: "CALL doctor" });
    await db.insert("todos").values({ id: "3", title: "Pay bills" });

    // SQLite LIKE is case-insensitive by default
    const result = await db.query("todos").where("title", "LIKE", "%call%").all();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should chain multiple WHERE conditions (AND logic)", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Task 1", completed: false, priority: "high" });
    await db.insert("todos").values({ id: "2", title: "Task 2", completed: false, priority: "low" });
    await db.insert("todos").values({ id: "3", title: "Task 3", completed: true, priority: "high" });

    const result = await db
      .query("todos")
      .where("completed", "=", 0)
      .where("priority", "=", "high")
      .all();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });
});

describe("Query Builder - ORDER BY", () => {
  it("should order by ASC (default)", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "Charlie", email: "c@example.com" });
    await db.insert("users").values({ id: 2, name: "Alice", email: "a@example.com" });
    await db.insert("users").values({ id: 3, name: "Bob", email: "b@example.com" });

    const result = await db.query("users").orderBy("name").all();

    expect(result.map((u) => u.name)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("should order by ASC explicitly", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "Charlie", email: "c@example.com", age: 30 });
    await db.insert("users").values({ id: 2, name: "Alice", email: "a@example.com", age: 25 });
    await db.insert("users").values({ id: 3, name: "Bob", email: "b@example.com", age: 35 });

    const result = await db.query("users").orderBy("age", "ASC").all();

    expect(result.map((u) => u.age)).toEqual([25, 30, 35]);
  });

  it("should order by DESC", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "Alice", email: "a@example.com", age: 25 });
    await db.insert("users").values({ id: 2, name: "Bob", email: "b@example.com", age: 30 });
    await db.insert("users").values({ id: 3, name: "Charlie", email: "c@example.com", age: 35 });

    const result = await db.query("users").orderBy("age", "DESC").all();

    expect(result.map((u) => u.age)).toEqual([35, 30, 25]);
  });

  it("should work with WHERE and ORDER BY combined", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "Alice", email: "a@example.com", age: 25 });
    await db.insert("users").values({ id: 2, name: "Bob", email: "b@example.com", age: 30 });
    await db.insert("users").values({ id: 3, name: "Charlie", email: "c@example.com", age: 35 });
    await db.insert("users").values({ id: 4, name: "David", email: "d@example.com", age: 28 });

    const result = await db.query("users").where("age", ">", 26).orderBy("age", "DESC").all();

    expect(result).toHaveLength(3);
    expect(result.map((u) => u.name)).toEqual(["Charlie", "Bob", "David"]);
  });
});

describe("Query Builder - LIMIT and SKIP", () => {
  it("should limit results", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    for (let i = 1; i <= 10; i++) {
      await db.insert("todos").values({ id: String(i), title: `Task ${i}` });
    }

    const result = await db.query("todos").limit(5).all();

    expect(result).toHaveLength(5);
  });

  it("should skip results", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "User1", email: "u1@example.com" });
    await db.insert("users").values({ id: 2, name: "User2", email: "u2@example.com" });
    await db.insert("users").values({ id: 3, name: "User3", email: "u3@example.com" });

    // SQLite requires LIMIT when using OFFSET, use -1 for unlimited
    const result = await db.query("users").limit(-1).skip(1).all();

    expect(result).toHaveLength(2);
    expect(result.map((u) => u.id)).toEqual([2, 3]);
  });

  it("should combine LIMIT and SKIP for pagination", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    for (let i = 1; i <= 20; i++) {
      await db.insert("todos").values({ id: String(i), title: `Task ${i}` });
    }

    // Page 1: items 0-9
    const page1 = await db.query("todos").limit(10).skip(0).all();
    expect(page1).toHaveLength(10);
    expect(page1[0].id).toBe("1");

    // Page 2: items 10-19
    const page2 = await db.query("todos").limit(10).skip(10).all();
    expect(page2).toHaveLength(10);
    expect(page2[0].id).toBe("11");

    // Page 3: items 20+ (only 0 remaining)
    const page3 = await db.query("todos").limit(10).skip(20).all();
    expect(page3).toHaveLength(0);
  });

  it("should handle LIMIT 0", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Task" });

    const result = await db.query("todos").limit(0).all();

    expect(result).toHaveLength(0);
  });

  it("should handle SKIP beyond available rows", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Task 1" });
    await db.insert("todos").values({ id: "2", title: "Task 2" });

    // SQLite requires LIMIT when using OFFSET, use -1 for unlimited
    const result = await db.query("todos").limit(-1).skip(10).all();

    expect(result).toHaveLength(0);
  });
});

describe("Query Builder - SELECT Projection", () => {
  it("should return only selected fields (single field)", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Test Task", completed: false, priority: "high" });

    const result = await db.query("todos").select("title").all();

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("title", "Test Task");
    expect(result[0]).not.toHaveProperty("id");
    expect(result[0]).not.toHaveProperty("completed");
  });

  it("should return only selected fields (multiple fields)", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Test", completed: true, priority: "high" });

    const result = await db.query("todos").select("id", "title", "completed").all();

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("id", "1");
    expect(result[0]).toHaveProperty("title", "Test");
    expect(result[0]).toHaveProperty("completed", 1);
    expect(result[0]).not.toHaveProperty("priority");
  });

  it("should work with WHERE, ORDER BY, and SELECT combined", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Task A", completed: false, priority: "high" });
    await db.insert("todos").values({ id: "2", title: "Task B", completed: false, priority: "low" });
    await db.insert("todos").values({ id: "3", title: "Task C", completed: true, priority: "high" });

    const result = await db
      .query("todos")
      .select("id", "title")
      .where("completed", "=", 0)
      .orderBy("title", "DESC")
      .all();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "2", title: "Task B" });
    expect(result[1]).toEqual({ id: "1", title: "Task A" });
  });
});

describe("Query Builder - first() Method", () => {
  it("should return first row when results exist", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "First" });
    await db.insert("todos").values({ id: "2", title: "Second" });

    const result = await db.query("todos").first();

    expect(result).not.toBeNull();
    expect(result?.id).toBe("1");
  });

  it("should return null when no results", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    const result = await db.query("todos").first();

    expect(result).toBeNull();
  });

  it("should work with WHERE clause", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "First", completed: false });
    await db.insert("todos").values({ id: "2", title: "Second", completed: true });

    const result = await db.query("todos").where("completed", "=", 1).first();

    expect(result).not.toBeNull();
    expect(result?.id).toBe("2");
  });

  it("should work with ORDER BY", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "Alice", email: "a@example.com", age: 30 });
    await db.insert("users").values({ id: 2, name: "Bob", email: "b@example.com", age: 25 });

    const result = await db.query("users").orderBy("age", "ASC").first();

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Bob");
  });

  it("should work with SELECT projection", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Test", completed: false });

    const result = await db.query("todos").select("title").first();

    expect(result).not.toBeNull();
    expect(result).toEqual({ title: "Test" });
  });
});

describe("Query Builder - count() Method", () => {
  it("should return count of all rows", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Task 1" });
    await db.insert("todos").values({ id: "2", title: "Task 2" });
    await db.insert("todos").values({ id: "3", title: "Task 3" });

    const count = await db.query("todos").count();

    expect(count).toBe(3);
  });

  it("should return 0 for empty table", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    const count = await db.query("todos").count();

    expect(count).toBe(0);
  });

  it("should work with WHERE clause", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Task 1", completed: false });
    await db.insert("todos").values({ id: "2", title: "Task 2", completed: true });
    await db.insert("todos").values({ id: "3", title: "Task 3", completed: false });

    const count = await db.query("todos").where("completed", "=", 0).count();

    expect(count).toBe(2);
  });

  it("should work with multiple WHERE conditions", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Task 1", completed: false, priority: "high" });
    await db.insert("todos").values({ id: "2", title: "Task 2", completed: false, priority: "low" });
    await db.insert("todos").values({ id: "3", title: "Task 3", completed: true, priority: "high" });

    const count = await db.query("todos").where("completed", "=", 0).where("priority", "=", "high").count();

    expect(count).toBe(1);
  });
});

describe("Query Builder - Complex Query Combinations", () => {
  it("should handle complex pagination query", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    // Insert 20 tasks with zero-padded IDs for correct alphabetical ordering
    for (let i = 1; i <= 20; i++) {
      await db.insert("todos").values({
        id: String(i).padStart(2, "0"),
        title: `Task ${i}`,
        completed: i % 2 === 0,
        priority: i % 3 === 0 ? "high" : "medium",
      });
    }

    // Get page 2 of incomplete tasks, ordered by ID, 5 per page
    const result = await db
      .query("todos")
      .where("completed", "=", 0)
      .orderBy("id", "ASC")
      .limit(5)
      .skip(5)
      .all();

    expect(result).toHaveLength(5);
    expect(result[0].id).toBe("11");
    expect(result[4].id).toBe("19");
  });

  it("should handle search with pagination and sorting", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Fix urgent bug", priority: "high" });
    await db.insert("todos").values({ id: "2", title: "Review urgent PR", priority: "high" });
    await db.insert("todos").values({ id: "3", title: "Urgent: Deploy", priority: "high" });
    await db.insert("todos").values({ id: "4", title: "Regular task", priority: "medium" });

    const result = await db
      .query("todos")
      .select("id", "title", "priority")
      .where("title", "LIKE", "%urgent%")
      .orderBy("title", "ASC")
      .limit(2)
      .all();

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Fix urgent bug");
    expect(result[1].title).toBe("Review urgent PR");
    expect(result[0]).not.toHaveProperty("completed");
  });

  it("should return all rows without any filters", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
        },
      ],
    });

    await db.insert("todos").values({ id: "1", title: "Task 1" });
    await db.insert("todos").values({ id: "2", title: "Task 2" });

    const result = await db.query("todos").all();

    expect(result).toHaveLength(2);
  });
});
