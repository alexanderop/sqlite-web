---
title: Type Safety
description: Leverage TypeScript for compile-time type checking
---

SQLite Web provides complete type safety from schema definition to query results. This guide explores advanced type safety patterns.

## Schema Type Inference

The `as const` assertion enables TypeScript to infer exact types:

```typescript
import { z } from "zod";

// Without 'as const'
const badSchema = {
  users: z.object({ id: z.string(), name: z.string() }),
};
// Type: { users: ZodObject<...> }

// With 'as const'
const goodSchema = {
  users: z.object({ id: z.string(), name: z.string() }),
} as const;
// Type: { readonly users: ZodObject<...> }
```

The `as const` is critical for:

- Table name autocomplete
- Column name autocomplete
- Value type checking

## Table Names

TypeScript knows which tables exist:

```typescript
const schema = {
  users: z.object({ id: z.string() }),
  posts: z.object({ id: z.string() })
} as const;

const db = await createSQLiteClient({ schema, ... });

// ✅ Valid - 'users' exists
db.query("users")

// ✅ Valid - 'posts' exists
db.query("posts")

// ❌ TypeScript error - 'invalid' doesn't exist
db.query("invalid")
//         ^^^^^^^ Argument of type '"invalid"' is not assignable to parameter
```

## Column Names

TypeScript knows which columns exist in each table:

```typescript
const schema = {
  users: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
} as const;

// ✅ Valid columns
db.query("users").select("id", "name");
db.query("users").where("email", "=", "alice@example.com");

// ❌ TypeScript errors
db.query("users").select("invalid");
//                       ^^^^^^^^^ Argument of type '"invalid"' is not assignable

db.query("users").where("invalid", "=", "value");
//                      ^^^^^^^^^ Argument of type '"invalid"' is not assignable
```

## Value Types

TypeScript enforces correct value types:

```typescript
const schema = {
  users: z.object({
    id: z.string(),
    name: z.string(),
    age: z.number(),
    active: z.boolean(),
  }),
} as const;

// ✅ Valid - correct types
db.query("users").where("name", "=", "Alice");
db.query("users").where("age", ">", 18);
db.query("users").where("active", "=", true);

// ❌ TypeScript errors - wrong types
db.query("users").where("name", "=", 123);
//                                  ^^^ Type 'number' is not assignable to type 'string'

db.query("users").where("age", ">", "18");
//                                  ^^^^ Type 'string' is not assignable to type 'number'

db.query("users").where("active", "=", "yes");
//                                     ^^^^^ Type 'string' is not assignable to type 'boolean'
```

## Query Result Types

Query results are automatically typed:

```typescript
const schema = {
  users: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    age: z.number(),
  })
} as const;

const db = await createSQLiteClient({ schema, ... });

// All columns
const users = await db.query("users").all();
// Type: Array<{ id: string, name: string, email: string, age: number }>

// Selected columns
const names = await db.query("users").select("id", "name").all();
// Type: Array<{ id: string, name: string }>

// Single result
const user = await db.query("users").where("id", "=", "123").first();
// Type: { id: string, name: string, email: string, age: number } | null

// Count
const count = await db.query("users").count();
// Type: number
```

## Select Type Narrowing

The `.select()` method narrows the return type:

```typescript
// No select - all fields
const all = await db.query("users").all();
// Type: Array<{ id: string, name: string, email: string, age: number }>

// Select specific fields - type narrows
const partial = await db.query("users").select("id", "email").all();
// Type: Array<{ id: string, email: string }>

// Single field
const ids = await db.query("users").select("id").all();
// Type: Array<{ id: string }>
```

TypeScript will error if you try to access non-selected fields:

```typescript
const users = await db.query("users").select("id", "name").all();

users[0].id; // ✅ OK
users[0].name; // ✅ OK
users[0].email; // ❌ TypeScript error - 'email' doesn't exist on type
```

## Insert Type Checking

Inserts are type-checked against the schema:

```typescript
const schema = {
  users: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    age: z.number().min(0).max(150),
  }),
} as const;

// ✅ Valid
await db.insert("users").values({
  id: "1",
  name: "Alice",
  email: "alice@example.com",
  age: 30,
});

// ❌ Missing required field
await db.insert("users").values({
  id: "1",
  name: "Alice",
  // email missing!
  age: 30,
});

// ❌ Wrong type
await db.insert("users").values({
  id: "1",
  name: "Alice",
  email: "alice@example.com",
  age: "thirty", // Should be number
});
```

## Update Type Checking

Updates are also type-checked:

