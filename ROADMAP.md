# SQLite Web - Product Roadmap

## Current Status: Pre-v0.1.0

This document outlines the feature roadmap for SQLite Web, a browser-based SQLite library with TypeScript support and Vue 3 integration.

---

## ✅ Implemented Features (Done)

### Core Package (`@alexop/sqlite-core`)

- **Type-safe Query Builder** - WHERE, SELECT, ORDER BY, LIMIT, SKIP with full type inference
- **Zod Schema Validation** - Compile-time and runtime validation for inserts/updates
- **CRUD Operations** - Complete INSERT, UPDATE, DELETE, SELECT builders
- **Migration System** - Automatic version tracking with `__migrations__` table
- **Pub/Sub System** - Table change notifications for reactive updates
- **Raw SQL Access** - `exec()` and `raw()` methods for advanced queries
- **OPFS Persistence** - File-based storage using Origin Private File System
- **Worker-based Architecture** - Non-blocking database operations

### Vue Package (`@alexop/sqlite-vue`)

- **Vue 3 Plugin** - `createSQLite()` with dependency injection
- **Reactive Composables** - `useSQLiteQuery()` with auto-refresh on table changes
- **Async Client Access** - `useSQLiteClientAsync()` for imperative queries
- **Type-safe Integration** - Full TypeScript support with schema inference

**Note**: Currently requires manual `db.notifyTable()` calls to trigger reactivity. Future versions should implement automatic change detection, eliminating the need for manual notifications in Vue components.

### Testing & Quality

- Comprehensive test coverage:
  - migrations.test.ts
  - pubsub.test.ts
  - mutations.test.ts
  - query-builder.test.ts
  - error-handling.test.ts ✅
  - transactions.test.ts ✅
  - cleanup.test.ts ✅
  - aggregates.test.ts ✅

---

## 🎯 v0.1.0 Release (MVP)

**Goal**: Production-ready library with essential features for most use cases.

**Progress**: 6 of 7 critical/important features completed (86% done!)

- ✅ Transactions (auto-commit/rollback)
- ✅ Batch operations
- ✅ Database cleanup/close
- ✅ Advanced WHERE conditions (OR, IN, LIKE, IS NULL, BETWEEN, AND/OR grouping)
- ✅ Better error handling (SQLiteError, ValidationError, ConstraintError)
- ✅ Aggregation functions (SUM, AVG, MIN, MAX, GROUP BY)
- ⏳ Basic JOIN support (INNER, LEFT) - **REMAINING**

### Critical Features (MUST HAVE)

#### 1. Transaction Support ✅ COMPLETED

**Status**: ✅ Implemented
**Priority**: CRITICAL

```typescript
// Automatic rollback on error
await db.transaction(async (tx) => {
  await tx.insert("users").values({ id: "1", name: "Alice" });
  await tx.insert("posts").values({ userId: "1", title: "First post" });
}); // Commits if successful, rolls back on any error

// Manual control
const tx = await db.beginTransaction();
try {
  await tx.insert("users").values({...});
  await tx.commit();
} catch (e) {
  await tx.rollback();
  throw e;
}
```

**Why**: Data integrity is non-negotiable. Without transactions, apps cannot maintain consistency across related operations.

---

#### 2. Batch Operations ✅ COMPLETED

**Status**: ✅ Implemented
**Priority**: CRITICAL

```typescript
// Bulk inserts (single SQL statement)
await db.insert("todos").values([
  { id: "1", title: "First", completed: false },
  { id: "2", title: "Second", completed: false },
  { id: "3", title: "Third", completed: true },
]);

// Batch updates
await db
  .update("todos")
  .where("completed", "=", false)
  .set({ completed: true })
  .execute(); // Already works, just document it
```

**Why**: Common use case for seeding data, imports, and bulk operations. Significant performance improvement over individual inserts.

---

#### 3. Database Cleanup/Close ✅ COMPLETED

**Status**: ✅ Implemented
**Priority**: CRITICAL

```typescript
// Proper resource cleanup
await db.close(); // Closes worker, flushes OPFS, releases resources

// Check if closed
db.isClosed(); // boolean
```

**Why**: Resource management and memory leaks prevention. Essential for SPA route changes and testing.

---

#### 4. Advanced WHERE Conditions ✅ COMPLETED

**Status**: ✅ Implemented (OR, IN, NOT IN, LIKE, IS NULL, IS NOT NULL, BETWEEN, AND/OR grouping)
**Priority**: HIGH

```typescript
// OR conditions
db.query("todos")
  .where("status", "=", "pending")
  .orWhere("priority", "=", "high")
  .all();

// IN operator
db.query("users").where("id", "in", ["1", "2", "3"]).all();

// NOT IN
db.query("posts").where("status", "not in", ["deleted", "spam"]).all();

// LIKE operator
db.query("todos").where("title", "like", "%urgent%").all();

// IS NULL / IS NOT NULL
db.query("users").where("deletedAt", "is null").all();

// BETWEEN
db.query("orders").where("createdAt", "between", [startDate, endDate]).all();

// Complex conditions with AND/OR grouping
db.query("todos")
  .where((qb) =>
    qb.where("status", "=", "pending").orWhere("priority", "=", "high")
  )
  .where("userId", "=", currentUserId)
  .all();
```

