---
title: Mutations
description: Insert, update, and delete data with automatic validation
---

SQLite Web provides type-safe mutation methods with automatic Zod validation for all data changes.

## Insert

Add new rows to your database with `.insert()`:

### Basic Insert

```typescript
await db.insert("todos").values({
  id: crypto.randomUUID(),
  title: "Buy groceries",
  completed: false,
  createdAt: new Date().toISOString(),
});
```

### Using Defaults

Fields with `.default()` in the schema can be omitted:

```typescript
const schema = {
  todos: z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean().default(false),
    createdAt: z.string().default(() => new Date().toISOString()),
  }),
} as const;

// completed and createdAt use defaults
await db.insert("todos").values({
  id: crypto.randomUUID(),
  title: "Buy groceries",
});
```

### Validation

All inserts are validated against the Zod schema:

```typescript
const schema = {
  users: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    age: z.number().min(0).max(150),
  }),
} as const;

// ✅ Valid
await db.insert("users").values({
  id: crypto.randomUUID(),
  email: "alice@example.com",
  age: 30,
});

// ❌ Throws ZodError - invalid email
await db.insert("users").values({
  id: "123",
  email: "not-an-email",
  age: 30,
});
```

### Type Safety

TypeScript enforces correct field types:

```typescript
// ✅ Valid
await db.insert("todos").values({
  id: "123",
  title: "Buy milk",
  completed: false,
});

// ❌ TypeScript error - missing required field 'title'
await db.insert("todos").values({
  id: "123",
  completed: false,
});

// ❌ TypeScript error - wrong type for 'completed'
await db.insert("todos").values({
  id: "123",
  title: "Buy milk",
  completed: "yes", // Should be boolean
});
```

## Update

Modify existing rows with `.update()`:

### Basic Update

```typescript
await db
  .update("todos")
  .where("id", "=", "123")
  .set({ completed: true })
  .execute();
```

### Multiple Fields

Update multiple fields at once:

```typescript
await db
  .update("todos")
  .where("id", "=", "123")
  .set({
    title: "Updated title",
    completed: true,
    updatedAt: new Date().toISOString(),
  })
  .execute();
```

### Multiple Conditions

Use multiple `.where()` calls for complex conditions:

```typescript
await db
  .update("todos")
  .where("completed", "=", false)
  .where("priority", "=", "low")
  .set({ priority: "medium" })
  .execute();
```

### Validation

Updates are also validated:

```typescript
// ✅ Valid
await db.update("users").where("id", "=", "123").set({ age: 31 }).execute();

// ❌ Throws ZodError - age out of range
await db.update("users").where("id", "=", "123").set({ age: 200 }).execute();
```

### Type Safety

TypeScript ensures you only update with valid fields and types:

```typescript
// ✅ Valid - 'completed' exists and is boolean
await db
  .update("todos")
  .where("id", "=", "123")
  .set({ completed: true })
  .execute();

// ❌ TypeScript error - 'invalid' field doesn't exist
await db
  .update("todos")
  .where("id", "=", "123")
  .set({ invalid: "value" })
  .execute();

// ❌ TypeScript error - wrong type
await db
  .update("todos")
  .where("id", "=", "123")
  .set({ completed: "yes" }) // Should be boolean
  .execute();
```

## Delete

Remove rows with `.delete()`:

### Basic Delete

```typescript
await db.delete("todos").where("id", "=", "123").execute();
```

### Conditional Delete

Delete based on conditions:

```typescript
// Delete all completed todos
await db.delete("todos").where("completed", "=", true).execute();

// Delete old todos
await db.delete("todos").where("createdAt", "<", "2024-01-01").execute();
```

### Multiple Conditions

```typescript
await db
  .delete("todos")
  .where("completed", "=", true)
  .where("createdAt", "<", "2024-01-01")
  .execute();
```

:::caution
Be careful with `.delete()` without a `.where()` clause - it will delete ALL rows!

```typescript
// This deletes EVERYTHING
await db.delete("todos").execute();
```

:::

## Transactions

Transactions ensure multiple operations succeed or fail together, maintaining data consistency.

### Automatic Transactions (Recommended)

The `.transaction()` method automatically commits on success and rolls back on error:

