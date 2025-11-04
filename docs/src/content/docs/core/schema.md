---
title: Schema Definition
description: Define type-safe database schemas with Zod
---

SQLite Web uses Zod schemas to define your database structure and enable full TypeScript type inference.

## Basic Schema

Define your schema as a const object mapping table names to Zod schemas:

```typescript
import { z } from "zod";

const dbSchema = {
  users: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    createdAt: z.string(),
  }),
} as const;
```

:::caution[Important]
Always use `as const` at the end of your schema definition. This enables TypeScript to infer exact table names and field types instead of widening to generic strings.
:::

## Default Values

Use Zod's `.default()` to provide default values:

```typescript
const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean().default(false),
  createdAt: z.string().default(() => new Date().toISOString()),
});
```

Defaults are applied during insert operations:

```typescript
await db.insert("todos").values({
  id: crypto.randomUUID(),
  title: "Buy groceries",
  // completed and createdAt use defaults
});
```

## Optional Fields

Mark fields as optional with `.optional()`:

```typescript
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  bio: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

// Valid - bio is optional
await db.insert("users").values({
  id: "1",
  name: "Alice",
});

// Also valid
await db.insert("users").values({
  id: "2",
  name: "Bob",
  bio: "Software developer",
});
```

## Data Validation

Zod validates all inserted and updated data:

```typescript
const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  age: z.number().min(0).max(150),
});

// ✅ Valid
await db.insert("users").values({
  id: crypto.randomUUID(),
  email: "alice@example.com",
  age: 30,
});

// ❌ Throws ZodError - invalid email
await db.insert("users").values({
  id: crypto.randomUUID(),
  email: "not-an-email",
  age: 30,
});

// ❌ Throws ZodError - age out of range
await db.insert("users").values({
  id: crypto.randomUUID(),
  email: "bob@example.com",
  age: 200,
});
```

## Multiple Tables

Define multiple tables in your schema:

```typescript
const dbSchema = {
  users: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
  }),
  posts: z.object({
    id: z.string(),
    userId: z.string(),
    title: z.string(),
    content: z.string(),
    publishedAt: z.string().optional(),
  }),
  comments: z.object({
    id: z.string(),
    postId: z.string(),
    userId: z.string(),
    text: z.string(),
    createdAt: z.string(),
  }),
} as const;
```

TypeScript will autocomplete table names and enforce correct field types for each table.

## Type Inference

The schema enables complete type inference:

```typescript
const dbSchema = {
  todos: z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
  }),
} as const;

const db = await createSQLiteClient({ schema: dbSchema });

const todos = await db.query("todos").all();
// Type: Array<{ id: string, title: string, completed: boolean }>

const titles = await db.query("todos").select("title").all();
// Type: Array<{ title: string }>
```

## SQLite Type Mapping

SQLite only has a few storage classes. Here's how Zod types map to SQLite:

| Zod Type      | SQLite Type         | Notes                              |
| ------------- | ------------------- | ---------------------------------- |
| `z.string()`  | `TEXT`              | Strings and dates (as ISO strings) |
| `z.number()`  | `INTEGER` or `REAL` | Integers and floats                |
| `z.boolean()` | `INTEGER`           | Stored as 0 (false) or 1 (true)    |
| `z.date()`    | `TEXT`              | Store as ISO string with transform |
| `z.object()`  | `TEXT`              | Store as JSON string               |
| `z.array()`   | `TEXT`              | Store as JSON string               |

:::note
For dates, we recommend using ISO 8601 strings (`z.string()`) rather than `z.date()` for simplicity. If you need `Date` objects, use Zod transforms:

```typescript
const schema = z.object({
  createdAt: z.string().transform((str) => new Date(str)),
});
```

:::

## Enums

Use Zod's enum or union types for constrained values:

```typescript
const taskSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "in_progress", "completed"]),
  priority: z.union([z.literal("low"), z.literal("medium"), z.literal("high")]),
});

// ✅ Valid
await db.insert("tasks").values({
  id: "1",
  status: "pending",
  priority: "high",
});

// ❌ TypeScript error - invalid status
await db.insert("tasks").values({
  id: "2",
  status: "invalid",
  priority: "low",
});
```

## Nested Objects

For complex data, store as JSON:

```typescript
const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  metadata: z.object({
    tags: z.array(z.string()),
    dimensions: z.object({
      width: z.number(),
      height: z.number(),
    }),
  }),
});

await db.insert("products").values({
  id: "1",
  name: "Widget",
  metadata: {
    tags: ["electronics", "gadget"],
    dimensions: { width: 10, height: 5 },
  },
});
```

The object will be automatically serialized to JSON when stored:

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  metadata TEXT  -- Store as JSON string
)
```

## Schema Refinements

Add custom validation with Zod refinements:

```typescript
const userSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be at most 20 characters")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers, and underscores"
      ),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
```

## Best Practices

1. **Use `as const`** - Always include it to enable type inference
2. **Validate at the schema level** - Use Zod's built-in validators instead of checking manually
3. **Prefer strings for dates** - Use ISO 8601 strings for simplicity
4. **Store complex types as JSON** - Use `z.object()` or `z.array()` and serialize to TEXT
5. **Add defaults** - Use `.default()` for timestamp fields and boolean flags

## Next Steps

- [Query Builder](/core/query-builder/) - Learn how to query your schema
- [Mutations](/core/mutations/) - Insert, update, and delete with validation
- [Type Safety Guide](/guides/type-safety/) - Advanced type safety patterns
