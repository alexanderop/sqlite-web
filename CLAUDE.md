# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Workflow

**Always use Test-Driven Development (TDD) as Kent Beck describes in "Test Driven Development: By Example":**

1. **Red** - Write failing tests first (`packages/core/src/__tests__/*.test.ts`)
2. **Green** - Implement minimal code to make tests pass
3. **Refactor** - Clean up implementation while keeping tests green
4. **Document** - Update Astro docs (`docs/src/content/docs/**/*.md`) with examples and API details

**Test Writing Guidelines:**
- Focus on the **main happy path** - test the primary use case first
- Add **critical error cases** only (validation failures, constraint violations)
- Avoid exhaustive edge case testing - trust the implementation for minor variations
- Keep test suites small and maintainable (~5-10 tests per feature)
- Example: For transactions, test basic commit/rollback, not every possible error combination

**Documentation Rules:**
- Keep CLAUDE.md minimal - only essential context for development
- All feature documentation, examples, and usage patterns go in Astro docs
- After implementing a feature, always update relevant docs pages

## Project Overview

SQLite Web is a browser-based SQLite library using WASM and OPFS (Origin Private File System) for persistent storage. It provides a **type-safe TypeScript API** with **Zod schema validation** and a **query builder pattern** inspired by Nuxt Content's queryCollection API. Includes Vue 3 integration through composables and plugins.

## Monorepo Structure

This is a pnpm workspace monorepo with two core packages and examples:

- **`packages/core`** (`@alexop/sqlite-core`): Framework-agnostic SQLite client using sqlite-wasm
- **`packages/vue`** (`@alexop/sqlite-vue`): Vue 3 plugin and composables (depends on core)
- **`examples/vue-app`**: Example Vue application

Workspace dependencies use `workspace:*` protocol (e.g., `@alexop/sqlite-core: workspace:*` in vue package).

## Build Commands

```bash
# Install all dependencies
pnpm install

# Build all packages (must build core before vue due to dependency)
pnpm build
# or
pnpm -r run build

# Build specific package
pnpm --filter @alexop/sqlite-core build
pnpm --filter @alexop/sqlite-vue build

# Run Vue example app
pnpm dev:vue
```

## Architecture

### Core Package (`@alexop/sqlite-core`)

The core package wraps sqlite-wasm's worker-based API with a type-safe query builder:

- **Schema Definition**: Uses Zod schemas to define table structure and enable type inference
- **Initialization**: Lazy initialization on first query. Creates SQLite worker and opens database with OPFS VFS
- **Worker Communication**: Uses `sqlite3Worker1Promiser` for async communication with the SQLite worker
- **Migration System**: Runs migrations sorted by version number during initialization
- **Pub/Sub**: Custom event emitter for table change notifications (Map-based, table -> Set<callback>)
- **Query Builder API**: Chainable query builder inspired by Nuxt Content's queryCollection
  - `query(table)`: Start a SELECT query with full type inference
  - `insert(table)`: Insert with Zod validation
  - `update(table)`: Update with WHERE conditions and Zod validation
  - `delete(table)`: Delete with WHERE conditions
  - `exec()` and `raw()`: Direct SQL access for advanced usage

Key implementation details:
- Schema registry provides compile-time type safety for table names, column names, and values
- Query builder methods (`where`, `select`, `orderBy`, `limit`, `skip`) are fully typed
- Results use `rowMode: "object"` to return objects instead of arrays
- `select()` narrows return type to only selected fields
- Zod validates data on insert/update operations
- Each client instance maintains its own worker and database connection

**Type System Architecture**:
- `SchemaRegistry`: Maps table names to Zod schemas
- `TableRow<TSchema, TTable>`: Infers row type from schema
- `QueryResult<TRow, TSelected>`: Conditional type for select projection
- All builder methods preserve and narrow types through the chain

### Vue Package (`@alexop/sqlite-vue`)

Provides Vue integration through dependency injection:

- **Plugin**: `createSQLite()` installs plugin with schema, provides `Promise<SQLiteClient>` via injection key
- **Composables**:
  - `useSQLiteClientAsync()`: Returns the client promise (must be called during setup, not inside async functions)
  - `useSQLiteQuery()`: Reactive query composable that accepts a query builder function and auto-subscribes to table changes

**Critical Vue Pattern**: `useSQLiteClientAsync()` must be called during component setup (not inside async functions) because it uses `inject()`. Store the promise, then await it later:

```typescript
// Correct: Call inject() during setup
const dbPromise = useSQLiteClientAsync();

async function addTodo() {
  const db = await dbPromise; // Await the stored promise
  await db.insert("todos").values({ title: "New todo" });
  db.notifyTable("todos");
}
```

### Reactive Query Flow

1. `useSQLiteQuery()` accepts a function that receives the DB client and returns a promise (query builder result)
2. On mount, awaits client and executes the query function
3. Subscribes to specified tables via the `tables` option
4. When `db.notifyTable(table)` is called, all subscribers re-run their queries
5. Returns reactive refs for `rows`, `loading`, `error`, and `refresh()`

## Browser Requirements

SQLite WASM requires specific headers for SharedArrayBuffer support:

```typescript
// vite.config.ts
server: {
  headers: {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp"
  }
},
optimizeDeps: {
  exclude: ["@sqlite.org/sqlite-wasm"]
}
```

## Testing

Run tests for packages:

```bash
# Core package tests
pnpm --filter @alexop/sqlite-core test

# Vue package tests
pnpm --filter @alexop/sqlite-vue test

# Run all tests
pnpm -r test
```

## Publishing

```bash
# Build first
pnpm -r run build

# Publish packages
cd packages/core && npm publish --access public
cd packages/vue && npm publish --access public
```

## Key Implementation Notes

- **Type Safety**: Schema registry maps table names to Zod schemas for compile-time safety
- **Worker Communication**: Uses `sqlite3Worker1Promiser` for async SQLite operations
- **Vue Pattern**: `useSQLiteClientAsync()` must be called during component setup (uses `inject()`)
- **Pub/Sub**: `notifyTable()` triggers reactive updates in Vue components
- **Transactions**: Automatic commit/rollback with `.transaction()` or manual with `.beginTransaction()`

For detailed usage examples and API documentation, see `docs/src/content/docs/`.
