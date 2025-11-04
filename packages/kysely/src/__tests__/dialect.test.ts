import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Kysely } from "kysely";
import type { GeneratedAlways } from "kysely";
import { SqliteWebDialect } from "../dialect";
import { createSQLiteClient } from "@alexop/sqlite-core";

/**
 * Test database schema
 */
interface Database {
  users: {
    id: GeneratedAlways<number>;
    name: string;
    email: string;
  };
  posts: {
    id: GeneratedAlways<number>;
    userId: number;
    title: string;
    content: string;
  };
}

describe("SqliteWebDialect", () => {
  let db: Kysely<Database>;
  let testDbName: string;

  beforeEach(async () => {
    // Create unique database for each test
    testDbName = `test-dialect-${Date.now()}.db`;

    db = new Kysely<Database>({
      dialect: new SqliteWebDialect({
        database: async () => {
          const client = await createSQLiteClient({
            filename: testDbName,
            migrations: [
              {
                version: 1,
                sql: `
                  CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE
                  )
                `,
              },
              {
                version: 2,
                sql: `
                  CREATE TABLE posts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    FOREIGN KEY (userId) REFERENCES users(id)
                  )
                `,
              },
            ],
          });
          return client;
        },
      }),
    });
  });

  afterEach(async () => {
    await db.destroy();
  });

  it("should create a Kysely instance with SqliteWebDialect", () => {
    expect(db).toBeDefined();
  });

  it("should insert a row using Kysely query builder", async () => {
    const result = await db
      .insertInto("users")
      .values({
        name: "Alice",
        email: "alice@example.com",
      })
      .executeTakeFirstOrThrow();

    expect(result).toBeDefined();
  });

  it("should query rows using Kysely query builder", async () => {
    // Insert test data
    await db
      .insertInto("users")
      .values({
        name: "Bob",
        email: "bob@example.com",
      })
      .execute();

    // Query
    const users = await db.selectFrom("users").selectAll().execute();

    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      name: "Bob",
      email: "bob@example.com",
    });
  });

  it("should support WHERE clauses", async () => {
    // Insert multiple users
    await db
      .insertInto("users")
      .values([
        { name: "Charlie", email: "charlie@example.com" },
        { name: "Diana", email: "diana@example.com" },
        { name: "Charlie Smith", email: "charlie.smith@example.com" },
      ])
      .execute();

    // Query with WHERE
    const charlies = await db
      .selectFrom("users")
      .selectAll()
      .where("name", "like", "Charlie%")
      .execute();

    expect(charlies).toHaveLength(2);
  });

  it("should support SELECT specific columns", async () => {
    await db
      .insertInto("users")
      .values({
        name: "Eve",
        email: "eve@example.com",
      })
      .execute();

    const users = await db
      .selectFrom("users")
      .select(["name", "email"])
      .execute();

    expect(users[0]).toHaveProperty("name");
    expect(users[0]).toHaveProperty("email");
    expect(users[0]).not.toHaveProperty("id");
  });

  it("should support ORDER BY", async () => {
    await db
      .insertInto("users")
      .values([
        { name: "Zoe", email: "zoe@example.com" },
        { name: "Alice", email: "alice@example.com" },
        { name: "Mike", email: "mike@example.com" },
      ])
      .execute();

    const users = await db
      .selectFrom("users")
      .selectAll()
      .orderBy("name", "asc")
      .execute();

    expect(users[0].name).toBe("Alice");
    expect(users[1].name).toBe("Mike");
    expect(users[2].name).toBe("Zoe");
  });

  it("should support LIMIT and OFFSET", async () => {
    await db
      .insertInto("users")
      .values([
        { name: "User1", email: "user1@example.com" },
        { name: "User2", email: "user2@example.com" },
        { name: "User3", email: "user3@example.com" },
        { name: "User4", email: "user4@example.com" },
      ])
      .execute();

    const page2 = await db
      .selectFrom("users")
      .selectAll()
      .orderBy("id")
      .limit(2)
      .offset(2)
      .execute();

    expect(page2).toHaveLength(2);
    expect(page2[0].name).toBe("User3");
  });

  it("should support UPDATE queries", async () => {
    await db
      .insertInto("users")
      .values({
        name: "Frank",
        email: "frank@example.com",
      })
      .execute();

    await db
      .updateTable("users")
      .set({ email: "frank.new@example.com" })
      .where("name", "=", "Frank")
      .execute();

    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("name", "=", "Frank")
      .executeTakeFirstOrThrow();

    expect(user.email).toBe("frank.new@example.com");
  });

  it("should support DELETE queries", async () => {
    await db
      .insertInto("users")
      .values([
        { name: "Grace", email: "grace@example.com" },
        { name: "Henry", email: "henry@example.com" },
      ])
      .execute();

    await db.deleteFrom("users").where("name", "=", "Grace").execute();

    const users = await db.selectFrom("users").selectAll().execute();

    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("Henry");
  });

  it("should support JOIN queries", async () => {
    // Insert user
    const userResult = await db
      .insertInto("users")
      .values({
        name: "Isabel",
        email: "isabel@example.com",
      })
      .executeTakeFirstOrThrow();

    // Insert post
    await db
      .insertInto("posts")
      .values({
        userId: Number(userResult.insertId),
        title: "My First Post",
        content: "Hello World",
      })
      .execute();

    // Join query
    const results = await db
      .selectFrom("posts")
      .innerJoin("users", "users.id", "posts.userId")
      .select([
        "posts.title",
        "posts.content",
        "users.name as authorName",
        "users.email as authorEmail",
      ])
      .execute();

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: "My First Post",
      authorName: "Isabel",
      authorEmail: "isabel@example.com",
    });
  });

  it("should support transactions", async () => {
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("users")
        .values({
          name: "Jack",
          email: "jack@example.com",
        })
        .execute();

      await trx
        .insertInto("users")
        .values({
          name: "Kate",
          email: "kate@example.com",
        })
        .execute();
    });

    const users = await db.selectFrom("users").selectAll().execute();
    expect(users).toHaveLength(2);
  });

  it("should rollback transactions on error", async () => {
    try {
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto("users")
          .values({
            name: "Leo",
            email: "leo@example.com",
          })
          .execute();

        // This should fail (duplicate email)
        await trx
          .insertInto("users")
          .values({
            name: "Leo2",
            email: "leo@example.com",
          })
          .execute();
      });
    } catch {
      // Expected to fail
    }

    const users = await db.selectFrom("users").selectAll().execute();
    expect(users).toHaveLength(0); // Rolled back, no users
  });
});
