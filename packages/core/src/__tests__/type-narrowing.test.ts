/**
 * Browser tests for Type Narrowing Methods
 *
 * Tests the type narrowing methods:
 * - $castTo: Cast query result to specific type
 * - $notNull: Remove null from nullable fields
 * - $narrowType: Narrow specific fields while keeping others
 *
 * Run with: pnpm --filter @alexop/sqlite-core test
 */

import { describe, expect, it } from "vitest";
import { createSQLiteClient } from "../index";
import { z } from "zod";

// Schema with nullable field
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  age: z.number().nullable(),
  status: z.string().default("active"),
});

const testSchema = {
  users: userSchema,
} as const;

// Custom types for type narrowing tests
interface UserWithProfile {
  id: string;
  name: string;
  email: string;
  age: number;
  status: string;
  profileUrl: string;
}

describe("Type Narrowing Methods", () => {
  describe("$castTo", () => {
    it("should cast query result to custom type at runtime", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db.insert("users").values({
        id: "1",
        name: "John",
        email: "john@example.com",
        age: 30,
      });

      // Cast to custom type (we know our data has these fields)
      const result = await db
        .query("users")
        .where("id", "=", "1")
        .$castTo<UserWithProfile>()
        .first();

      // Runtime test - the data structure remains the same
      expect(result).not.toBeNull();
      expect(result?.id).toBe("1");
      expect(result?.name).toBe("John");
      expect(result?.email).toBe("john@example.com");
      expect(result?.age).toBe(30);
    });

    it("should work with all() method", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db
        .insert("users")
        .values({ id: "1", name: "John", email: "john@example.com", age: 30 });
      await db
        .insert("users")
        .values({ id: "2", name: "Jane", email: "jane@example.com", age: 25 });

      const results = await db.query("users").$castTo<UserWithProfile>().all();

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("1");
      expect(results[1].id).toBe("2");
    });

    it("should allow casting after select", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db
        .insert("users")
        .values({ id: "1", name: "John", email: null, age: null });

      type NameOnly = { name: string };
      const result = await db
        .query("users")
        .select("name")
        .$castTo<NameOnly>()
        .all();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).not.toHaveProperty("id");
    });
  });

  describe("$notNull", () => {
    it("should work after IS NOT NULL check at runtime", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db
        .insert("users")
        .values({ id: "1", name: "John", email: "john@example.com", age: 30 });
      await db
        .insert("users")
        .values({ id: "2", name: "Jane", email: null, age: null });

      // After IS NOT NULL check, email is guaranteed non-null
      const result = await db
        .query("users")
        .where("email", "IS NOT NULL", null)
        .$notNull()
        .all();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
      expect(result[0].email).toBe("john@example.com");
      expect(result[0].email).not.toBeNull();
    });

    it("should work with first() method", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db
        .insert("users")
        .values({ id: "1", name: "John", email: "john@example.com", age: 30 });

      const result = await db
        .query("users")
        .where("email", "IS NOT NULL", null)
        .$notNull()
        .first();

      expect(result).not.toBeNull();
      expect(result?.email).toBe("john@example.com");
      expect(result?.email).not.toBeNull();
    });

    it("should apply to all nullable fields", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db
        .insert("users")
        .values({ id: "1", name: "John", email: "john@example.com", age: 30 });

      const result = await db
        .query("users")
        .where("email", "IS NOT NULL", null)
        .where("age", "IS NOT NULL", null)
        .$notNull()
        .first();

      expect(result).not.toBeNull();
      expect(result?.email).toBe("john@example.com");
      expect(result?.age).toBe(30);
      expect(result?.email).not.toBeNull();
      expect(result?.age).not.toBeNull();
    });

    it("should work with select projection", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db
        .insert("users")
        .values({ id: "1", name: "John", email: "john@example.com", age: 30 });

      const result = await db
        .query("users")
        .where("email", "IS NOT NULL", null)
        .$notNull()
        .select("email")
        .all();

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("john@example.com");
    });
  });

  describe("$narrowType", () => {
    it("should narrow specific fields at runtime", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db
        .insert("users")
        .values({ id: "1", name: "John", email: "john@example.com", age: 30 });
      await db
        .insert("users")
        .values({ id: "2", name: "Jane", email: null, age: null });

      // Narrow just the email field (remove null)
      type Narrowed = { email: string };

      const result = await db
        .query("users")
        .where("email", "IS NOT NULL", null)
        .$narrowType<Narrowed>()
        .all();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
      expect(result[0].email).toBe("john@example.com");
      expect(result[0].email).not.toBeNull();
      // age can still be null (not narrowed)
    });

    it("should narrow multiple fields", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db
        .insert("users")
        .values({ id: "1", name: "John", email: "john@example.com", age: 30 });

      // Narrow both email and age (remove null from both)
      type Narrowed = { email: string; age: number };

      const result = await db
        .query("users")
        .where("email", "IS NOT NULL", null)
        .where("age", "IS NOT NULL", null)
        .$narrowType<Narrowed>()
        .first();

      expect(result).not.toBeNull();
      expect(result?.email).toBe("john@example.com");
      expect(result?.age).toBe(30);
    });

    it("should work with first() method", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db
        .insert("users")
        .values({ id: "1", name: "John", email: "john@example.com", age: 30 });

      type Narrowed = { email: string };

      const result = await db
        .query("users")
        .where("email", "IS NOT NULL", null)
        .$narrowType<Narrowed>()
        .first();

      expect(result).not.toBeNull();
      expect(result?.email).toBe("john@example.com");
    });

    it("should work with select projection", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db
        .insert("users")
        .values({ id: "1", name: "John", email: "john@example.com", age: 30 });

      type Narrowed = { email: string };

      const result = await db
        .query("users")
        .where("email", "IS NOT NULL", null)
        .$narrowType<Narrowed>()
        .select("email")
        .all();

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("john@example.com");
    });
  });

  describe("Type narrowing method chaining", () => {
    it("should allow chaining $castTo with other methods", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db
        .insert("users")
        .values({ id: "1", name: "John", email: "john@example.com", age: 30 });
      await db
        .insert("users")
        .values({ id: "2", name: "Jane", email: "jane@example.com", age: 25 });

      const result = await db
        .query("users")
        .where("age", ">", 25)
        .$castTo<UserWithProfile>()
        .orderBy("name", "DESC")
        .limit(1)
        .first();

      expect(result).not.toBeNull();
      expect(result?.name).toBe("John");
    });

    it("should allow chaining $notNull with where and orderBy", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db
        .insert("users")
        .values({ id: "1", name: "John", email: "john@example.com", age: 30 });
      await db.insert("users").values({
        id: "2",
        name: "Alice",
        email: "alice@example.com",
        age: 35,
      });
      await db
        .insert("users")
        .values({ id: "3", name: "Bob", email: null, age: null });

      const result = await db
        .query("users")
        .where("email", "IS NOT NULL", null)
        .$notNull()
        .orderBy("age", "DESC")
        .all();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Alice");
      expect(result[1].name).toBe("John");
    });

    it("should allow chaining $narrowType with pagination", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db
        .insert("users")
        .values({ id: "1", name: "John", email: "john@example.com", age: 30 });
      await db
        .insert("users")
        .values({ id: "2", name: "Jane", email: "jane@example.com", age: 25 });
      await db.insert("users").values({
        id: "3",
        name: "Alice",
        email: "alice@example.com",
        age: 35,
      });

      type Narrowed = { email: string };

      const result = await db
        .query("users")
        .where("email", "IS NOT NULL", null)
        .$narrowType<Narrowed>()
        .orderBy("name", "ASC")
        .limit(2)
        .skip(1)
        .all();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Jane");
      expect(result[1].name).toBe("John");
    });
  });

  describe("Type narrowing with count", () => {
    it("should work with count() method", async () => {
      const db = await createSQLiteClient({
        filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
        migrations: [
          {
            sql: `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, status TEXT DEFAULT 'active')`,
            version: 1,
          },
        ],
        schema: testSchema,
      });

      await db
        .insert("users")
        .values({ id: "1", name: "John", email: "john@example.com", age: 30 });
      await db
        .insert("users")
        .values({ id: "2", name: "Jane", email: null, age: null });
      await db.insert("users").values({
        id: "3",
        name: "Alice",
        email: "alice@example.com",
        age: 35,
      });

      const count = await db
        .query("users")
        .where("email", "IS NOT NULL", null)
        .$notNull()
        .count();

      expect(count).toBe(2);
    });
  });
});
