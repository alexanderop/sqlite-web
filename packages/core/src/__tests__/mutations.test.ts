/**
 * Browser tests for Mutations (INSERT, UPDATE, DELETE)
 *
 * Tests the main mutation flows:
 * - INSERT with defaults and validation
 * - UPDATE with WHERE and validation
 * - DELETE with WHERE
 * - Constraint violations
 * - Full CRUD workflow
 *
 * Run with: pnpm --filter @alexop/sqlite-core test
 */

import { describe, it, expect } from "vitest";
import { createSQLiteClient } from "../index";
import { z } from "zod";

const todoSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  completed: z.boolean().default(false),
  priority: z.string().default("medium"),
  createdAt: z.string().default(() => new Date().toISOString()),
});

const userSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).max(150).optional(),
});

const testSchema = {
  todos: todoSchema,
  users: userSchema,
} as const;

describe("Mutations", () => {
  it("should insert with default values", async () => {
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

    await db.insert("todos").values({
      id: "1",
      title: "Test todo",
      // completed, priority, createdAt use defaults
    });

    const result = await db.query("todos").all();
    expect(result).toHaveLength(1);
    expect(result[0].completed).toBe(0);
    expect(result[0].priority).toBe("medium");
    expect(result[0].createdAt).toBeTruthy();
  });

  it("should reject insert with validation error", async () => {
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

    // Invalid email
    await expect(
      db.insert("users").values({
        id: 1,
        name: "Test",
        email: "not-an-email",
      })
    ).rejects.toThrow();
  });

  it("should update single field with WHERE", async () => {
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

    await db.insert("todos").values({ id: "1", title: "Original title" });

    await db.update("todos").where("id", "=", "1").set({ title: "Updated title" }).execute();

    const result = await db.query("todos").where("id", "=", "1").first();
    expect(result?.title).toBe("Updated title");
  });

  it("should update multiple fields with multiple WHERE", async () => {
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

    await db
      .update("todos")
      .where("completed", "=", 0)
      .where("priority", "=", "high")
      .set({ title: "Updated" })
      .execute();

    const updated = await db.query("todos").where("title", "=", "Updated").all();
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe("1");

    const task2 = await db.query("todos").where("id", "=", "2").first();
    expect(task2?.title).toBe("Task 2");
  });

  it("should reject update with validation error", async () => {
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

    await db.insert("users").values({ id: 1, name: "Alice", email: "alice@example.com" });

    // Invalid email
    await expect(
      db.update("users").where("id", "=", 1).set({ email: "invalid-email" }).execute()
    ).rejects.toThrow();
  });

  it("should delete single row with WHERE", async () => {
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

    await db.delete("todos").where("id", "=", "1").execute();

    const result = await db.query("todos").all();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should delete multiple rows matching WHERE", async () => {
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

    await db.insert("todos").values({ id: "1", title: "Task 1", completed: true });
    await db.insert("todos").values({ id: "2", title: "Task 2", completed: true });
    await db.insert("todos").values({ id: "3", title: "Task 3", completed: false });

    await db.delete("todos").where("completed", "=", 1).execute();

    const result = await db.query("todos").all();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("should handle constraint violation on duplicate key", async () => {
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

    // Duplicate primary key
    await expect(db.insert("todos").values({ id: "1", title: "Duplicate" })).rejects.toThrow();
  });

  it("should notify table after mutation", async () => {
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

    let notified = false;
    db.subscribe("todos", () => {
      notified = true;
    });

    await db.insert("todos").values({ id: "1", title: "Test" });
    db.notifyTable("todos");

    expect(notified).toBe(true);
  });

  it("should handle full CRUD workflow", async () => {
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

    // Create
    await db.insert("todos").values({ id: "1", title: "Initial task", completed: false });

    let result = await db.query("todos").all();
    expect(result).toHaveLength(1);

    // Read
    const todo = await db.query("todos").where("id", "=", "1").first();
    expect(todo?.title).toBe("Initial task");

    // Update
    await db.update("todos").where("id", "=", "1").set({ title: "Updated task", completed: true }).execute();

    const updated = await db.query("todos").where("id", "=", "1").first();
    expect(updated?.title).toBe("Updated task");
    expect(updated?.completed).toBe(1);

    // Delete
    await db.delete("todos").where("id", "=", "1").execute();

    result = await db.query("todos").all();
    expect(result).toHaveLength(0);
  });
});