```typescript
// ✅ Valid
await db.update("users").where("id", "=", "1").set({ age: 31 }).execute();

// ❌ Wrong type
await db
  .update("users")
  .where("id", "=", "1")
  .set({ age: "31" }) // Should be number
  .execute();

// ❌ Invalid field
await db
  .update("users")
  .where("id", "=", "1")
  .set({ invalid: "value" })
  .execute();
```

## Type Exports

Export types from your schema for use throughout your app:

```typescript
// db/schema.ts
import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

export const postSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  content: z.string(),
});

export const dbSchema = {
  users: userSchema,
  posts: postSchema,
} as const;

// Export inferred types
export type User = z.infer<typeof userSchema>;
export type Post = z.infer<typeof postSchema>;

// components/UserProfile.vue
import type { User } from "@/db/schema";

interface Props {
  user: User;
}

const props = defineProps<Props>();
// props.user is fully typed!
```

## Generic Helpers

Create type-safe helper functions:

```typescript
import type { SQLiteClient, SchemaRegistry } from "@alexop/sqlite-core";

// Type-safe query builder
function createQueryBuilder<TSchema extends SchemaRegistry>(
  db: SQLiteClient<TSchema>
) {
  return {
    async findById<TTable extends keyof TSchema>(table: TTable, id: string) {
      return db
        .query(table)
        .where("id" as any, "=", id)
        .first();
    },

    async findAll<TTable extends keyof TSchema>(table: TTable) {
      return db.query(table).all();
    },
  };
}

// Usage
const qb = createQueryBuilder(db);
const user = await qb.findById("users", "123");
// Type: User | null

const posts = await qb.findAll("posts");
// Type: Array<Post>
```

## Conditional Types

Use conditional types for advanced patterns:

```typescript
import { z } from "zod";

type TableRow<
  TSchema extends SchemaRegistry,
  TTable extends keyof TSchema,
> = z.infer<TSchema[TTable]>;

type QueryResult<
  TRow,
  TSelected extends keyof TRow | never = never,
> = TSelected extends never ? TRow : Pick<TRow, TSelected>;

// Usage in composables
function useTypedQuery<
  TSchema extends SchemaRegistry,
  TTable extends keyof TSchema,
  TSelected extends keyof TableRow<TSchema, TTable> | never = never,
>(
  table: TTable,
  select?: TSelected[]
): QueryResult<TableRow<TSchema, TTable>, TSelected>[] {
  // Implementation
}

// Fully typed results
const allFields = useTypedQuery("users");
// Type: Array<{ id: string, name: string, email: string }>

const selectedFields = useTypedQuery("users", ["id", "name"]);
// Type: Array<{ id: string, name: string }>
```

## Vue Component Types

Type your Vue components with schema types:

```vue
<script setup lang="ts">
import type { User } from "@/db/schema";
import { useSQLiteQuery } from "@alexop/sqlite-vue";

const { rows: users } = useSQLiteQuery((db) => db.query("users").all(), {
  tables: ["users"],
});
// rows type: Ref<Array<User> | null>

function handleUser(user: User) {
  console.log(user.name); // ✅ TypeScript knows 'name' exists
  console.log(user.invalid); // ❌ TypeScript error
}
</script>

<template>
  <div v-for="user in users" :key="user.id">
    {{ user.name }}
  </div>
</template>
```

## Strict Mode

Enable strict TypeScript checking in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

This ensures maximum type safety throughout your application.

## Type Utilities

Create reusable type utilities:

```typescript
// db/types.ts
import { z } from "zod";
import type { dbSchema } from "./schema";

// Extract all table names
export type TableName = keyof typeof dbSchema;

// Extract row type for a table
export type RowOf<T extends TableName> = z.infer<(typeof dbSchema)[T]>;

// Extract a specific field type
export type FieldOf<
  T extends TableName,
  F extends keyof RowOf<T>,
> = RowOf<T>[F];

// Usage
type UserEmail = FieldOf<"users", "email">;
// Type: string

type PostTitle = FieldOf<"posts", "title">;
// Type: string
```

## Best Practices

1. **Always use `as const`** - Critical for type inference
2. **Export types** - Share schema types across your app
3. **Enable strict mode** - Catch more errors at compile time
4. **Type your components** - Use schema types in Vue props
5. **Use type utilities** - Create reusable type helpers
6. **Leverage autocomplete** - Let TypeScript guide your coding

## Next Steps

- [Schema Definition](/core/schema/) - Define your schema with Zod
- [Query Builder](/core/query-builder/) - Build type-safe queries
- [Vue Composables](/vue/composables/) - Type-safe Vue integration
