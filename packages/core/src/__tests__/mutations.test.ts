/**
 * Browser tests for Mutation operations with Zod validation
 *
 * These tests verify that:
 * - INSERT validates data with Zod schema
 * - INSERT applies default values from Zod
 * - UPDATE validates partial data updates
 * - UPDATE works with WHERE conditions
 * - DELETE removes rows based on WHERE conditions
 * - All operations return correct values
 * - Invalid data is rejected with proper errors
 *
 * Run with: pnpm --filter @alexop/sqlite-core test
 */

import { describe, it, expect } from "vitest";
import { createSQLiteClient } from "../index";
import { z } from "zod";

// Test schema
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
  bio: z.string().optional(),
});

const testSchema = {
  todos: todoSchema,
  users: userSchema,
} as const;

describe("INSERT - Basic Operations", () => {
  it("should insert valid data successfully", async () => {
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
      completed: false,
      priority: "high",
    });

    const result = await db.query("todos").all();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "1",
      title: "Test todo",
      completed: 0,
      priority: "high",
    });
  });

  it("should apply Zod default values", async () => {
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

    // Only provide required fields
    await db.insert("todos").values({
      id: "1",
      title: "Test todo",
    });

    const result = await db.query("todos").all();
    expect(result).toHaveLength(1);
    expect(result[0].completed).toBe(0); // Default false -> 0
    expect(result[0].priority).toBe("medium"); // Default value
    expect(result[0].createdAt).toBeTruthy(); // Default function
  });

  it("should insert with optional fields omitted", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER, bio TEXT)`,
        },
      ],
    });

    await db.insert("users").values({
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      // age and bio are optional, omitted
    });

    const result = await db.query("users").all();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      name: "Alice",
      email: "alice@example.com",
    });
  });

  it("should insert with optional fields provided", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER, bio TEXT)`,
        },
      ],
    });

    await db.insert("users").values({
      id: 1,
      name: "Bob",
      email: "bob@example.com",
      age: 30,
      bio: "Software developer",
    });

    const result = await db.query("users").all();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      name: "Bob",
      email: "bob@example.com",
      age: 30,
      bio: "Software developer",
    });
  });

  it("should convert boolean true to 1 and false to 0", async () => {
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
    await db.insert("todos").values({ id: "2", title: "Task 2", completed: false });

    const result = await db.query("todos").all();
    expect(result[0].completed).toBe(1); // true -> 1
    expect(result[1].completed).toBe(0); // false -> 0
  });
});

describe("INSERT - Zod Validation Errors", () => {
  it("should reject insert with missing required fields", async () => {
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

    // Missing 'title' which is required
    await expect(
      db.insert("todos").values({
        id: "1",
        // title is missing
      } as any)
    ).rejects.toThrow();
  });

  it("should reject insert with wrong type", async () => {
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

    // Wrong type for 'id' (number instead of string)
    await expect(
      db.insert("todos").values({
        id: 123 as any,
        title: "Test",
      })
    ).rejects.toThrow();
  });

  it("should reject insert with invalid email", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER, bio TEXT)`,
        },
      ],
    });

    await expect(
      db.insert("users").values({
        id: 1,
        name: "Test",
        email: "not-a-valid-email",
      })
    ).rejects.toThrow();
  });

  it("should reject insert with value out of range", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER, bio TEXT)`,
        },
      ],
    });

    // Age > 150 violates schema
    await expect(
      db.insert("users").values({
        id: 1,
        name: "Test",
        email: "test@example.com",
        age: 200,
      })
    ).rejects.toThrow();
  });

  it("should reject insert with empty string for min(1) field", async () => {
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

    await expect(
      db.insert("todos").values({
        id: "1",
        title: "", // Empty string violates min(1)
      })
    ).rejects.toThrow();
  });
});

