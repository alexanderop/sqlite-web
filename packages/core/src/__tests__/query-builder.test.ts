/**
 * Browser tests for Query Builder
 *
 * Tests the main query builder flow:
 * - WHERE clause with basic and IN operators
 * - Multiple WHERE conditions (chaining)
 * - ORDER BY, LIMIT, SKIP
 * - SELECT projection
 * - first() and count()
 *
 * Run with: pnpm --filter @alexop/sqlite-core test
 */

import { describe, expect, it } from "vitest";
import { createSQLiteClient } from "../index";
import { z } from "zod";

const todoSchema = z.object({
  completed: z.boolean().default(false), createdAt: z.string().default(() => new Date().toISOString()), id: z.string(), priority: z.string().default("medium"), title: z.string(),
});

const testSchema = {
  todos: todoSchema,
} as const;

describe("Query Builder", () => {
  it("should filter with basic WHERE clause", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
    });

    await db.insert("todos").values({ completed: false, id: "1", title: "First" });
    await db.insert("todos").values({ completed: true, id: "2", title: "Second" });
    await db.insert("todos").values({ completed: false, id: "3", title: "Third" });

    const result = await db.query("todos").where("completed", "=", false).all();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("1");
    expect(result[1].id).toBe("3");
  });

  it("should chain multiple WHERE conditions", async () => {
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

    const result = await db
      .query("todos")
      .where("completed", "=", false)
      .where("priority", "=", "high")
      .all();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should filter with IN operator", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
    });

    await db.insert("todos").values({ id: "1", priority: "high", title: "First" });
    await db.insert("todos").values({ id: "2", priority: "medium", title: "Second" });
    await db.insert("todos").values({ id: "3", priority: "low", title: "Third" });

    const result = await db.query("todos").where("priority", "IN", ["high", "low"]).all();

    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.id);
    // eslint-disable-next-line unicorn/no-array-sort
    expect(ids.sort()).toEqual(["1", "3"]);
  });

  it("should sort with ORDER BY", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
    });

    await db.insert("todos").values({ id: "3", title: "Third" });
    await db.insert("todos").values({ id: "1", title: "First" });
    await db.insert("todos").values({ id: "2", title: "Second" });

    const asc = await db.query("todos").orderBy("id", "ASC").all();
    expect(asc.map((r) => r.id)).toEqual(["1", "2", "3"]);

    const desc = await db.query("todos").orderBy("id", "DESC").all();
    expect(desc.map((r) => r.id)).toEqual(["3", "2", "1"]);
  });

  it("should paginate with LIMIT and SKIP", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
    });

    await db.insert("todos").values({ id: "1", title: "First" });
    await db.insert("todos").values({ id: "2", title: "Second" });
    await db.insert("todos").values({ id: "3", title: "Third" });
    await db.insert("todos").values({ id: "4", title: "Fourth" });

    const page1 = await db.query("todos").orderBy("id", "ASC").limit(2).all();
    expect(page1).toHaveLength(2);
    expect(page1[0].id).toBe("1");

    const page2 = await db.query("todos").orderBy("id", "ASC").limit(2).skip(2).all();
    expect(page2).toHaveLength(2);
    expect(page2[0].id).toBe("3");
  });

  it("should project with SELECT", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
    });

    await db.insert("todos").values({ completed: false, id: "1", priority: "high", title: "Task" });

    const result = await db.query("todos").select("id", "title").all();

    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("title");
    expect(result[0]).not.toHaveProperty("completed");
    expect(result[0]).not.toHaveProperty("priority");
  });

  it("should return single result with first()", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
    });

    await db.insert("todos").values({ id: "1", title: "First" });

    const found = await db.query("todos").where("id", "=", "1").first();
    expect(found).not.toBeNull();
    expect(found?.id).toBe("1");

    const notFound = await db.query("todos").where("id", "=", "999").first();
    expect(notFound).toBeNull();
  });

  it("should count with count()", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`, version: 1,
        },
      ], schema: testSchema,
    });

    await db.insert("todos").values({ completed: false, id: "1", title: "First" });
    await db.insert("todos").values({ completed: true, id: "2", title: "Second" });
    await db.insert("todos").values({ completed: false, id: "3", title: "Third" });

    const total = await db.query("todos").count();
    expect(total).toBe(3);

    const completedCount = await db.query("todos").where("completed", "=", true).count();
    expect(completedCount).toBe(1);
  });
});