**Why**: Expected from any query builder. Users will immediately need OR, IN, and LIKE for real-world queries.

---

#### 5. Better Error Handling ✅ COMPLETED

**Status**: ✅ Implemented (SQLiteError, ValidationError, ConstraintError)
**Priority**: HIGH

```typescript
// Custom error classes
class SQLiteError extends Error {
  code: string;
  sql?: string;
}

class ValidationError extends SQLiteError {
  field: string;
  issues: ZodIssue[];
}

class ConstraintError extends SQLiteError {
  constraint: string;
}

// Example usage
try {
  await db.insert("users").values({ email: "invalid" });
} catch (e) {
  if (e instanceof ValidationError) {
    console.log(`Field '${e.field}' failed validation:`, e.issues);
  }
}
```

**Why**: Developer experience. Better errors = faster debugging.

---

### Important Features (SHOULD HAVE)

#### 6. Aggregation Functions ✅ COMPLETED

**Status**: ✅ Implemented (SUM, AVG, MIN, MAX, GROUP BY)
**Priority**: MEDIUM

```typescript
// SUM
const total = await db
  .query("orders")
  .where("userId", "=", "123")
  .sum("amount");

// AVG
const average = await db.query("ratings").avg("score");

// MIN/MAX
const oldest = await db.query("users").min("createdAt");

// GROUP BY with aggregates
const userTotals = await db
  .query("orders")
  .select("userId")
  .groupBy("userId")
  .sum("amount", "total")
  .all();
// Returns: [{ userId: "1", total: 500 }, ...]
```

**Why**: Common analytics and reporting queries. Many apps need this.

---

#### 7. Basic JOIN Support

**Status**: Not implemented
**Priority**: MEDIUM

**Type Safety Requirements**:

- Full TypeScript autocomplete for table names in join clauses
- Autocomplete for column names from both joined tables
- Type inference for joined result types
- Compile-time errors for invalid column references across tables

```typescript
// INNER JOIN
const posts = await db
  .query("posts")
  .join("users", "posts.userId", "users.id") // Autocomplete for tables & columns
  .select("posts.title", "users.name") // Autocomplete knows about both tables
  .all();
// Type: { title: string, name: string }[]

// LEFT JOIN
const todos = await db
  .query("todos")
  .leftJoin("users", "todos.assignedTo", "users.id")
  .select("todos.title", "users.name")
  .all();

// Multiple joins
const data = await db
  .query("posts")
  .join("users", "posts.userId", "users.id")
  .leftJoin("comments", "posts.id", "comments.postId")
  .all();
```

**Why**: Relational data is common. Without joins, users resort to manual data stitching or raw SQL.

---

### Nice-to-Have Features (COULD HAVE)

#### 8. Query Debugging

**Status**: Not implemented
**Priority**: LOW

**Type Safety Requirements**:

- Fully typed return values from `toSQL()` method
- Type-safe params array

```typescript
// See generated SQL without executing
const sql = db.query("todos").where("completed", "=", false).toSQL();
// Returns: { sql: "SELECT * FROM todos WHERE completed = ?", params: [false] }
// Type: { sql: string, params: unknown[] }

// Explain query plan
const plan = await db
  .query("todos")
  .where("title", "like", "%urgent%")
  .explain();
```

**Why**: Helps developers understand and optimize queries.

---

#### 9. Index Management

**Status**: Manual via migrations
**Priority**: LOW

**Type Safety Requirements**:

- Autocomplete for table names in `createIndex()` and `dropIndex()`
- Autocomplete for column names from the specified table
- Type-safe validation that columns exist in the table schema

```typescript
// Create index
await db.createIndex("todos", "completed"); // "todos" and "completed" have autocomplete
await db.createIndex("todos", ["userId", "completed"]); // Composite with autocomplete

// Drop index
await db.dropIndex("todos", "idx_completed"); // Table name has autocomplete

// List indexes
const indexes = await db.getIndexes("todos"); // Table name has autocomplete
// Type: { name: string, unique: boolean, columns: string[] }[]
```

**Why**: Performance optimization. Currently possible via raw SQL in migrations, but API would be cleaner.

---

#### 10. Schema Introspection

**Status**: Not implemented
**Priority**: LOW

**Type Safety Requirements**:

- Autocomplete for table names in `getTableSchema()`
- Fully typed return values with proper type inference
- Type-safe table names array from `getTables()`

```typescript
// Get table info
const schema = await db.getTableSchema("todos"); // "todos" has autocomplete
// Type: { columns: Array<{ name: string, type: string, nullable: boolean }>, constraints: ... }

// List all tables
const tables = await db.getTables();
// Type: Array<keyof SchemaRegistry> (returns union of all table names)
```

**Why**: Useful for debugging and building admin UIs.

---

#### 11. Migration Rollback

**Status**: Only forward migrations
**Priority**: LOW

```typescript
// Migration with up/down
const migrations = [
  {
    version: 1,
    up: "CREATE TABLE users (...)",
    down: "DROP TABLE users",
  },
];

// Rollback to version
await db.rollbackTo(0); // Back to empty DB
```