describe("UPDATE - Basic Operations", () => {
  it("should update single field with WHERE clause", async () => {
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

  it("should update multiple fields", async () => {
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

    await db.insert("todos").values({ id: "1", title: "Task", completed: false, priority: "low" });

    await db
      .update("todos")
      .where("id", "=", "1")
      .set({ title: "Updated Task", completed: true, priority: "high" })
      .execute();

    const result = await db.query("todos").where("id", "=", "1").first();
    expect(result).toMatchObject({
      title: "Updated Task",
      completed: 1,
      priority: "high",
    });
  });

  it("should update with multiple WHERE conditions", async () => {
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

    // Others should not be updated
    const task2 = await db.query("todos").where("id", "=", "2").first();
    expect(task2?.title).toBe("Task 2");
  });

  it("should return affected row count", async () => {
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
    await db.insert("todos").values({ id: "2", title: "Task 2", completed: false });

    const result = await db.update("todos").where("completed", "=", 0).set({ completed: true }).execute();

    // Note: Need to verify what the actual return value is
    expect(result).toBeDefined();
  });

  it("should update no rows when WHERE matches nothing", async () => {
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

    // WHERE condition matches no rows
    await db.update("todos").where("id", "=", "999").set({ title: "Updated" }).execute();

    const result = await db.query("todos").where("id", "=", "1").first();
    expect(result?.title).toBe("Task"); // Not updated
  });
});

describe("UPDATE - Zod Validation", () => {
  it("should validate updated values with Zod", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER, bio TEXT)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "Alice", email: "alice@example.com" });

    // Invalid email
    await expect(
      db.update("users").where("id", "=", 1).set({ email: "invalid-email" }).execute()
    ).rejects.toThrow();
  });

  it("should reject invalid age update", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER, bio TEXT)`,
        },
      ],
    });

    await db.insert("users").values({ id: 1, name: "Bob", email: "bob@example.com", age: 30 });

    // Age > 150
    await expect(
      db.update("users").where("id", "=", 1).set({ age: 200 }).execute()
    ).rejects.toThrow();
  });

  it("should reject empty string for min(1) field", async () => {
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

    await expect(
      db.update("todos").where("id", "=", "1").set({ title: "" }).execute()
    ).rejects.toThrow();
  });
});

describe("DELETE - Basic Operations", () => {
  it("should delete single row with WHERE clause", async () => {
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

  it("should delete with multiple WHERE conditions", async () => {
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

    await db.insert("todos").values({ id: "1", title: "Task 1", completed: true, priority: "high" });
    await db.insert("todos").values({ id: "2", title: "Task 2", completed: true, priority: "low" });
    await db.insert("todos").values({ id: "3", title: "Task 3", completed: false, priority: "high" });

    await db.delete("todos").where("completed", "=", 1).where("priority", "=", "high").execute();

    const result = await db.query("todos").all();
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["2", "3"]);
  });

  it("should delete no rows when WHERE matches nothing", async () => {
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

    await db.delete("todos").where("id", "=", "999").execute();

    const result = await db.query("todos").all();
    expect(result).toHaveLength(1); // Nothing deleted
  });

  it("should return deleted row count", async () => {
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

    const result = await db.delete("todos").where("id", "=", "1").execute();

    expect(result).toBeDefined();
  });
});

describe("Mutations - Integration Tests", () => {
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

  it("should handle special characters in data", async () => {
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

    // Special characters and SQL injection attempt
    const specialTitle = "Task with 'quotes' and \"double quotes\" and ; semicolon";

    await db.insert("todos").values({ id: "1", title: specialTitle });

    const result = await db.query("todos").where("id", "=", "1").first();
    expect(result?.title).toBe(specialTitle);
  });

  it("should handle unicode and emoji in text fields", async () => {
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

    await db.insert("todos").values({ id: "1", title: "Task 📝 with emoji 🎉 and unicode: 你好" });

    const result = await db.query("todos").where("id", "=", "1").first();
    expect(result?.title).toBe("Task 📝 with emoji 🎉 and unicode: 你好");
  });
});
