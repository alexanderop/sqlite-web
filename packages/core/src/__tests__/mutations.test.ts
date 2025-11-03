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

import { describe, expect, it } from "vitest";
import { createSQLiteClient } from "../index";
import { z } from "zod";

const todoSchema = z.object({
  completed: z.boolean().default(false), createdAt: z.string().default(() => new Date().toISOString()), id: z.string(), priority: z.string().default("medium"), title: z.string().min(1),
});

const userSchema = z.object({
  age: z.number().min(0).max(150).optional(), email: z.string().email(), id: z.number(), name: z.string().min(1),
});

const testSchema = {
  todos: todoSchema,
  users: userSchema,
} as const;

describe("Mutations", () => {
  it("should insert with default values", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
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
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER)`, version: 1,
        },
      ], schema: testSchema,
    });

    // Invalid email
    await expect(
      db.insert("users").values({
        email: "not-an-email", id: 1, name: "Test",
      })
    ).rejects.toThrow("Invalid email");
  });

  it("should update single field with WHERE", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
    });

    await db.insert("todos").values({ id: "1", title: "Original title" });

    await db.update("todos").where("id", "=", "1").set({ title: "Updated title" }).execute();

    const result = await db.query("todos").where("id", "=", "1").first();
    expect(result?.title).toBe("Updated title");
  });

  it("should update multiple fields with multiple WHERE", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
    });

    await db.insert("todos").values({ completed: false, id: "1", priority: "high", title: "Task 1" });
    await db.insert("todos").values({ completed: false, id: "2", priority: "low", title: "Task 2" });
    await db.insert("todos").values({ completed: true, id: "3", priority: "high", title: "Task 3" });

    await db
      .update("todos")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where("completed", "=", 0 as any)
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
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER)`, version: 1,
        },
      ], schema: testSchema,
    });

    await db.insert("users").values({ email: "alice@example.com", id: 1, name: "Alice" });

    // Invalid email
    await expect(
      db.update("users").where("id", "=", 1).set({ email: "invalid-email" }).execute()
    ).rejects.toThrow("Invalid email");
  });

  it("should delete single row with WHERE", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
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
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
    });

    await db.insert("todos").values({ completed: true, id: "1", title: "Task 1" });
    await db.insert("todos").values({ completed: true, id: "2", title: "Task 2" });
    await db.insert("todos").values({ completed: false, id: "3", title: "Task 3" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.delete("todos").where("completed", "=", 1 as any).execute();

    const result = await db.query("todos").all();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("should handle constraint violation on duplicate key", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
    });

    await db.insert("todos").values({ id: "1", title: "First" });

    // Duplicate primary key - error message varies by browser
    // eslint-disable-next-line jest/require-to-throw-message
    await expect(db.insert("todos").values({ id: "1", title: "Duplicate" })).rejects.toThrow();
  });

  it("should notify table after mutation", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
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
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
    });

    // Create
    await db.insert("todos").values({ completed: false, id: "1", title: "Initial task" });

    let result = await db.query("todos").all();
    expect(result).toHaveLength(1);

    // Read
    const todo = await db.query("todos").where("id", "=", "1").first();
    expect(todo?.title).toBe("Initial task");

    // Update
    await db.update("todos").where("id", "=", "1").set({ completed: true, title: "Updated task" }).execute();

    const updated = await db.query("todos").where("id", "=", "1").first();
    expect(updated?.title).toBe("Updated task");
    expect(updated?.completed).toBe(1);

    // Delete
    await db.delete("todos").where("id", "=", "1").execute();

    result = await db.query("todos").all();
    expect(result).toHaveLength(0);
  });
});
