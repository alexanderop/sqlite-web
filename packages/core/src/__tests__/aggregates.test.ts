import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSQLiteClient } from "../index";
import { z } from "zod";

describe("Aggregation Functions", () => {
  let db: Awaited<ReturnType<typeof createSQLiteClient<typeof testSchema>>>;

  const testSchema = {
    orders: z.object({
      id: z.number(),
      userId: z.string(),
      amount: z.number(),
      status: z.string(),
      createdAt: z.string(),
    }),
  } as const;

  beforeEach(async () => {
    db = await createSQLiteClient({
      schema: testSchema,
      filename: `file:test-aggregates-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
      migrations: [
        {
          version: 1,
          sql: `CREATE TABLE orders (
            id INTEGER PRIMARY KEY,
            userId TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT NOT NULL,
            createdAt TEXT NOT NULL
          )`,
        },
      ],
    });

    // Insert test data
    await db.insert("orders").values({
      id: 1,
      userId: "user1",
      amount: 100,
      status: "completed",
      createdAt: "2024-01-01",
    });
    await db.insert("orders").values({
      id: 2,
      userId: "user1",
      amount: 200,
      status: "completed",
      createdAt: "2024-01-02",
    });
    await db.insert("orders").values({
      id: 3,
      userId: "user2",
      amount: 150,
      status: "completed",
      createdAt: "2024-01-03",
    });
    await db.insert("orders").values({
      id: 4,
      userId: "user2",
      amount: 50,
      status: "pending",
      createdAt: "2024-01-04",
    });
  });

  afterEach(async () => {
    await db.close();
  });

  describe("sum()", () => {
    it("should calculate sum of all rows (terminal operation)", async () => {
      const total = await db.query("orders").sum("amount");
      expect(total).toBe(500);
    });

    it("should calculate sum with WHERE clause", async () => {
      const total = await db
        .query("orders")
        .where("userId", "=", "user1")
        .sum("amount");
      expect(total).toBe(300);
    });

    it("should calculate sum with multiple WHERE conditions", async () => {
      const total = await db
        .query("orders")
        .where("userId", "=", "user2")
        .where("status", "=", "completed")
        .sum("amount");
      expect(total).toBe(150);
    });

    it("should return 0 for sum on empty result set", async () => {
      const total = await db
        .query("orders")
        .where("userId", "=", "nonexistent")
        .sum("amount");
      expect(total).toBe(0);
    });

    it("should work as chainable operation with alias and GROUP BY", async () => {
      const result = await db
        .query("orders")
        .select("userId")
        .sum("amount", "total")
        .groupBy("userId")
        .all();

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          { userId: "user1", total: 300 },
          { userId: "user2", total: 200 },
        ])
      );
    });
  });

  describe("avg()", () => {
    it("should calculate average of all rows (terminal operation)", async () => {
      const average = await db.query("orders").avg("amount");
      expect(average).toBe(125); // (100 + 200 + 150 + 50) / 4
    });

    it("should calculate average with WHERE clause", async () => {
      const average = await db
        .query("orders")
        .where("userId", "=", "user1")
        .avg("amount");
      expect(average).toBe(150); // (100 + 200) / 2
    });

    it("should return 0 for avg on empty result set", async () => {
      const average = await db
        .query("orders")
        .where("userId", "=", "nonexistent")
        .avg("amount");
      expect(average).toBe(0);
    });

    it("should work as chainable operation with alias and GROUP BY", async () => {
      const result = await db
        .query("orders")
        .select("userId")
        .avg("amount", "avgAmount")
        .groupBy("userId")
        .all();

      expect(result).toHaveLength(2);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user1Result = result.find((r: any) => r.userId === "user1");
      expect(user1Result?.avgAmount).toBe(150);
    });
  });

  describe("min()", () => {
    it("should find minimum value (terminal operation)", async () => {
      const min = await db.query("orders").min("amount");
      expect(min).toBe(50);
    });

    it("should find minimum with WHERE clause", async () => {
      const min = await db
        .query("orders")
        .where("status", "=", "completed")
        .min("amount");
      expect(min).toBe(100);
    });

    it("should return null for min on empty result set", async () => {
      const min = await db
        .query("orders")
        .where("userId", "=", "nonexistent")
        .min("amount");
      expect(min).toBeNull();
    });

    it("should work as chainable operation with alias and GROUP BY", async () => {
      const result = await db
        .query("orders")
        .select("userId")
        .min("amount", "minAmount")
        .groupBy("userId")
        .all();

      expect(result).toEqual(
        expect.arrayContaining([
          { userId: "user1", minAmount: 100 },
          { userId: "user2", minAmount: 50 },
        ])
      );
    });
  });

  describe("max()", () => {
    it("should find maximum value (terminal operation)", async () => {
      const max = await db.query("orders").max("amount");
      expect(max).toBe(200);
    });

    it("should find maximum with WHERE clause", async () => {
      const max = await db
        .query("orders")
        .where("userId", "=", "user2")
        .max("amount");
      expect(max).toBe(150);
    });

    it("should return null for max on empty result set", async () => {
      const max = await db
        .query("orders")
        .where("userId", "=", "nonexistent")
        .max("amount");
      expect(max).toBeNull();
    });

    it("should work as chainable operation with alias and GROUP BY", async () => {
      const result = await db
        .query("orders")
        .select("userId")
        .max("amount", "maxAmount")
        .groupBy("userId")
        .all();

      expect(result).toEqual(
        expect.arrayContaining([
          { userId: "user1", maxAmount: 200 },
          { userId: "user2", maxAmount: 150 },
        ])
      );
    });
  });

  describe("groupBy()", () => {
    it("should group by single column with aggregate", async () => {
      const result = await db
        .query("orders")
        .select("status")
        .sum("amount", "total")
        .groupBy("status")
        .all();

      expect(result).toEqual(
        expect.arrayContaining([
          { status: "completed", total: 450 },
          { status: "pending", total: 50 },
        ])
      );
    });

    it("should group by multiple columns", async () => {
      const result = await db
        .query("orders")
        .select("userId", "status")
        .sum("amount", "total")
        .groupBy("userId", "status")
        .all();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("userId");
      expect(result[0]).toHaveProperty("status");
      expect(result[0]).toHaveProperty("total");
    });

    it("should support multiple aggregates with GROUP BY", async () => {
      const result = await db
        .query("orders")
        .select("userId")
        .sum("amount", "total")
        .avg("amount", "average")
        .min("amount", "minAmount")
        .max("amount", "maxAmount")
        .groupBy("userId")
        .all();

      expect(result).toHaveLength(2);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user1 = result.find((r: any) => r.userId === "user1");
      expect(user1).toEqual({
        userId: "user1",
        total: 300,
        average: 150,
        minAmount: 100,
        maxAmount: 200,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user2 = result.find((r: any) => r.userId === "user2");
      expect(user2).toEqual({
        userId: "user2",
        total: 200,
        average: 100,
        minAmount: 50,
        maxAmount: 150,
      });
    });

    it("should support GROUP BY with WHERE clause", async () => {
      const result = await db
        .query("orders")
        .where("status", "=", "completed")
        .select("userId")
        .sum("amount", "total")
        .groupBy("userId")
        .all();

      expect(result).toEqual(
        expect.arrayContaining([
          { userId: "user1", total: 300 },
          { userId: "user2", total: 150 },
        ])
      );
    });

    it("should support GROUP BY with ORDER BY", async () => {
      const result = await db
        .query("orders")
        .select("userId")
        .sum("amount", "total")
        .groupBy("userId")
        // @ts-expect-error - orderBy doesn't know about aggregate aliases yet
        .orderBy("total", "DESC")
        .all();

      expect(result[0].userId).toBe("user1"); // user1 has total of 300
      expect(result[1].userId).toBe("user2"); // user2 has total of 200
    });
  });

  describe("Edge cases", () => {
    it("should handle aggregates on table with no rows", async () => {
      await db.exec("DELETE FROM orders");

      const sum = await db.query("orders").sum("amount");
      const avg = await db.query("orders").avg("amount");
      const min = await db.query("orders").min("amount");
      const max = await db.query("orders").max("amount");

      expect(sum).toBe(0);
      expect(avg).toBe(0);
      expect(min).toBeNull();
      expect(max).toBeNull();
    });

    it("should handle GROUP BY with empty result", async () => {
      const result = await db
        .query("orders")
        .where("userId", "=", "nonexistent")
        .select("userId")
        .sum("amount", "total")
        .groupBy("userId")
        .all();

      expect(result).toEqual([]);
    });
  });
});
