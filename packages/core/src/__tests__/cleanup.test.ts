/**
 * Browser tests for Database Cleanup (close and isClosed)
 *
 * Tests resource management:
 * - close() properly terminates worker and releases resources
 * - isClosed() accurately reports database state
 * - Operations fail gracefully after close
 * - Multiple close() calls are safe (idempotent)
 *
 * Run with: pnpm --filter @alexop/sqlite-core test
 */

import { describe, expect, it } from "vitest";
import { createSQLiteClient } from "../index";

describe("Database Cleanup", () => {
  it("should report not closed initially", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    expect(db.isClosed()).toBe(false);
    await db.close();
  });

  it("should close database and report closed state", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    await db.close();
    expect(db.isClosed()).toBe(true);
  });

  it("should fail to exec after close", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    await db.close();

    await expect(db.exec("SELECT * FROM todos")).rejects.toThrow(
      "Database is closed"
    );
  });

  it("should fail to query after close", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    await db.close();

    await expect(db.raw("SELECT * FROM todos")).rejects.toThrow(
      "Database is closed"
    );
  });

  it("should handle multiple close calls safely (idempotent)", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    await db.close();
    await db.close(); // Should not throw
    await db.close(); // Should not throw

    expect(db.isClosed()).toBe(true);
  });

  it("should work normally before close", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
        },
      ],
    });

    // Insert should work
    await db.exec("INSERT INTO todos (id, title) VALUES (?, ?)", ["1", "Test task"]);

    // Query should work
    const todos = await db.raw<{ id: string; title: string }>("SELECT * FROM todos");
    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe("Test task");

    // Then close
    await db.close();
    expect(db.isClosed()).toBe(true);
  });
});
