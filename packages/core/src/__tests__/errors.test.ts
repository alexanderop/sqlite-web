import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSQLiteClient, type SQLiteClient } from "../index";
import { SQLiteError, ConstraintError } from "../errors";

describe("Core Error Handling", () => {
  let db: SQLiteClient;

  beforeEach(async () => {
    db = await createSQLiteClient({
      filename: `test-errors-${Date.now()}.sqlite3`,
    });

    // Enable foreign key constraints
    await db.exec("PRAGMA foreign_keys = ON");

    // Create users table with unique constraint on email
    await db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        age INTEGER NOT NULL
      )
    `);

    // Create posts table with foreign key constraint
    await db.exec(`
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);
  });

  afterEach(async () => {
    await db.close();
  });

  describe("ConstraintError", () => {
    it("should throw ConstraintError on UNIQUE constraint violation", async () => {
      // Insert a user
      await db.exec("INSERT INTO users (name, email, age) VALUES (?, ?, ?)", [
        "John Doe",
        "john@example.com",
        30,
      ]);

      // Try to insert another user with same email
      try {
        await db.exec("INSERT INTO users (name, email, age) VALUES (?, ?, ?)", [
          "Jane Doe",
          "john@example.com",
          25,
        ]);
        expect.fail("Should have thrown ConstraintError");
      } catch (error) {
        expect(error).toBeInstanceOf(ConstraintError);
        expect((error as ConstraintError).code).toBe("CONSTRAINT_ERROR");
        expect((error as ConstraintError).constraint).toContain(
          "UNIQUE constraint failed"
        );
        expect((error as ConstraintError).constraint).toContain("users.email");
      }
    });

    it("should throw ConstraintError on FOREIGN KEY violation", async () => {
      // Try to insert post with non-existent userId
      try {
        await db.exec(
          "INSERT INTO posts (userId, title, content) VALUES (?, ?, ?)",
          [999, "Test Post", "Content"]
        );
        expect.fail("Should have thrown ConstraintError");
      } catch (error) {
        expect(error).toBeInstanceOf(ConstraintError);
        expect((error as ConstraintError).code).toBe("CONSTRAINT_ERROR");
        expect((error as ConstraintError).constraint).toBe(
          "FOREIGN KEY constraint failed"
        );
      }
    });

    it("should throw ConstraintError on NOT NULL violation", async () => {
      // Try to insert user without required field
      try {
        await db.exec(
          "INSERT INTO users (name, email) VALUES (?, ?)",
          ["John Doe", "john@example.com"]
          // Missing age field which is NOT NULL
        );
        expect.fail("Should have thrown ConstraintError");
      } catch (error) {
        expect(error).toBeInstanceOf(ConstraintError);
        expect((error as ConstraintError).code).toBe("CONSTRAINT_ERROR");
        expect((error as ConstraintError).constraint).toContain(
          "NOT NULL constraint failed"
        );
      }
    });
  });

  describe("SQLiteError", () => {
    it("should throw SQLiteError on SQL syntax error", async () => {
      try {
        await db.exec("INVALID SQL SYNTAX");
        expect.fail("Should have thrown SQLiteError");
      } catch (error) {
        expect(error).toBeInstanceOf(SQLiteError);
        expect((error as SQLiteError).code).toBe("SQL_ERROR");
        expect((error as SQLiteError).message).toContain("syntax error");
      }
    });

    it("should throw SQLiteError on non-existent table", async () => {
      try {
        await db.exec("SELECT * FROM non_existent_table");
        expect.fail("Should have thrown SQLiteError");
      } catch (error) {
        expect(error).toBeInstanceOf(SQLiteError);
        expect((error as SQLiteError).code).toBe("SQL_ERROR");
        expect((error as SQLiteError).message).toContain("no such table");
      }
    });
  });

  describe("Error properties", () => {
    it("should include SQL in error for exec()", async () => {
      const sql = "INVALID SQL";
      try {
        await db.exec(sql);
        expect.fail("Should have thrown SQLiteError");
      } catch (error) {
        expect(error).toBeInstanceOf(SQLiteError);
        expect((error as SQLiteError).sql).toBe(sql);
      }
    });

    it("should include helpful error messages", async () => {
      try {
        await db.exec("SELECT * FROM users WHERE invalid_column = 1");
        expect.fail("Should have thrown SQLiteError");
      } catch (error) {
        expect(error).toBeInstanceOf(SQLiteError);
        expect((error as SQLiteError).message).toBeTruthy();
        expect((error as SQLiteError).message.length).toBeGreaterThan(0);
      }
    });
  });
});
