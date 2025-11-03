---
title: Query Builder
description: Master the type-safe query builder API
---

The query builder provides a fluent, chainable API for querying your SQLite database with full TypeScript type safety.

## Basic Queries

Start a query with `db.query(tableName)`:

```typescript
const todos = await db.query("todos").all();
// Returns all rows from the todos table
```

## Where Clauses

Filter results with `.where()`:

```typescript
// Single condition
const completedTodos = await db.query("todos")
  .where("completed", "=", true)
  .all();

// Multiple conditions (AND)
const recentTodos = await db.query("todos")
  .where("completed", "=", false)
  .where("createdAt", ">", "2024-01-01")
  .all();
```

### Supported Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `=` | `.where("id", "=", "123")` | Equality |
| `!=` | `.where("status", "!=", "deleted")` | Inequality |
| `>` | `.where("age", ">", 18)` | Greater than |
| `>=` | `.where("age", ">=", 18)` | Greater than or equal |
| `<` | `.where("price", "<", 100)` | Less than |
| `<=` | `.where("price", "<=", 100)` | Less than or equal |
| `LIKE` | `.where("name", "LIKE", "%John%")` | Pattern matching |
| `IN` | `.where("status", "IN", ["active", "pending"])` | Value in list |
| `NOT IN` | `.where("status", "NOT IN", ["deleted", "spam"])` | Value not in list |
| `IS NULL` | `.where("deletedAt", "IS NULL", null)` | Check for NULL values |
| `IS NOT NULL` | `.where("deletedAt", "IS NOT NULL", null)` | Check for non-NULL values |
| `BETWEEN` | `.where("age", "BETWEEN", [18, 65])` | Value in range (inclusive) |

:::tip
The `IN` and `NOT IN` operators accept an array of values and generate `WHERE column IN (?, ?, ...)` SQL.
:::

### OR Conditions

By default, multiple `.where()` calls are combined with `AND`. Use `.orWhere()` to combine conditions with `OR`:

```typescript
// Get completed OR high priority todos
const todos = await db.query("todos")
  .where("completed", "=", true)
  .orWhere("priority", "=", "high")
  .all();
// SQL: WHERE completed = 1 OR priority = 'high'

// Mix AND and OR - conditions are evaluated left to right
const todos = await db.query("todos")
  .where("userId", "=", "user1")
  .where("completed", "=", false)
  .orWhere("priority", "=", "urgent")
  .all();
// SQL: WHERE userId = 'user1' AND completed = 0 OR priority = 'urgent'
```

### Advanced WHERE Conditions

#### NOT IN Operator

Exclude multiple values:

```typescript
// Get todos that are neither deleted nor spam
const todos = await db.query("todos")
  .where("status", "NOT IN", ["deleted", "spam"])
  .all();
```

#### NULL Checks

Check for NULL or non-NULL values:

```typescript
// Get active todos (not deleted)
const activeTodos = await db.query("todos")
  .where("deletedAt", "IS NULL", null)
  .all();

// Get deleted todos
const deletedTodos = await db.query("todos")
  .where("deletedAt", "IS NOT NULL", null)
  .all();
```

#### BETWEEN Operator

Filter values within a range:

```typescript
// Get users between 18 and 65 years old
const adults = await db.query("users")
  .where("age", "BETWEEN", [18, 65])
  .all();

// Get orders from date range
const orders = await db.query("orders")
  .where("createdAt", "BETWEEN", ["2024-01-01", "2024-12-31"])
  .all();
```

:::note
The `BETWEEN` operator is inclusive - it includes both boundary values.
:::

### Complex AND/OR Grouping

Use callback functions to create grouped conditions with parentheses:

```typescript
// Get todos that are (completed OR high priority) AND belong to user1
const todos = await db.query("todos")
  .where((qb) =>
    qb.where("completed", "=", true)
      .orWhere("priority", "=", "high")
  )
  .where("userId", "=", "user1")
  .all();
// SQL: WHERE (completed = 1 OR priority = 'high') AND userId = 'user1'

// Complex nested conditions
const results = await db.query("todos")
  .where((qb) =>
    qb.where("status", "=", "pending")
      .orWhere("status", "=", "in-progress")
  )
  .where("assignedTo", "=", currentUserId)
  .where("dueDate", "<", tomorrow)
  .all();
// SQL: WHERE (status = 'pending' OR status = 'in-progress')
//      AND assignedTo = 'user1' AND dueDate < '2024-01-01'
```

This pattern is useful for implementing "filters" where you want to match any of several conditions, then combine with other required conditions.

## Selecting Columns

Use `.select()` to choose specific columns:

```typescript
// Select specific columns
const titles = await db.query("todos")
  .select("id", "title")
  .all();
// Type: Array<{ id: string, title: string }>

// Select single column
const ids = await db.query("todos")
  .select("id")
  .all();
// Type: Array<{ id: string }>
```

Without `.select()`, all columns are returned:

```typescript
const todos = await db.query("todos").all();
// Type: Array<{ id: string, title: string, completed: boolean, createdAt: string }>
```

## Ordering

Sort results with `.orderBy()`:

