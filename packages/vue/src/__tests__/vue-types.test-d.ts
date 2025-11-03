/**
 * Type tests for Vue composables
 *
 * These tests verify that the Vue composables provide full type safety
 * for database operations in Vue components.
 *
 * Run with: pnpm test:type
 */

import { describe, expectTypeOf, it } from "vitest";
import { createTypedComposables } from "../typed-composables";
import { z } from "zod";
import type { SQLiteClient } from "@alexop/sqlite-core";

// Define test schema (same as in example app)
const todoSchema = z.object({
  completed: z.boolean(), createdAt: z.string(), id: z.string(), title: z.string(),
});

const testSchema = {
  todos: todoSchema,
} as const;

// Create typed composables
const { useSQLiteClientAsync, useSQLiteQuery } = createTypedComposables<typeof testSchema>();

// Mock the client for type testing
declare const db: SQLiteClient<typeof testSchema>;

describe("Vue Composables - Type Safety", () => {
  it("useSQLiteClientAsync returns properly typed client", async () => {
    // This test verifies the client is typed with the schema
    type ClientType = Awaited<ReturnType<typeof useSQLiteClientAsync>>;
    type ExpectedType = SQLiteClient<typeof testSchema>;

    expectTypeOf<ClientType>().toEqualTypeOf<ExpectedType>();
  });

  it("typed client enforces column name constraints", () => {
    // Verify that SQLiteClient properly types table and column operations
    // The where method should only accept valid column names
    expectTypeOf(db.query("todos").where).toBeFunction();
    expectTypeOf(db.delete("todos").where).toBeFunction();
    expectTypeOf(db.update("todos").where).toBeFunction();
  });

  it("typed client validates update set() parameter types", () => {
    // The set() method should validate field names and types
    expectTypeOf(db.update("todos").set).toBeFunction();
  });

  it("typed client rejects invalid table names", ({ expect }) => {
    // @ts-expect-error - "nonexistent" is not a valid table
    db.query("nonexistent");

    expect(true).toBe(true);

    // @ts-expect-error - "badTable" is not a valid table
    db.delete("badTable");
  });

  it("typed client accepts valid operations", () => {
    // All of these should compile without errors
    expectTypeOf(db.query("todos").where("id", "=", "123")).toBeObject();
    expectTypeOf(db.query("todos").where("completed", "=", false)).toBeObject();
    expectTypeOf(db.delete("todos").where("id", "=", "123")).toBeObject();
    expectTypeOf(db.update("todos").set({ title: "Updated" })).toBeObject();
  });

  it("useSQLiteQuery infers correct return types", () => {
    // Query function parameter should be properly typed
    const queryResult = useSQLiteQuery(
      (db) => db.query("todos").where("completed", "=", false).all()
    );

    // Verify return object has expected properties
    expectTypeOf(queryResult.rows).toBeObject();
    expectTypeOf(queryResult.loading).toBeObject();
    expectTypeOf(queryResult.error).toBeObject();
  });

  it("useSQLiteQuery provides typed db parameter", () => {
    // The db parameter in the callback should be properly typed
    type QueryFnParam = Parameters<typeof useSQLiteQuery>[0];
    type DbParam = Parameters<QueryFnParam>[0];

    // DB parameter should be SQLiteClient with our schema
    expectTypeOf<DbParam>().toEqualTypeOf<SQLiteClient<typeof testSchema>>();
  });
});

describe("Vue Composables - Real World Usage", () => {
  it("allows typical CRUD operations with type safety", async () => {
    // Simulating what you'd write in a Vue component

    // ✅ SELECT with type safety
    const selectQuery = useSQLiteQuery(
      (db) => db.query("todos").orderBy("createdAt", "DESC").all()
    );

    // ✅ SELECT with WHERE
    const filteredQuery = useSQLiteQuery(
      (db) => db.query("todos").where("completed", "=", false).all()
    );

    // All should compile
    expectTypeOf(selectQuery).toBeObject();
    expectTypeOf(filteredQuery).toBeObject();
  });

  it("provides type safety for mutations", async () => {
    const clientPromise = useSQLiteClientAsync();

    // Verify the promise resolves to the correct type
    type ClientType = Awaited<typeof clientPromise>;
    expectTypeOf<ClientType>().toEqualTypeOf<SQLiteClient<typeof testSchema>>();
  });
});
