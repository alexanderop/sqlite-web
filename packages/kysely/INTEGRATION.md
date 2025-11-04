# Kysely Integration Architecture

This document explains how `@alexop/sqlite-kysely` integrates your `@alexop/sqlite-core` client with the Kysely query builder.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         User Code                            │
│  const db = new Kysely<Database>({                           │
│    dialect: new SqliteWebDialect({ ... })                    │
│  })                                                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Kysely Query Builder                       │
│  - Type-safe query building (SELECT, INSERT, UPDATE, etc.)   │
│  - Query compilation to SQL strings                          │
│  - Result type inference                                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   SqliteWebDialect                            │
│  Implements: Kysely's Dialect interface                      │
│  - createDriver() → SqliteWebDriver                          │
│  - createQueryCompiler() → SqliteQueryCompiler               │
│  - createAdapter() → SqliteAdapter                           │
│  - createIntrospector() → SqliteIntrospector                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     SqliteWebDriver                           │
│  Implements: Kysely's Driver interface                       │
│  - Manages connection lifecycle                              │
│  - Handles transactions (BEGIN, COMMIT, ROLLBACK)            │
│  - Wraps SqliteWebConnection                                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  SqliteWebConnection                          │
│  Implements: Kysely's DatabaseConnection interface           │
│  - executeQuery() → executes SQL via core client             │
│  - Extracts insertId using last_insert_rowid()               │
│  - Gets affected rows using changes()                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  @alexop/sqlite-core                          │
│                    (SQLiteClient)                             │
│  - exec() for mutations                                      │
│  - raw() for queries                                         │
│  - SQLite WASM worker communication                          │
│  - OPFS persistence                                          │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. SqliteWebDialect

The dialect is the entry point that tells Kysely how to work with your SQLite implementation.

**Responsibilities:**
- Instantiates the driver with your core client
- Uses Kysely's built-in SQLite query compiler (no need to reimplement!)
- Uses Kysely's built-in SQLite adapter for dialect-specific SQL features
- Uses Kysely's built-in SQLite introspector for schema metadata

**Why this works:**
- Kysely already knows how to generate SQLite SQL syntax
- We just need to provide the execution layer (driver + connection)

### 2. SqliteWebDriver

Manages the database connection lifecycle and transaction control.

**Responsibilities:**
- Initialize the client via the factory function
- Provide a single connection (no pooling needed in browser)
- Handle transaction boundaries:
  - `BEGIN TRANSACTION`
  - `COMMIT`
  - `ROLLBACK`

**Key Design Decision:**
- Browser SQLite WASM runs in a single worker thread
- No connection pooling needed (unlike Node.js databases)
- We maintain one persistent connection per driver instance

### 3. SqliteWebConnection

Adapts your core client's API to Kysely's DatabaseConnection interface.

**Responsibilities:**
- Execute compiled SQL queries
- Distinguish between queries that return rows (SELECT) vs mutations (INSERT/UPDATE/DELETE)
- Extract metadata for INSERT operations (insertId, numAffectedRows)

**Key Implementation Details:**

```typescript
// For SELECT queries - return rows directly
if (isSelectQuery) {
  const rows = await this.client.raw<R>(sql, params);
  return { rows };
}

// For INSERT/UPDATE/DELETE - get metadata
await this.client.exec(sql, params);

// Get insertId for INSERT statements
const [{ last_insert_rowid }] = await this.client.raw(
  "SELECT last_insert_rowid() as last_insert_rowid"
);

// Get affected rows count
const [{ changes }] = await this.client.raw(
  "SELECT changes() as changes"
);

return {
  rows: [],
  numAffectedRows: BigInt(changes),
  insertId: BigInt(last_insert_rowid)
};
```

## Data Flow Example

Let's trace a query through the system:

```typescript
// User writes:
const users = await db
  .selectFrom('users')
  .select(['name', 'email'])
  .where('name', 'like', 'A%')
  .execute();
```

**Step-by-step execution:**

1. **Kysely Query Builder** builds an AST (Abstract Syntax Tree) representing the query

2. **SqliteQueryCompiler** (Kysely built-in) compiles AST to SQL:
   ```sql
   SELECT name, email FROM users WHERE name LIKE ?
   ```
   Parameters: `['A%']`