```typescript
// All-or-nothing: both inserts succeed or both fail
await db.transaction(async (tx) => {
  await tx.insert("users").values({
    id: "1",
    name: "Alice",
    email: "alice@example.com",
  });
  await tx.insert("profiles").values({
    userId: "1",
    bio: "Developer",
  });
  // Automatically commits if no errors
});
```

### Financial Transfer Example

Transactions are essential for operations that must be atomic:

```typescript
await db.transaction(async (tx) => {
  // Get current balances
  const sender = await tx.query("accounts").where("id", "=", senderId).first();

  const receiver = await tx
    .query("accounts")
    .where("id", "=", receiverId)
    .first();

  // Validate
  if (!sender || sender.balance < amount) {
    throw new Error("Insufficient funds");
  }

  // Perform transfer
  await tx
    .update("accounts")
    .where("id", "=", senderId)
    .set({ balance: sender.balance - amount })
    .execute();

  await tx
    .update("accounts")
    .where("id", "=", receiverId)
    .set({ balance: receiver.balance + amount })
    .execute();

  // Both updates commit together, or both roll back on error
});
```

### Manual Transaction Control

For more control, use `.beginTransaction()`:

```typescript
const tx = await db.beginTransaction();

try {
  await tx.insert("users").values({ id: "1", name: "Alice" });
  await tx.insert("profiles").values({ userId: "1", bio: "Developer" });

  await tx.commit(); // Commit changes
} catch (error) {
  await tx.rollback(); // Rollback on error
  throw error;
}
```

### Transaction API

All query and mutation methods work within transactions:

```typescript
await db.transaction(async (tx) => {
  // ✅ Query
  const users = await tx.query("users").all();

  // ✅ Insert
  await tx.insert("todos").values({ id: "1", title: "Task" });

  // ✅ Update
  await tx
    .update("todos")
    .where("id", "=", "1")
    .set({ completed: true })
    .execute();

  // ✅ Delete
  await tx.delete("todos").where("completed", "=", true).execute();
});
```

:::caution[SQLite Limitation]
SQLite doesn't support nested transactions. You must commit or rollback a transaction before starting another one:

```typescript
const tx1 = await db.beginTransaction();
const tx2 = await db.beginTransaction(); // ❌ Error: nested transaction

// ✅ Correct: commit or rollback first
await tx1.commit();
const tx2 = await db.beginTransaction(); // Now OK
```

:::

### Error Handling

Transactions automatically rollback on any error:

```typescript
try {
  await db.transaction(async (tx) => {
    await tx.insert("todos").values({ id: "1", title: "First" });
    await tx.insert("todos").values({ id: "1", title: "Duplicate" }); // ❌ Primary key violation
  });
} catch (error) {
  // Transaction was automatically rolled back
  // First insert is NOT in the database
  console.error("Transaction failed:", error);
}
```

### Validation in Transactions

Zod validation errors also trigger rollback:

```typescript
try {
  await db.transaction(async (tx) => {
    await tx.insert("users").values({
      id: "1",
      email: "alice@example.com",
    });

    // ❌ Invalid email - throws ZodError
    await tx.insert("users").values({
      id: "2",
      email: "not-an-email",
    });
  });
} catch (error) {
  // Both inserts rolled back
}
```

## Batch Operations

Insert multiple rows in a single SQL statement for better performance.

### Batch Insert

Pass an array of objects to `.values()` to insert multiple rows at once:

```typescript
// Insert multiple todos in one operation
await db.insert("todos").values([
  { id: "1", title: "First task", completed: false },
  { id: "2", title: "Second task", completed: true },
  { id: "3", title: "Third task", completed: false },
]);
```

This is much faster than individual inserts:

```typescript
// ❌ Slow - 3 separate SQL statements
for (const todo of todos) {
  await db.insert("todos").values(todo);
}

// ✅ Fast - single SQL statement
await db.insert("todos").values(todos);
```

### Validation

All rows are validated before insertion. If any row fails validation, none are inserted:

```typescript
try {
  await db.insert("users").values([
    { id: 1, name: "Alice", email: "alice@example.com" },
    { id: 2, name: "Bob", email: "not-an-email" }, // ❌ Invalid
    { id: 3, name: "Charlie", email: "charlie@example.com" },
  ]);
} catch (error) {
  // No rows inserted - validation failed on second row
  console.error("Batch insert failed:", error);
}
```

