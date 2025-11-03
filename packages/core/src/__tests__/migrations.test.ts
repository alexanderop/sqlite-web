/**
 * Browser tests for Migration system
 *
 * Tests the main migration flows:
 * - Run pending migrations
 * - Skip already applied migrations
 * - Track migration versions
 * - Handle multiple migrations
 * - Fresh database initialization
 *
 * Run with: pnpm --filter @alexop/sqlite-core test
 */

import { describe, it, expect } from "vitest";
import { createSQLiteClient } from "../index";
import { z } from "zod";

const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
});

const testSchema = {
  todos: todoSchema,
} as const;

describe("Migrations", () => {
  it("should run pending migrations", async () => {
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

    await db.insert("todos").values({ id: "1", title: "Test" });
    const result = await db.query("todos").all();
    expect(result).toHaveLength(1);
  });

  it("should skip already applied migrations", async () => {
    const filename = `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`;

    // First client - apply migration
    const db1 = await createSQLiteClient({
      schema: testSchema,
      filename,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL)`,
        },
      ],
    });

    await db1.insert("todos").values({ id: "1", title: "First" });

    // Second client - should skip migration
    const db2 = await createSQLiteClient({
      schema: testSchema,
      filename,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL)`,
        },
      ],
    });

    const result = await db2.query("todos").all();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("First");
  });

  it("should track migration versions in __migrations__ table", async () => {
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

    const migrations = await db.raw<{ version: number }>("SELECT version FROM __migrations__");
    expect(migrations).toHaveLength(1);
    expect(migrations[0].version).toBe(1);
  });

  it("should handle multiple migrations in order", async () => {
    const filename = `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`;

    // Apply first migration
    const db1 = await createSQLiteClient({
      schema: testSchema,
      filename,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL)`,
        },
      ],
    });

    await db1.insert("todos").values({ id: "1", title: "Test" });

    // Apply second migration
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
          sql: `ALTER TABLE todos ADD COLUMN completed INTEGER DEFAULT 0`,
        },
      ],
    });

    const migrations = await db2.raw<{ version: number }>("SELECT version FROM __migrations__ ORDER BY version");
    expect(migrations).toHaveLength(2);
    expect(migrations[0].version).toBe(1);
    expect(migrations[1].version).toBe(2);
  });

  it("should handle migrations with unsorted versions", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 3,
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL)`,
        },
        {
          version: 1,
          sql: `CREATE TABLE users (id INTEGER PRIMARY KEY)`,
        },
        {
          version: 2,
          sql: `CREATE TABLE posts (id INTEGER PRIMARY KEY)`,
        },
      ],
    });

    // Should apply in order: 1, 2, 3
    const migrations = await db.raw<{ version: number }>("SELECT version FROM __migrations__ ORDER BY version");
    expect(migrations).toHaveLength(3);
    expect(migrations[0].version).toBe(1);
    expect(migrations[1].version).toBe(2);
    expect(migrations[2].version).toBe(3);
  });

  it("should start fresh database with no applied migrations", async () => {
    const db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [],
    });

    // Should not error even with no migrations
    await db.exec("SELECT 1");
  });
});
