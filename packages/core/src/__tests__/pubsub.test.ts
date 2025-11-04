/**
 * Browser tests for Pub/Sub notification system
 *
 * Tests the main pub/sub flows:
 * - Single subscriber notification
 * - Multiple subscribers to same table
 * - Unsubscribe functionality
 * - Table isolation (no cross-table notifications)
 *
 * Run with: pnpm --filter @alexop/sqlite-core test
 */

import { describe, expect, it } from "vitest";
import { createSQLiteClient } from "../index";

describe("Pub/Sub", () => {
  it("should notify single subscriber", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    let notifyCount = 0;
    db.subscribe("todos", () => {
      notifyCount++;
    });

    db.notifyTable("todos");
    expect(notifyCount).toBe(1);

    db.notifyTable("todos");
    expect(notifyCount).toBe(2);

    await db.close();
  });

  it("should notify multiple subscribers", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    let count1 = 0;
    let count2 = 0;
    let count3 = 0;

    db.subscribe("todos", () => {
      count1++;
    });
    db.subscribe("todos", () => {
      count2++;
    });
    db.subscribe("todos", () => {
      count3++;
    });

    db.notifyTable("todos");

    expect(count1).toBe(1);
    expect(count2).toBe(1);
    expect(count3).toBe(1);

    await db.close();
  });

  it("should unsubscribe correctly", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    let count = 0;
    const unsubscribe = db.subscribe("todos", () => {
      count++;
    });

    db.notifyTable("todos");
    expect(count).toBe(1);

    unsubscribe();

    db.notifyTable("todos");
    expect(count).toBe(1); // Still 1, not incremented

    await db.close();
  });

  it("should isolate notifications by table", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `
            CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0);
            CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL);
          `,
        },
      ],
    });

    let todosCount = 0;
    let usersCount = 0;

    db.subscribe("todos", () => {
      todosCount++;
    });
    db.subscribe("users", () => {
      usersCount++;
    });

    db.notifyTable("todos");
    expect(todosCount).toBe(1);
    expect(usersCount).toBe(0);

    db.notifyTable("users");
    expect(todosCount).toBe(1);
    expect(usersCount).toBe(1);

    await db.close();
  });

  it("should handle notify with no subscribers", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    // Should not throw
    expect(() => db.notifyTable("todos")).not.toThrow();

    await db.close();
  });

  it("should unsubscribe multiple subscribers independently", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    let count1 = 0;
    let count2 = 0;

    const unsub1 = db.subscribe("todos", () => {
      count1++;
    });
    db.subscribe("todos", () => {
      count2++;
    });

    db.notifyTable("todos");
    expect(count1).toBe(1);
    expect(count2).toBe(1);

    unsub1();

    db.notifyTable("todos");
    expect(count1).toBe(1); // Still 1
    expect(count2).toBe(2); // Incremented

    await db.close();
  });
});
