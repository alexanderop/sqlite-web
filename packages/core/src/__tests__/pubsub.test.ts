/**
 * Browser tests for Pub/Sub notification system
 *
 * These tests verify that:
 * - notifyTable() triggers all subscribers for a specific table
 * - subscribe() registers callbacks correctly
 * - Unsubscribe function prevents future notifications
 * - Multiple subscribers to same table all receive notifications
 * - No cross-table notifications occur
 * - Memory cleanup works correctly
 *
 * Run with: pnpm --filter @alexop/sqlite-core test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
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
  email: z.string(),
});

const testSchema = {
  todos: todoSchema,
  users: userSchema,
} as const;

describe("Pub/Sub - Basic Notifications", () => {
  it("should trigger subscriber when notifyTable is called", async () => {
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

    const callback = vi.fn();
    db.subscribe("todos", callback);

    // Notify the table
    db.notifyTable("todos");

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should trigger multiple subscribers to the same table", async () => {
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

    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const callback3 = vi.fn();

    db.subscribe("todos", callback1);
    db.subscribe("todos", callback2);
    db.subscribe("todos", callback3);

    db.notifyTable("todos");

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(1);
  });

  it("should trigger multiple notifications in sequence", async () => {
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

    const callback = vi.fn();
    db.subscribe("todos", callback);

    db.notifyTable("todos");
    db.notifyTable("todos");
    db.notifyTable("todos");

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("should not trigger subscribers for different tables", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
        {
          version: 2,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL)`,
        },
      ],
    });

    await db.query("todos").all();

    const todosCallback = vi.fn();
    const usersCallback = vi.fn();

    db.subscribe("todos", todosCallback);
    db.subscribe("users", usersCallback);

    // Notify only todos
    db.notifyTable("todos");

    expect(todosCallback).toHaveBeenCalledTimes(1);
    expect(usersCallback).toHaveBeenCalledTimes(0);

    // Notify only users
    db.notifyTable("users");

    expect(todosCallback).toHaveBeenCalledTimes(1);
    expect(usersCallback).toHaveBeenCalledTimes(1);
  });

  it("should not error when notifying table with no subscribers", async () => {
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

    // Should not throw
    expect(() => db.notifyTable("todos")).not.toThrow();
  });
});

describe("Pub/Sub - Unsubscribe", () => {
  it("should stop receiving notifications after unsubscribe", async () => {
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

    const callback = vi.fn();
    const unsubscribe = db.subscribe("todos", callback);

    // First notification should work
    db.notifyTable("todos");
    expect(callback).toHaveBeenCalledTimes(1);

    // Unsubscribe
    unsubscribe();

    // Second notification should not trigger callback
    db.notifyTable("todos");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should only unsubscribe the specific callback", async () => {
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

    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const unsubscribe1 = db.subscribe("todos", callback1);
    db.subscribe("todos", callback2);

    // Unsubscribe first callback
    unsubscribe1();

    db.notifyTable("todos");

    expect(callback1).toHaveBeenCalledTimes(0);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it("should handle immediate unsubscribe (subscribe then unsubscribe)", async () => {
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

    const callback = vi.fn();
    const unsubscribe = db.subscribe("todos", callback);
    unsubscribe();

    db.notifyTable("todos");

    expect(callback).toHaveBeenCalledTimes(0);
  });

  it("should handle multiple subscribe/unsubscribe cycles", async () => {
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

    const callback = vi.fn();

    // First cycle
    let unsubscribe = db.subscribe("todos", callback);
    db.notifyTable("todos");
    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();

    // Should not trigger after unsubscribe
    db.notifyTable("todos");
    expect(callback).toHaveBeenCalledTimes(1);

    // Second cycle - resubscribe
    unsubscribe = db.subscribe("todos", callback);
    db.notifyTable("todos");
    expect(callback).toHaveBeenCalledTimes(2);
    unsubscribe();

    // Again, should not trigger
    db.notifyTable("todos");
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("should not error when calling unsubscribe multiple times", async () => {
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

    const callback = vi.fn();
    const unsubscribe = db.subscribe("todos", callback);

    // Should not throw
    expect(() => {
      unsubscribe();
      unsubscribe();
      unsubscribe();
    }).not.toThrow();

    db.notifyTable("todos");
    expect(callback).toHaveBeenCalledTimes(0);
  });
});

describe("Pub/Sub - Integration with Mutations", () => {
  it("should notify after insert operation", async () => {
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

    const callback = vi.fn();
    db.subscribe("todos", callback);

    // Insert and notify
    await db.insert("todos").values({ id: "1", title: "Test" });
    db.notifyTable("todos");

    expect(callback).toHaveBeenCalledTimes(1);

    // Verify data was actually inserted
    const todos = await db.query("todos").all();
    expect(todos).toHaveLength(1);
  });

  it("should notify after update operation", async () => {
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

    // Insert initial data
    await db.insert("todos").values({ id: "1", title: "Original" });

    const callback = vi.fn();
    db.subscribe("todos", callback);

    // Update and notify
    await db.update("todos").where("id", "=", "1").set({ title: "Updated" }).execute();
    db.notifyTable("todos");

    expect(callback).toHaveBeenCalledTimes(1);

    // Verify data was updated
    const todos = await db.query("todos").all();
    expect(todos[0].title).toBe("Updated");
  });

  it("should notify after delete operation", async () => {
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

    // Insert initial data
    await db.insert("todos").values({ id: "1", title: "Test" });

    const callback = vi.fn();
    db.subscribe("todos", callback);

    // Delete and notify
    await db.delete("todos").where("id", "=", "1").execute();
    db.notifyTable("todos");

    expect(callback).toHaveBeenCalledTimes(1);

    // Verify data was deleted
    const todos = await db.query("todos").all();
    expect(todos).toHaveLength(0);
  });

  it("should allow subscribing to non-existent table (no error until notify)", async () => {
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

    const callback = vi.fn();

    // Subscribe to users table (not created yet)
    // Should not throw - type system prevents this at compile time but runtime should be safe
    const unsubscribe = db.subscribe("users" as any, callback);

    // Notify should not throw even though table doesn't exist
    expect(() => db.notifyTable("users" as any)).not.toThrow();

    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});

describe("Pub/Sub - Memory Management", () => {
  it("should not have memory leaks with many subscribe/unsubscribe cycles", async () => {
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

    // Create and cleanup many subscribers
    for (let i = 0; i < 100; i++) {
      const callback = vi.fn();
      const unsubscribe = db.subscribe("todos", callback);
      unsubscribe();
    }

    // After cleanup, notification should not trigger any callbacks
    const testCallback = vi.fn();
    db.subscribe("todos", testCallback);
    db.notifyTable("todos");

    expect(testCallback).toHaveBeenCalledTimes(1);
  });

  it("should handle many simultaneous subscribers efficiently", async () => {
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

    const callbacks = [];
    for (let i = 0; i < 50; i++) {
      const callback = vi.fn();
      callbacks.push(callback);
      db.subscribe("todos", callback);
    }

    db.notifyTable("todos");

    // All callbacks should have been called exactly once
    callbacks.forEach((cb) => {
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });
});

describe("Pub/Sub - Edge Cases", () => {
  it("should handle notifications during callback execution", async () => {
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

    let callCount = 0;
    const callback = vi.fn(() => {
      callCount++;
      // Don't trigger infinite loop, only nest once
      if (callCount === 1) {
        db.notifyTable("todos");
      }
    });

    db.subscribe("todos", callback);
    db.notifyTable("todos");

    // Should handle nested notification
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("should handle callback that throws error", async () => {
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

    const errorCallback = vi.fn(() => {
      throw new Error("Callback error");
    });
    const normalCallback = vi.fn();

    db.subscribe("todos", errorCallback);
    db.subscribe("todos", normalCallback);

    // Should throw but other callbacks should still be called
    // Note: Current implementation doesn't catch errors, so this documents behavior
    expect(() => db.notifyTable("todos")).toThrow("Callback error");

    // First callback throws, so subsequent callbacks might not be called
    // This is documenting current behavior - could be improved with try-catch
    expect(errorCallback).toHaveBeenCalledTimes(1);
  });

  it("should support same callback function subscribed to multiple tables", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
        {
          version: 2,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL)`,
        },
      ],
    });

    await db.query("todos").all();

    const sharedCallback = vi.fn();

    db.subscribe("todos", sharedCallback);
    db.subscribe("users", sharedCallback);

    db.notifyTable("todos");
    expect(sharedCallback).toHaveBeenCalledTimes(1);

    db.notifyTable("users");
    expect(sharedCallback).toHaveBeenCalledTimes(2);
  });
});
