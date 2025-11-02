# Type Safety Testing

This document explains how the SQLite library's type safety works and how to test it.

## Overview

The SQLite library provides **compile-time type safety** that catches errors like:
- ❌ Typos in column names (e.g., `"idz"` instead of `"id"`)
- ❌ Wrong value types (e.g., passing a number when a string is expected)
- ❌ Invalid table names
- ❌ Non-existent fields

## How It Works

The type system leverages TypeScript's type inference and Zod schemas to provide full type safety:

```typescript
// Define your schema
const schema = {
  todos: z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
  })
} as const;

// Create typed client
const db = await createSQLiteClient({ schema, ... });

// ✅ Valid: Correct column name
await db.delete("todos").where("id", "=", "123").execute();

// ❌ TypeScript Error: "idz" is not a valid column name
await db.delete("todos").where("idz", "=", "123").execute();
//                                   ^^^^^ Type error!
```

## Type Safety Features

### 1. Query Builder (`query()`)

```typescript
// ✅ Valid column names in where()
db.query("todos").where("id", "=", "123")
db.query("todos").where("completed", "=", false)

// ❌ TypeScript Error: Invalid column name
db.query("todos").where("nonexistent", "=", "value")

// ✅ Valid column names in orderBy()
db.query("todos").orderBy("createdAt", "DESC")

// ❌ TypeScript Error: Invalid column name
db.query("todos").orderBy("wrongColumn", "DESC")

// ✅ Valid column names in select()
db.query("todos").select("id", "title")

// ❌ TypeScript Error: Invalid column name
db.query("todos").select("badColumn")
```

### 2. Value Type Checking

```typescript
// ✅ Correct types
db.query("todos").where("id", "=", "string-value")  // id is string
db.query("todos").where("completed", "=", true)     // completed is boolean

// ❌ TypeScript Error: Wrong types
db.query("todos").where("id", "=", 123)           // id expects string, not number
db.query("todos").where("completed", "=", "true") // completed expects boolean, not string
```

### 3. Update Builder (`update()`)

```typescript
// ✅ Valid
db.update("todos")
  .where("id", "=", "123")
  .set({ title: "Updated" })
  .execute()

// ❌ TypeScript Error: Invalid field name
db.update("todos").where("wrongField", "=", "value")

// ❌ TypeScript Error: Wrong type
db.update("todos").set({ completed: "true" })  // expects boolean
```

### 4. Delete Builder (`delete()`)

```typescript
// ✅ Valid
db.delete("todos").where("id", "=", "123").execute()

// ❌ TypeScript Error: Typo in column name
db.delete("todos").where("idz", "=", "123").execute()

// ❌ TypeScript Error: Wrong value type
db.delete("todos").where("id", "=", 123).execute()  // id is string, not number
```

### 5. Insert Builder (`insert()`)

```typescript
// ✅ Valid
db.insert("todos").values({
  id: "123",
  title: "Test",
  completed: false
})

// ❌ TypeScript Error: Wrong field type
db.insert("todos").values({
  id: 123,  // Should be string
  title: "Test"
})

// ❌ TypeScript Error: Unknown field
db.insert("todos").values({
  wrongField: "value"
})
```

## Automated Type Testing

Type safety is verified using Vitest's type testing capabilities. Tests are located in:

```
packages/core/src/__tests__/types.test-d.ts
```

### Running Type Tests

```bash
# Run type tests
pnpm --filter @alexop/sqlite-core test:type

# Or from the core package directory
cd packages/core
pnpm test:type
```

### Test Coverage

The test suite includes 27 tests covering:

1. **QueryBuilder Type Safety**
   - Column name validation in `where()`
   - Column name validation in `orderBy()`
   - Column name validation in `select()`
   - Value type checking

2. **UpdateBuilder Type Safety**
   - Column name validation in `where()`
   - Field validation in `set()`
   - Value type checking

3. **DeleteBuilder Type Safety**
   - Column name validation in `where()`
   - Value type checking

4. **InsertBuilder Type Safety**
   - Field name validation
   - Field type validation

5. **Table Name Validation**
   - Rejects invalid table names

### Example Test

```typescript
describe("DeleteBuilder - Type Safety", () => {
  it("rejects invalid column names in where()", () => {
    // @ts-expect-error - "idz" is not a valid column name (typo example)
    db.delete("todos").where("idz", "=", "123");

    // @ts-expect-error - "nonexistent" is not a valid column name
    db.delete("todos").where("nonexistent", "=", "value");
  });

  it("rejects wrong value types in where()", () => {
    // @ts-expect-error - "id" expects string, not number
    db.delete("todos").where("id", "=", 123);

    // @ts-expect-error - "completed" expects boolean, not string
    db.delete("todos").where("completed", "=", "false");
  });
});
```

## Benefits

1. **Catch Errors Early**: Typos and type mismatches are caught at compile time, not runtime
2. **Better IDE Support**: Full autocomplete for table names, column names, and types
3. **Refactoring Safety**: Renaming fields in schemas automatically flags all usages
4. **Self-Documenting**: Types serve as inline documentation
5. **Fewer Tests Needed**: Type errors can't reach production

## Implementation Details

The type system uses:
- **Generic Type Parameters**: Preserve type information through method chains
- **Conditional Types**: `QueryResult<TRow, TSelected>` narrows based on selected fields
- **Type Inference**: `TableRow<TSchema, TTable>` extracts types from Zod schemas
- **Mapped Types**: `keyof TRow` ensures only valid column names are accepted

Key type definitions (in `src/types.ts`):
- `SchemaRegistry`: Maps table names to Zod schemas
- `TableRow<TSchema, TTable>`: Extracts row type from schema
- `TableName<TSchema>`: Valid table names
- `QueryResult<TRow, TSelected>`: Result type with optional field selection