```typescript
// Ascending order (default)
const todos = await db.query("todos")
  .orderBy("createdAt", "ASC")
  .all();

// Descending order
const todos = await db.query("todos")
  .orderBy("createdAt", "DESC")
  .all();

// Multiple columns
const todos = await db.query("todos")
  .orderBy("completed", "ASC")
  .orderBy("createdAt", "DESC")
  .all();
```

## Limiting Results

Use `.limit()` and `.skip()` for pagination:

```typescript
// Get first 10 results
const page1 = await db.query("todos")
  .limit(10)
  .all();

// Get next 10 results
const page2 = await db.query("todos")
  .skip(10)
  .limit(10)
  .all();

// Pagination helper
function paginateTodos(page: number, pageSize: number) {
  return db.query("todos")
    .skip(page * pageSize)
    .limit(pageSize)
    .all();
}
```

## Query Execution Methods

### `.all()`

Returns all matching rows as an array:

```typescript
const todos = await db.query("todos").all();
// Type: Array<Todo>
```

### `.first()`

Returns the first matching row or `null`:

```typescript
const todo = await db.query("todos")
  .where("id", "=", "123")
  .first();
// Type: Todo | null

if (todo) {
  console.log(todo.title);
}
```

### `.count()`

Returns the number of matching rows:

```typescript
const totalTodos = await db.query("todos").count();
// Type: number

const completedCount = await db.query("todos")
  .where("completed", "=", true)
  .count();
```

## Aggregation Functions

The query builder supports aggregate functions for analytics and reporting. Each aggregate can be used in two ways:

1. **Terminal operation** - Returns the aggregate value immediately
2. **Chainable operation** - Adds aggregate for use with `GROUP BY`

### `.sum()`

Calculate sum of numeric values:

```typescript
// Terminal operation - get total
const totalRevenue = await db.query("orders").sum("amount");
// Type: number (returns 0 if no rows)

// With WHERE clause
const userTotal = await db.query("orders")
  .where("userId", "=", "user123")
  .sum("amount");

// Chainable with GROUP BY
const userTotals = await db.query("orders")
  .select("userId")
  .sum("amount", "total")
  .groupBy("userId")
  .all();
// Type: Array<{ userId: string, total: number }>
```

### `.avg()`

Calculate average of numeric values:

```typescript
// Terminal operation
const avgPrice = await db.query("products").avg("price");
// Type: number (returns 0 if no rows)

// With WHERE clause
const avgRating = await db.query("reviews")
  .where("productId", "=", "prod123")
  .avg("rating");

// Chainable with GROUP BY
const avgsByCategory = await db.query("products")
  .select("category")
  .avg("price", "avgPrice")
  .groupBy("category")
  .all();
// Type: Array<{ category: string, avgPrice: number }>
```

### `.min()`

Find minimum value:

```typescript
// Terminal operation
const lowestPrice = await db.query("products").min("price");
// Type: number | null (returns null if no rows)

// With WHERE clause
const earliestDate = await db.query("orders")
  .where("status", "=", "completed")
  .min("createdAt");

// Chainable with GROUP BY
const minPrices = await db.query("products")
  .select("category")
  .min("price", "minPrice")
  .groupBy("category")
  .all();
// Type: Array<{ category: string, minPrice: number }>
```

### `.max()`

Find maximum value:

```typescript
// Terminal operation
const highestPrice = await db.query("products").max("price");
// Type: number | null (returns null if no rows)

// With WHERE clause
const latestDate = await db.query("orders")
  .where("userId", "=", "user123")
  .max("createdAt");

// Chainable with GROUP BY
const maxPrices = await db.query("products")
  .select("category")
  .max("price", "maxPrice")
  .groupBy("category")
  .all();
// Type: Array<{ category: string, maxPrice: number }>
```

### `.groupBy()`

Group results by one or more columns (must be used with aggregate functions):

```typescript
// Group by single column
const statusTotals = await db.query("orders")
  .select("status")
  .sum("amount", "total")
  .groupBy("status")
  .all();
// Returns: [{ status: "pending", total: 500 }, { status: "completed", total: 1200 }]

// Group by multiple columns
const userStatusTotals = await db.query("orders")
  .select("userId", "status")
  .sum("amount", "total")
  .groupBy("userId", "status")
  .all();
// Returns: [{ userId: "user1", status: "completed", total: 300 }, ...]

// Multiple aggregates
const stats = await db.query("orders")
  .select("userId")
  .sum("amount", "total")
  .avg("amount", "average")
  .min("amount", "minOrder")
  .max("amount", "maxOrder")
  .groupBy("userId")
  .all();
// Returns: [{ userId: "user1", total: 500, average: 100, minOrder: 50, maxOrder: 200 }]

// With WHERE and ORDER BY
const topUsers = await db.query("orders")
  .where("status", "=", "completed")
  .select("userId")
  .sum("amount", "total")
  .groupBy("userId")
  .orderBy("total", "DESC")
  .limit(10)
  .all();
```

:::tip
When using `GROUP BY`, always call `.select()` to specify which columns you're grouping by. This ensures type safety and correct SQL generation.
:::

