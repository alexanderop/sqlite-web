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
  completed: z.boolean().default(false),
  createdAt: z.string().default(() => new Date().toISOString()),
  id: z.string(),
  priority: z.string().default("medium"),
  title: z.string(),
});

const testSchema = {
  todos: todoSchema,
} as const;

describe("Query Builder", () => {
  it("should filter with basic WHERE clause", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db
      .insert("todos")
      .values({ completed: false, id: "1", title: "First" });
    await db
      .insert("todos")
      .values({ completed: true, id: "2", title: "Second" });
    await db
      .insert("todos")
      .values({ completed: false, id: "3", title: "Third" });

    const result = await db.query("todos").where("completed", "=", false).all();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("1");
    expect(result[1].id).toBe("3");
  });

  it("should chain multiple WHERE conditions", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db
      .insert("todos")
      .values({ completed: false, id: "1", priority: "high", title: "Task 1" });
    await db
      .insert("todos")
      .values({ completed: false, id: "2", priority: "low", title: "Task 2" });
    await db
      .insert("todos")
      .values({ completed: true, id: "3", priority: "high", title: "Task 3" });

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
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db
      .insert("todos")
      .values({ id: "1", priority: "high", title: "First" });
    await db
      .insert("todos")
      .values({ id: "2", priority: "medium", title: "Second" });
    await db
      .insert("todos")
      .values({ id: "3", priority: "low", title: "Third" });

    const result = await db
      .query("todos")
      .where("priority", "IN", ["high", "low"])
      .all();

    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.id);
    // eslint-disable-next-line unicorn/no-array-sort
    expect(ids.sort()).toEqual(["1", "3"]);
  });

  it("should sort with ORDER BY", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: testSchema,
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
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db.insert("todos").values({ id: "1", title: "First" });
    await db.insert("todos").values({ id: "2", title: "Second" });
    await db.insert("todos").values({ id: "3", title: "Third" });
    await db.insert("todos").values({ id: "4", title: "Fourth" });

    const page1 = await db.query("todos").orderBy("id", "ASC").limit(2).all();
    expect(page1).toHaveLength(2);
    expect(page1[0].id).toBe("1");

    const page2 = await db
      .query("todos")
      .orderBy("id", "ASC")
      .limit(2)
      .skip(2)
      .all();
    expect(page2).toHaveLength(2);
    expect(page2[0].id).toBe("3");
  });

  it("should project with SELECT", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db
      .insert("todos")
      .values({ completed: false, id: "1", priority: "high", title: "Task" });

    const result = await db.query("todos").select("id", "title").all();

    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("title");
    expect(result[0]).not.toHaveProperty("completed");
    expect(result[0]).not.toHaveProperty("priority");
  });

  it("should return single result with first()", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: testSchema,
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
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db
      .insert("todos")
      .values({ completed: false, id: "1", title: "First" });
    await db
      .insert("todos")
      .values({ completed: true, id: "2", title: "Second" });
    await db
      .insert("todos")
      .values({ completed: false, id: "3", title: "Third" });

    const total = await db.query("todos").count();
    expect(total).toBe(3);

    const completedCount = await db
      .query("todos")
      .where("completed", "=", true)
      .count();
    expect(completedCount).toBe(1);
  });

  it("should filter with OR conditions using orWhere", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db
      .insert("todos")
      .values({ completed: false, id: "1", priority: "low", title: "Task 1" });
    await db.insert("todos").values({
      completed: true,
      id: "2",
      priority: "medium",
      title: "Task 2",
    });
    await db
      .insert("todos")
      .values({ completed: false, id: "3", priority: "high", title: "Task 3" });

    const result = await db
      .query("todos")
      .where("completed", "=", true)
      .orWhere("priority", "=", "high")
      .all();

    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.id);
    // eslint-disable-next-line unicorn/no-array-sort
    expect(ids.sort()).toEqual(["2", "3"]);
  });

  it("should filter with NOT IN operator", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db
      .insert("todos")
      .values({ id: "1", priority: "high", title: "First" });
    await db
      .insert("todos")
      .values({ id: "2", priority: "medium", title: "Second" });
    await db
      .insert("todos")
      .values({ id: "3", priority: "low", title: "Third" });

    const result = await db
      .query("todos")
      .where("priority", "NOT IN", ["high", "low"])
      .all();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should filter with LIKE operator", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db.insert("todos").values({ id: "1", title: "Fix bug" });
    await db.insert("todos").values({ id: "2", title: "Review PR" });
    await db.insert("todos").values({ id: "3", title: "urgent task" });

    const result = await db
      .query("todos")
      .where("title", "LIKE", "%urgent%")
      .all();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("should filter with IS NULL operator", async () => {
    const schemaWithDeletedAt = {
      todos: z.object({
        completed: z.boolean().default(false),
        createdAt: z.string().default(() => new Date().toISOString()),
        deletedAt: z.string().nullable().optional(),
        id: z.string(),
        priority: z.string().default("medium"),
        title: z.string(),
      }),
    } as const;

    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', deletedAt TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: schemaWithDeletedAt,
    });

    await db.insert("todos").values({ id: "1", title: "Active" });
    await db.raw("INSERT INTO todos (id, title, deletedAt) VALUES (?, ?, ?)", [
      "2",
      "Deleted",
      "2025-01-01",
    ]);

    const result = await db
      .query("todos")
      .where("deletedAt", "IS NULL", null)
      .all();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should filter with IS NOT NULL operator", async () => {
    const schemaWithDeletedAt = {
      todos: z.object({
        completed: z.boolean().default(false),
        createdAt: z.string().default(() => new Date().toISOString()),
        deletedAt: z.string().nullable().optional(),
        id: z.string(),
        priority: z.string().default("medium"),
        title: z.string(),
      }),
    } as const;

    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', deletedAt TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: schemaWithDeletedAt,
    });

    await db.insert("todos").values({ id: "1", title: "Active" });
    await db.raw("INSERT INTO todos (id, title, deletedAt) VALUES (?, ?, ?)", [
      "2",
      "Deleted",
      "2025-01-01",
    ]);

    const result = await db
      .query("todos")
      .where("deletedAt", "IS NOT NULL", null)
      .all();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should filter with BETWEEN operator", async () => {
    const schemaWithScore = {
      todos: z.object({
        completed: z.boolean().default(false),
        createdAt: z.string().default(() => new Date().toISOString()),
        id: z.string(),
        priority: z.string().default("medium"),
        score: z.number().default(0),
        title: z.string(),
      }),
    } as const;

    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', score INTEGER DEFAULT 0, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: schemaWithScore,
    });

    await db.raw("INSERT INTO todos (id, title, score) VALUES (?, ?, ?)", [
      "1",
      "Low",
      5,
    ]);
    await db.raw("INSERT INTO todos (id, title, score) VALUES (?, ?, ?)", [
      "2",
      "Mid",
      50,
    ]);
    await db.raw("INSERT INTO todos (id, title, score) VALUES (?, ?, ?)", [
      "3",
      "High",
      95,
    ]);

    const result = await db
      .query("todos")
      .where("score", "BETWEEN", [10, 80])
      .all();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should support complex AND/OR grouping with callback", async () => {
    const schemaWithUserId = {
      todos: z.object({
        completed: z.boolean().default(false),
        createdAt: z.string().default(() => new Date().toISOString()),
        id: z.string(),
        priority: z.string().default("medium"),
        title: z.string(),
        userId: z.string(),
      }),
    } as const;

    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', userId TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: schemaWithUserId,
    });

    await db.raw(
      "INSERT INTO todos (id, title, completed, priority, userId) VALUES (?, ?, ?, ?, ?)",
      ["1", "Task 1", 0, "low", "user1"]
    );
    await db.raw(
      "INSERT INTO todos (id, title, completed, priority, userId) VALUES (?, ?, ?, ?, ?)",
      ["2", "Task 2", 1, "medium", "user1"]
    );
    await db.raw(
      "INSERT INTO todos (id, title, completed, priority, userId) VALUES (?, ?, ?, ?, ?)",
      ["3", "Task 3", 0, "high", "user1"]
    );
    await db.raw(
      "INSERT INTO todos (id, title, completed, priority, userId) VALUES (?, ?, ?, ?, ?)",
      ["4", "Task 4", 0, "low", "user2"]
    );

    // Query: WHERE (completed = 1 OR priority = 'high') AND userId = 'user1'
    const result = await db
      .query("todos")
      .where((qb) =>
        qb.where("completed", "=", true).orWhere("priority", "=", "high")
      )
      .where("userId", "=", "user1")
      .all();

    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.id);
    // eslint-disable-next-line unicorn/no-array-sort
    expect(ids.sort()).toEqual(["2", "3"]);
  });

  it("should maintain immutability - query builder reuse", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db
      .insert("todos")
      .values({ completed: false, id: "1", priority: "low", title: "Cheap" });
    await db
      .insert("todos")
      .values({ completed: false, id: "2", priority: "medium", title: "Mid" });
    await db.insert("todos").values({
      completed: false,
      id: "3",
      priority: "high",
      title: "Expensive",
    });
    await db
      .insert("todos")
      .values({ completed: true, id: "4", priority: "low", title: "Done" });

    // Create base query
    const baseQuery = db.query("todos").where("completed", "=", false);

    // Branch 1: Filter by low priority
    const lowPriority = await baseQuery.where("priority", "=", "low").all();
    expect(lowPriority).toHaveLength(1);
    expect(lowPriority[0].id).toBe("1");

    // Branch 2: Filter by high priority (baseQuery should be unchanged)
    const highPriority = await baseQuery.where("priority", "=", "high").all();
    expect(highPriority).toHaveLength(1);
    expect(highPriority[0].id).toBe("3");

    // Original base query should still work with just completed filter
    const allIncomplete = await baseQuery.all();
    expect(allIncomplete).toHaveLength(3);
  });

  it("should maintain immutability - method chaining does not mutate", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db
      .insert("todos")
      .values({ completed: false, id: "1", priority: "low", title: "Task 1" });
    await db.insert("todos").values({
      completed: false,
      id: "2",
      priority: "medium",
      title: "Task 2",
    });
    await db
      .insert("todos")
      .values({ completed: false, id: "3", priority: "high", title: "Task 3" });

    const query1 = db.query("todos");
    const query2 = query1.where("priority", "=", "low");
    const query3 = query2.orderBy("title", "DESC");
    const query4 = query3.limit(1);

    // query1 should still return all rows
    const result1 = await query1.all();
    expect(result1).toHaveLength(3);

    // query2 should return only low priority (no order or limit)
    const result2 = await query2.all();
    expect(result2).toHaveLength(1);
    expect(result2[0].priority).toBe("low");

    // query3 should have where + orderBy (no limit)
    const result3 = await query3.all();
    expect(result3).toHaveLength(1);

    // query4 should have all modifications
    const result4 = await query4.all();
    expect(result4).toHaveLength(1);
    expect(result4[0].priority).toBe("low");
  });

  it("should maintain immutability - first() does not mutate limit", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0, priority TEXT DEFAULT 'medium', createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db
      .insert("todos")
      .values({ completed: false, id: "1", title: "Task 1" });
    await db
      .insert("todos")
      .values({ completed: false, id: "2", title: "Task 2" });
    await db
      .insert("todos")
      .values({ completed: false, id: "3", title: "Task 3" });

    const query = db.query("todos");

    // Call first() - this internally sets limit to 1
    const firstResult = await query.first();
    expect(firstResult).not.toBeNull();

    // Calling all() after first() should still return all rows (query should be unchanged)
    const allResults = await query.all();
    expect(allResults).toHaveLength(3);
  });
});
