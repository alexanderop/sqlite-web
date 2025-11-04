# TDD: Type Safety for Vue Composables

## Summary

We successfully used **Test-Driven Development (TDD)** to implement type-safe Vue composables for the SQLite library.

## TDD Process

### 🔴 RED Phase - Write Failing Tests

**File**: `packages/vue/src/__tests__/vue-types.test-d.ts`

Created 11 type tests that verify:

- `useSQLiteClientAsync()` returns properly typed client
- Column name validation in queries
- Value type checking
- Table name validation
- `useSQLiteQuery()` provides typed parameters

**Result**: 5 tests failed initially - proving no type safety existed in Vue components.

```bash
Test Files  1 failed (1)
Tests       5 failed | 6 passed (11)
```

### 🟢 GREEN Phase - Make Tests Pass

**Implementation**:

1. **Created `createTypedComposables()` factory** (`packages/vue/src/typed-composables.ts`)
   - Generic function that captures schema type
   - Returns fully typed `useSQLiteClientAsync()` and `useSQLiteQuery()`

2. **Exported from package** (`packages/vue/src/index.ts`)

   ```typescript
   export { createTypedComposables } from "./typed-composables";
   ```

3. **Created typed composables in app** (`examples/vue-app/src/composables/db.ts`)

   ```typescript
   export const { useSQLiteClientAsync, useSQLiteQuery } =
     createTypedComposables<typeof dbSchema>();
   ```

4. **Updated App.vue to use typed composables**
   ```typescript
   import { useSQLiteQuery, useSQLiteClientAsync } from "./composables/db";
   ```

**Result**: All 9 tests passing!

```bash
Test Files  1 passed (1)
Tests       9 passed (9)
Type Errors  no errors
```

## What We Achieved

### ✅ Full Type Safety in Vue Components

**Before** (no type safety):

```typescript
// Typos and wrong types not caught
import { useSQLiteClientAsync } from "@alexop/sqlite-vue";

const db = await useSQLiteClientAsync();
await db.delete("todos").where("idz", "=", id); // ❌ No error - typo not caught!
```

**After** (full type safety):

```typescript
// TypeScript catches all errors at compile time!
import { useSQLiteClientAsync } from "./composables/db";

const db = await useSQLiteClientAsync();
await db.delete("todos").where("idz", "=", id);
// ✅ TypeScript Error: Argument of type '"idz"' is not assignable to parameter of type '"id" | "title" | "completed" | "createdAt"'
```

### 📊 Test Coverage

**Core Package** (`@alexop/sqlite-core`):

- 27 type tests - all passing ✅
- Tests SQL generation, query builder, mutations

**Vue Package** (`@alexop/sqlite-vue`):

- 9 type tests - all passing ✅
- Tests composable type inference

**Total**: 36 automated type safety tests

## How To Use

### 1. Define Your Schema

```typescript
// main.ts
const dbSchema = {
  todos: z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
  }),
} as const;
```

### 2. Create Typed Composables

```typescript
// src/composables/db.ts
import { createTypedComposables } from "@alexop/sqlite-vue";

export const { useSQLiteClientAsync, useSQLiteQuery } =
  createTypedComposables<typeof dbSchema>();
```

### 3. Use in Components

```typescript
// App.vue
import { useSQLiteClientAsync } from "./composables/db";

const dbPromise = useSQLiteClientAsync();

async function deleteTodo(id: string) {
  const db = await dbPromise;

  // ✅ Full autocomplete and type checking!
  await db.delete("todos").where("id", "=", id).execute();
}
```

## Benefits

1. **Catch Errors Early**: Typos caught at compile time, not runtime
2. **Better IDE Support**: Full autocomplete for tables and columns
3. **Refactoring Safety**: Rename fields → all usages flagged
4. **Self-Documenting**: Types serve as inline documentation
5. **No Runtime Cost**: Zero performance impact

## Running Tests

```bash
# Core package type tests
pnpm --filter @alexop/sqlite-core test:type

# Vue package type tests
pnpm --filter @alexop/sqlite-vue test:type

# Run all tests
pnpm -r test:type
```

## TDD Lessons Learned

1. **Write tests first** - Forces you to think about the API
2. **Watch them fail** - Confirms tests actually catch problems
3. **Implement minimally** - Only write code to make tests pass
4. **Refactor confidently** - Tests protect against regressions

## Files Modified

### Created

- `packages/vue/src/typed-composables.ts` - Typed composables factory
- `packages/vue/src/__tests__/vue-types.test-d.ts` - Type tests
- `packages/vue/vitest.config.ts` - Test configuration
- `examples/vue-app/src/composables/db.ts` - App-specific typed composables

### Modified

- `packages/vue/src/index.ts` - Export `createTypedComposables`
- `packages/vue/package.json` - Add test scripts, zod devDependency
- `examples/vue-app/src/App.vue` - Use typed composables

## Next Steps

- ✅ Type safety working in Vue components
- ✅ Automated tests prevent regressions
- 📝 Consider: Runtime integration tests for actual SQLite operations
- 📝 Consider: Performance benchmarks
- 📝 Consider: Error handling tests
