/**
 * Browser tests for Transactions
 *
 * Tests the main transaction flows:
 * - Automatic commit on success
 * - Automatic rollback on error
 * - Rollback on validation error
 * - Atomicity (financial transfers)
 * - Queries within transactions
 * - Manual transaction control
 *
 * Run with: pnpm --filter @alexop/sqlite-core test
 */

import { describe, expect, it } from "vitest";
import { createSQLiteClient } from "../index";
import { z } from "zod";

const todoSchema = z.object({
  completed: z.boolean().default(false),
  id: z.string(),
  title: z.string().min(1),
});

const userSchema = z.object({
  email: z.string().email(),
  id: z.number(),
  name: z.string().min(1),
});

const accountSchema = z.object({
  balance: z.number().default(0),
  id: z.number(),
  userId: z.number(),
});

const testSchema = {
  accounts: accountSchema,
  todos: todoSchema,
  users: userSchema,
} as const;

describe("Transactions", () => {
  it("should auto-commit on success", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db.transaction(async (tx) => {
      await tx.insert("todos").values({ id: "1", title: "First" });
      await tx.insert("todos").values({ id: "2", title: "Second" });
      await tx.insert("todos").values({ id: "3", title: "Third" });
    });

    const result = await db.query("todos").all();
    expect(result).toHaveLength(3);
  });

  it("should auto-rollback on error", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await expect(
      db.transaction(async (tx) => {
        await tx.insert("todos").values({ id: "1", title: "First" });
        await tx.insert("todos").values({ id: "2", title: "Second" });
        throw new Error("Rollback now");
      })
    ).rejects.toThrow("Rollback now");

    const result = await db.query("todos").all();
    expect(result).toHaveLength(0);
  });

  it("should rollback on validation error", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    // Zod error format changed - just check that it throws
    await expect(
      db.transaction(async (tx) => {
        await tx.insert("todos").values({ id: "1", title: "Valid" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await tx.insert("todos").values({ id: "2", title: "" } as any); // Empty title fails validation
      })
      // eslint-disable-next-line jest/require-to-throw-message
    ).rejects.toThrow();

    const result = await db.query("todos").all();
    expect(result).toHaveLength(0);
  });

  it("should ensure atomicity for financial transfer", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `
            CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL);
            CREATE TABLE accounts (id INTEGER PRIMARY KEY, userId INTEGER NOT NULL, balance REAL DEFAULT 0);
          `,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db
      .insert("users")
      .values({ email: "alice@example.com", id: 1, name: "Alice" });
    await db
      .insert("users")
      .values({ email: "bob@example.com", id: 2, name: "Bob" });
    await db.insert("accounts").values({ balance: 1000, id: 1, userId: 1 });
    await db.insert("accounts").values({ balance: 500, id: 2, userId: 2 });

    // Successful transfer
    await db.transaction(async (tx) => {
      const sender = await tx.query("accounts").where("id", "=", 1).first();
      const receiver = await tx.query("accounts").where("id", "=", 2).first();

      if (!sender || !receiver) {
        throw new Error("Accounts not found");
      }

      const transferAmount = 200;
      await tx
        .update("accounts")
        .where("id", "=", 1)
        .set({ balance: sender.balance - transferAmount })
        .execute();
      await tx
        .update("accounts")
        .where("id", "=", 2)
        .set({ balance: receiver.balance + transferAmount })
        .execute();
    });

    const accounts = await db.query("accounts").all();
    expect(accounts[0].balance).toBe(800);
    expect(accounts[1].balance).toBe(700);
  });

  it("should query within transaction", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    await db.insert("todos").values({ id: "1", title: "Existing" });

    await db.transaction(async (tx) => {
      const existing = await tx.query("todos").where("id", "=", "1").first();
      expect(existing?.title).toBe("Existing");

      await tx.insert("todos").values({ id: "2", title: "New" });

      const all = await tx.query("todos").all();
      expect(all).toHaveLength(2);

      const count = await tx.query("todos").count();
      expect(count).toBe(2);
    });
  });

  it("should support manual begin/commit", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    const tx = await db.beginTransaction();
    await tx.insert("todos").values({ id: "1", title: "Manual" });
    await tx.commit();

    const result = await db.query("todos").all();
    expect(result).toHaveLength(1);
  });

  it("should support manual rollback", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    const tx = await db.beginTransaction();
    await tx.insert("todos").values({ id: "1", title: "Will be rolled back" });
    await tx.rollback();

    const result = await db.query("todos").all();
    expect(result).toHaveLength(0);
  });

  it("should prevent nested transactions (SQLite limitation)", async () => {
    const db = await createSQLiteClient({
      filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          sql: `CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER DEFAULT 0)`,
          version: 1,
        },
      ],
      schema: testSchema,
    });

    const tx1 = await db.beginTransaction();

    // Error message format may vary
    // eslint-disable-next-line jest/require-to-throw-message
    await expect(db.beginTransaction()).rejects.toThrow();

    await tx1.rollback();
  });
});