:::note
- `sum()` and `avg()` return `0` when no rows match (not `null`)
- `min()` and `max()` return `null` when no rows match
- Terminal operations (without alias) execute immediately and return a Promise
- Chainable operations (with alias) must be used with `groupBy()` and `.all()`
:::

### Common Aggregation Patterns

#### Sales Reports

```typescript
// Monthly revenue by category
const monthlyRevenue = await db.query("orders")
  .where("status", "=", "completed")
  .select("category", "month")
  .sum("amount", "revenue")
  .groupBy("category", "month")
  .orderBy("month", "DESC")
  .all();
```

#### User Analytics

```typescript
// User activity statistics
const userStats = await db.query("orders")
  .select("userId")
  .sum("amount", "totalSpent")
  .avg("amount", "avgOrderValue")
  .groupBy("userId")
  .orderBy("totalSpent", "DESC")
  .limit(100)
  .all();
```

#### Product Statistics

```typescript
// Product price ranges by category
const priceRanges = await db.query("products")
  .where("inStock", "=", true)
  .select("category")
  .min("price", "minPrice")
  .max("price", "maxPrice")
  .avg("price", "avgPrice")
  .groupBy("category")
  .all();
```

## Chaining

Chain methods to build complex queries:

```typescript
const results = await db.query("todos")
  .where("completed", "=", false)
  .where("priority", "IN", ["high", "urgent"])
  .orderBy("createdAt", "DESC")
  .skip(0)
  .limit(20)
  .select("id", "title", "priority")
  .all();

// Type: Array<{ id: string, title: string, priority: string }>
```

The order of most methods doesn't matter, except:
- `.select()` should come before `.all()` or `.first()`
- `.limit()` and `.skip()` should come at the end
- `.count()`, `.all()`, `.first()` must be last (they execute the query)

## Type Safety

The query builder maintains full type safety throughout the chain:

```typescript
const dbSchema = {
  users: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    age: z.number(),
  })
} as const;

// ✅ Valid - 'users' table exists
db.query("users")

// ❌ TypeScript error - 'invalid' table doesn't exist
db.query("invalid")

// ✅ Valid - 'name' column exists
db.query("users").where("name", "=", "Alice")

// ❌ TypeScript error - 'invalid' column doesn't exist
db.query("users").where("invalid", "=", "value")

// ✅ Valid - string value for string column
db.query("users").where("name", "=", "Alice")

// ❌ TypeScript error - number value for string column
db.query("users").where("name", "=", 42)

// ✅ Valid - selecting existing columns
db.query("users").select("id", "name")

// ❌ TypeScript error - selecting non-existent column
db.query("users").select("invalid")
```

## Advanced Patterns

### Reusable Queries

Store query builders for reuse:

```typescript
function getActiveTodos() {
  return db.query("todos")
    .where("completed", "=", false)
    .where("deletedAt", "=", null);
}

// Use the builder
const recent = await getActiveTodos()
  .orderBy("createdAt", "DESC")
  .limit(10)
  .all();

const highPriority = await getActiveTodos()
  .where("priority", "=", "high")
  .all();
```

### Dynamic Filtering

Build queries dynamically:

```typescript
function searchTodos(filters: {
  completed?: boolean;
  priorities?: string[];
  excludeStatuses?: string[];
  search?: string;
  includeDeleted?: boolean;
}) {
  let query = db.query("todos");

  if (filters.completed !== undefined) {
    query = query.where("completed", "=", filters.completed);
  }

  if (filters.priorities && filters.priorities.length > 0) {
    query = query.where("priority", "IN", filters.priorities);
  }

  if (filters.excludeStatuses && filters.excludeStatuses.length > 0) {
    query = query.where("status", "NOT IN", filters.excludeStatuses);
  }

  if (filters.search) {
    query = query.where("title", "LIKE", `%${filters.search}%`);
  }

  if (!filters.includeDeleted) {
    query = query.where("deletedAt", "IS NULL", null);
  }

  return query.all();
}

// Use it
const results = await searchTodos({
  completed: false,
  priorities: ["high", "urgent"],
  excludeStatuses: ["spam", "archived"],
  search: "bug",
  includeDeleted: false
});
```

### Pagination

Create a pagination helper:

```typescript
async function paginate<T>(
  query: QueryBuilder<T>,
  page: number,
  pageSize: number
) {
  const total = await query.count();
  const data = await query
    .skip(page * pageSize)
    .limit(pageSize)
    .all();

  return {
    data,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize)
  };
}

// Use it
const result = await paginate(
  db.query("todos").where("completed", "=", false),
  0,
  20
);
```

## Raw SQL Access

For complex queries not supported by the builder, use `.raw()`:

```typescript
const results = await db.raw<CustomType>(
  "SELECT * FROM todos WHERE title LIKE ? AND completed = ?",
  ["%urgent%", false]
);
```

See the [API Reference](/api/raw-sql/) for more details on raw SQL.

## Next Steps

- [Mutations](/core/mutations/) - Learn how to insert, update, and delete data
- [Migrations](/core/migrations/) - Manage schema changes over time
- [Type Safety Guide](/guides/type-safety/) - Advanced type safety patterns