3. **SqliteWebDriver** acquires the connection (returns the single SqliteWebConnection)

4. **SqliteWebConnection.executeQuery()** receives:
   ```typescript
   {
     sql: "SELECT name, email FROM users WHERE name LIKE ?",
     parameters: ['A%']
   }
   ```

5. **Connection detects it's a SELECT** (via regex) and calls:
   ```typescript
   const rows = await this.client.raw(sql, params);
   ```

6. **@alexop/sqlite-core client** forwards to SQLite WASM worker:
   ```typescript
   await promiser("exec", {
     dbId,
     sql: "SELECT name, email FROM users WHERE name LIKE ?",
     bind: ['A%'],
     returnValue: "resultRows",
     rowMode: "object"
   });
   ```

7. **SQLite WASM** executes the query against OPFS-backed database

8. **Results bubble back up** through the stack with full type safety

## Benefits of This Architecture

### ✅ Separation of Concerns
- **Core package** handles SQLite WASM, OPFS, and worker communication
- **Kysely package** handles query building and type safety
- Clear interfaces between layers

### ✅ Leverage Kysely's Ecosystem
- Don't reinvent SQL compilation
- Get all Kysely features for free (joins, subqueries, CTEs, etc.)
- Benefit from Kysely's mature testing and bug fixes

### ✅ Type Safety Throughout
```typescript
interface Database {
  users: { id: number; name: string; email: string };
}

// TypeScript knows this returns { name: string; email: string }[]
const users = await db
  .selectFrom('users')
  .select(['name', 'email'])
  .execute();

// TypeScript error: "age" doesn't exist on users
const invalid = await db
  .selectFrom('users')
  .select(['age']) // ❌ Error!
  .execute();
```

### ✅ Flexibility for Users
Developers can choose:
- **Raw SQL** with `@alexop/sqlite-core` for simple queries
- **Query builder** with `@alexop/sqlite-kysely` for complex queries
- **Mix both** in the same application

## Testing Strategy

The test suite validates the entire integration:

```typescript
// From dialect.test.ts
describe("SqliteWebDialect", () => {
  it("should insert a row using Kysely query builder", async () => { ... });
  it("should query rows using Kysely query builder", async () => { ... });
  it("should support WHERE clauses", async () => { ... });
  it("should support JOIN queries", async () => { ... });
  it("should support transactions", async () => { ... });
  it("should rollback transactions on error", async () => { ... });
});
```

Each test verifies:
1. Query builder syntax works correctly
2. SQL is executed via the core client
3. Results have correct types and values
4. Transactions maintain ACID properties

## Future Enhancements

Possible improvements:

1. **Streaming Support**
   - Currently `streamQuery()` falls back to `executeQuery()`
   - Could implement true streaming for large result sets

2. **Connection Pooling**
   - Not needed in browser, but could be useful for Node.js SSR scenarios
   - Would require multiple SQLite WASM workers

3. **Query Caching**
   - Cache compiled queries for better performance
   - Kysely supports this via plugins

4. **Schema Migration Integration**
   - Could integrate with Kysely's schema builder
   - Generate migrations automatically from type definitions

## Comparison with Other Approaches

### Option 1: Custom Query Builder ❌
**What you could have done:** Build a custom query builder from scratch

**Why we didn't:**
- Reinventing the wheel
- Less type-safe than Kysely
- Missing advanced features (CTEs, window functions, etc.)
- More maintenance burden

### Option 2: Kysely Dialect ✅ (What we did)
**Benefits:**
- Battle-tested query builder
- Huge ecosystem and community
- Professional-grade type inference
- Only need to implement execution layer

### Option 3: Use Kysely + Generic SQLite Dialect ❌
**Why not:**
- Generic dialects assume Node.js environment
- Don't understand browser WASM constraints
- Miss OPFS-specific optimizations
- Less control over worker communication

## Conclusion

This architecture provides the best of both worlds:

- **Minimal core package** - Does one thing well (SQLite WASM in browser)
- **Powerful query builder** - Leverages industry-standard tool (Kysely)
- **Clean separation** - Easy to maintain, test, and extend
- **Developer choice** - Use raw SQL, query builder, or both

The key insight: **Don't build what already exists**. Kysely handles query building brilliantly. We just needed to connect it to your browser-based SQLite implementation.