### Empty Arrays

Batch insert handles empty arrays gracefully:

```typescript
await db.insert("todos").values([]); // No-op, returns 0
```

### Type Safety

TypeScript ensures all rows match the schema:

```typescript
// ✅ Valid - all rows have correct types
await db.insert("todos").values([
  { id: "1", title: "Task 1" },
  { id: "2", title: "Task 2" },
]);

// ❌ TypeScript error - missing required field
await db.insert("todos").values([
  { id: "1", title: "Task 1" },
  { id: "2" }, // Missing 'title'
]);
```

## Table Change Notifications

After mutations, notify subscribers to trigger reactive updates:

```typescript
// In a Vue component or reactive context
await db.insert("todos").values({ ... });
db.notifyTable("todos");  // Triggers re-queries in useSQLiteQuery
```

See [Reactive Queries](/vue/reactive-queries/) for more details on the pub/sub system.

## Upsert

SQLite supports `INSERT OR REPLACE` for upsert operations:

```typescript
await db.raw(
  `INSERT OR REPLACE INTO todos (id, title, completed)
   VALUES (?, ?, ?)`,
  ["123", "Updated title", true]
);
```

Or use the conflict clause:

```typescript
await db.raw(
  `INSERT INTO todos (id, title, completed)
   VALUES (?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET
     title = excluded.title,
     completed = excluded.completed`,
  ["123", "Updated title", true]
);
```

## Returning Values

SQLite 3.35+ supports `RETURNING` to get inserted/updated data:

```typescript
const result = await db.raw<{ id: string }>(
  `INSERT INTO todos (id, title) VALUES (?, ?)
   RETURNING id`,
  [crypto.randomUUID(), "New todo"]
);

console.log(result[0].id);
```

## Best Practices

1. **Always validate** - Use Zod schemas for all mutations
2. **Use typed methods** - Prefer `.insert()`, `.update()`, `.delete()` over raw SQL
3. **Use transactions** - Wrap related mutations in `.transaction()` for consistency
4. **Notify subscribers** - Call `.notifyTable()` after mutations in reactive contexts
5. **Be careful with delete** - Always use `.where()` unless you really want to delete everything
6. **Batch when possible** - Use `.insert().values([...])` for multiple row inserts instead of loops
7. **Handle errors** - Transactions automatically rollback on error, but always handle failures gracefully

## Common Patterns

### Soft Delete

Implement soft deletes with an `deletedAt` field:

```typescript
const schema = {
  todos: z.object({
    id: z.string(),
    title: z.string(),
    deletedAt: z.string().nullable().default(null),
  }),
} as const;

// Soft delete
await db
  .update("todos")
  .where("id", "=", "123")
  .set({ deletedAt: new Date().toISOString() })
  .execute();

// Query only non-deleted
const activeTodos = await db.query("todos").where("deletedAt", "=", null).all();
```

### Timestamps

Track creation and modification times:

```typescript
const schema = {
  posts: z.object({
    id: z.string(),
    title: z.string(),
    createdAt: z.string().default(() => new Date().toISOString()),
    updatedAt: z.string().default(() => new Date().toISOString()),
  }),
} as const;

// Create
await db.insert("posts").values({
  id: crypto.randomUUID(),
  title: "My post",
  // createdAt and updatedAt auto-set
});

// Update
await db
  .update("posts")
  .where("id", "=", "123")
  .set({
    title: "Updated title",
    updatedAt: new Date().toISOString(),
  })
  .execute();
```

### Optimistic Updates

Update locally, then sync to database:

```typescript
// 1. Update local state immediately
todos.value = todos.value.map((t) =>
  t.id === id ? { ...t, completed: true } : t
);

// 2. Update database
try {
  await db
    .update("todos")
    .where("id", "=", id)
    .set({ completed: true })
    .execute();

  db.notifyTable("todos");
} catch (error) {
  // 3. Revert on error
  todos.value = await db.query("todos").all();
}
```

## Next Steps

- [Migrations](/core/migrations/) - Learn how to manage schema changes
- [Reactive Queries](/vue/reactive-queries/) - Automatic UI updates with Vue
- [API Reference](/api/mutations/) - Complete mutation API reference