**Why**: Development and deployment safety. Not critical for v0.1.0.

---

## 🚀 v0.2.0 and Beyond

Features deferred to future releases:

**Note**: All features in future versions must maintain full TypeScript type safety with autocomplete support wherever possible.

### v0.2.0 (Enhanced Querying)

- Full JOIN support (RIGHT JOIN, CROSS JOIN, self-joins) - with full type inference
- Subqueries and CTEs (Common Table Expressions) - with type-safe column references
- HAVING clause for grouped queries - with autocomplete for aggregate columns
- DISTINCT queries - with proper type inference
- UNION/INTERSECT/EXCEPT operations - with type-safe combining of compatible result types

### v0.3.0 (Advanced Features)

- Connection pooling (multiple workers)
- Query result streaming for large datasets
- Full-text search (FTS5 extension)
- Virtual tables support
- Prepared statements caching

### v0.4.0 (Framework Integrations)

- **Automatic Vue Reactivity** - Eliminate manual `db.notifyTable()` calls by detecting mutations automatically
- React hooks package (`@alexop/sqlite-react`)
- Svelte stores package (`@alexop/sqlite-svelte`)
- Solid.js signals package (`@alexop/sqlite-solid`)

### v0.5.0 (Developer Experience)

- DevTools browser extension
- Query performance monitoring
- Migration generator CLI
- Schema diff tool

---

## 📦 Pre-Release Checklist for v0.1.0

### Features

- [x] Transactions (auto-commit/rollback) ✅
- [x] Batch insert operations ✅
- [x] Advanced WHERE (OR, IN, LIKE, IS NULL, BETWEEN) ✅
- [x] Database close/cleanup method ✅
- [x] Better error handling (custom error classes) ✅
- [x] Aggregation functions (SUM, AVG, MIN, MAX, GROUP BY) ✅
- [ ] Basic JOIN support (INNER, LEFT)

### Testing

- [ ] Test coverage >80%
- [x] Transaction tests (commit, rollback, nested) ✅
- [x] Batch operation tests ✅
- [x] Advanced WHERE clause tests ✅
- [ ] JOIN query tests
- [x] Error handling tests ✅
- [ ] Browser compatibility tests (Chrome, Firefox, Safari)
- [ ] Performance benchmarks (1k, 10k, 100k rows)

### Documentation

- [ ] README updates with installation and quick start
- [ ] API reference documentation
- [ ] Migration guide
- [ ] Advanced usage examples
- [ ] Vue integration guide
- [ ] Browser compatibility matrix
- [ ] Performance best practices
- [ ] CHANGELOG.md with v0.1.0 features
- [ ] LICENSE file (MIT)

### Repository

- [ ] GitHub issue templates
- [ ] Contributing guidelines
- [ ] Code of conduct
- [ ] CI/CD pipeline (tests, build, publish)
- [ ] Automated npm publishing on tag
- [ ] Automated documentation deployment

### Examples

- [ ] Todo app (already exists)
- [ ] Multi-user blog example
- [ ] E-commerce cart example
- [ ] Real-time collaboration example

### Package Quality

- [ ] Bundle size analysis
- [ ] Tree-shaking verification
- [x] TypeScript strict mode enabled ✅
- [x] Full type safety with autocomplete for all APIs ✅
- [ ] No dependency vulnerabilities
- [ ] Semantic versioning strategy documented

---

## 🎯 Recommended Implementation Order

1. **Week 1-2: Critical Features**
   - Transaction support
   - Database close/cleanup
   - Better error handling

2. **Week 3: Batch & Query Enhancement**
   - Batch insert operations
   - Advanced WHERE conditions (OR, IN, LIKE)

3. **Week 4: Aggregations & Joins**
   - Aggregation functions (SUM, AVG, etc.)
   - Basic JOIN support

4. **Week 5: Testing & Polish**
   - Comprehensive test coverage
   - Performance benchmarks
   - Bug fixes

5. **Week 6: Documentation & Release**
   - API documentation
   - Usage examples
   - v0.1.0 release

---

## 📊 Success Metrics for v0.1.0

- **Test Coverage**: >80%
- **Bundle Size**: <50KB (core package)
- **Performance**: Handle 10k+ rows efficiently
- **TypeScript**: 100% type coverage, no `any` types
- **Documentation**: Complete API reference + 3+ examples
- **GitHub Stars**: 100+ in first month
- **npm Downloads**: 500+ in first month
- **Issues**: <5 open bugs at release time

---

## 💡 Future Ideas (Backlog)

- **Offline-first sync**: Sync with remote database when online
- **Encryption**: Transparent encryption at rest
- **Backup/Export**: JSON/CSV export functionality
- **Query builder UI**: Visual query builder component
- **Schema migrations**: Auto-generate from Zod schema changes
- **Observables**: RxJS integration for reactive streams
- **WebSocket sync**: Real-time multi-tab synchronization

---

**Last Updated**: 2025-11-03
**Version**: 0.0.0 (Pre-release)
**Next Milestone**: v0.1.0 MVP Release
