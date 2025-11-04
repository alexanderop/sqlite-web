# Query Builder Improvements

Based on analysis of Kysely's mature query builder implementation, here are the improvements to implement in our SQLite library.

## Overview

Kysely is a production-tested TypeScript SQL query builder with excellent patterns we should adopt. This document outlines specific improvements organized by priority.

---

## High Priority Improvements

### 1. True Immutability Pattern

**Current Issue:** Our QueryBuilder mutates internal state, which can lead to unexpected behavior when query builders are reused.

**Solution:** Implement Kysely's immutability pattern:

- Freeze internal properties object
- Return new QueryBuilder instances on each method call
- Never mutate existing instances

**Implementation:**

```typescript
interface QueryBuilderProps<TRow, TSelected> {
  readonly executeQuery: <T = unknown>(
    sql: string,
    params: unknown[]
  ) => Promise<T[]>;
  readonly tableName: string;
  readonly schema: z.ZodObject<z.ZodRawShape>;
  readonly whereClauses: readonly string[];
  readonly whereParams: readonly unknown[];
  readonly whereConjunctions: readonly ("AND" | "OR")[];
  readonly selectedFields: readonly string[] | undefined;
  readonly orderByClause: string | undefined;
  readonly limitCount: number | undefined;
  readonly offsetCount: number | undefined;
  readonly aggregates: ReadonlyArray<{
    func: string;
    column: string;
    alias: string;
  }>;
  readonly groupByFields: readonly string[];
}

export class QueryBuilder<
  TRow,
  TSelected extends keyof TRow | undefined = undefined,
> {
  readonly #props: QueryBuilderProps<TRow, TSelected>;

  constructor(props: QueryBuilderProps<TRow, TSelected>) {
    this.#props = Object.freeze(props);
  }

  where<K extends keyof TRow>(
    field: K,
    operator: SQLOperator,
    value: TRow[K] | TRow[K][] | null
  ): QueryBuilder<TRow, TSelected> {
    // Create new instance instead of mutating
    return new QueryBuilder({
      ...this.#props,
      whereClauses: [
        ...this.#props.whereClauses,
        `${String(field)} ${operator} ?`,
      ],
      whereParams: [...this.#props.whereParams, value],
    });
  }
}
```

**Benefits:**

- Safe query builder reuse
- Better testability
- Prevents accidental mutations
- Enables advanced patterns like query composition

---

### 2. Add `$call()` Method for Composability

**Purpose:** Enable extraction of reusable query fragments and helper functions.

**Implementation:**

````typescript
export class QueryBuilder<
  TRow,
  TSelected extends keyof TRow | undefined = undefined,
> {
  /**
   * Simply calls the provided function passing `this` as the only argument.
   * `$call` returns what the provided function returns.
   *
   * Useful for extracting common query patterns into reusable functions.
   *
   * @example
   * ```typescript
   * // Define reusable query fragment
   * function withActiveUsers<T extends QueryBuilder<User, any>>(qb: T): T {
   *   return qb.where('status', '=', 'active')
   *           .where('deletedAt', 'IS NULL', null)
   * }
   *
   * // Use it
   * const users = await db.query('users')
   *   .$call(withActiveUsers)
   *   .orderBy('createdAt', 'DESC')
   *   .all()
   * ```
   */
  $call<T>(func: (qb: this) => T): T {
    return func(this);
  }
}
````

**Use Cases:**

- Common filter combinations
- Authentication/authorization filters
- Soft delete patterns
- Pagination helpers

---

### 3. Add Clear Methods

**Purpose:** Allow programmatic removal of query clauses for dynamic query building.

**Implementation:**

````typescript
export class QueryBuilder<
  TRow,
  TSelected extends keyof TRow | undefined = undefined,
> {
  /**
   * Clears all WHERE conditions from the query.
   *
   * @example
   * ```typescript
   * const baseQuery = db.query('users').where('status', '=', 'active')
   *
   * // Conditionally remove filters
   * const query = showAll
   *   ? baseQuery.clearWhere()
   *   : baseQuery
   * ```
   */
  clearWhere(): QueryBuilder<TRow, TSelected> {
    return new QueryBuilder({
      ...this.#props,
      whereClauses: [],
      whereParams: [],
      whereConjunctions: [],
    });
  }

  /**
   * Clears the ORDER BY clause from the query.
   */
  clearOrderBy(): QueryBuilder<TRow, TSelected> {
    return new QueryBuilder({
      ...this.#props,
      orderByClause: undefined,
    });
  }

  /**
   * Clears the LIMIT clause from the query.
   */
  clearLimit(): QueryBuilder<TRow, TSelected> {
    return new QueryBuilder({
      ...this.#props,
      limitCount: undefined,
    });
  }

  /**
   * Clears the OFFSET (skip) clause from the query.
   */
  clearOffset(): QueryBuilder<TRow, TSelected> {
    return new QueryBuilder({
      ...this.#props,
      offsetCount: undefined,
    });
  }

  /**
   * Clears the SELECT clause, returning to SELECT *.
   */
  clearSelect(): QueryBuilder<TRow, undefined> {
    return new QueryBuilder({
      ...this.#props,
      selectedFields: undefined,
    }) as any;
  }

  /**
   * Clears the GROUP BY clause.
   */
  clearGroupBy(): QueryBuilder<TRow, TSelected> {
    return new QueryBuilder({
      ...this.#props,
      groupByFields: [],
    });
  }
}
````

**Benefits:**

- Dynamic query modification
- Query template reuse
- Conditional query building
- Testing different query variations

---

### 4. Add `whereRef()` for Column Comparisons

**Purpose:** Compare two columns instead of column to value.

**Implementation:**

````typescript
export class QueryBuilder<
  TRow,
  TSelected extends keyof TRow | undefined = undefined,
> {
  /**
   * Adds a WHERE clause where both sides of the operator are column references.
   *
   * The normal `where` method treats the right-hand side as a value.
   * `whereRef` treats both sides as column references.
   *
   * @example
   * ```typescript
   * // Find users where first_name equals last_name
   * db.query('users')
   *   .whereRef('firstName', '=', 'lastName')
   *
   * // Compare dates
   * db.query('orders')
   *   .whereRef('shippedAt', '>', 'orderedAt')
   *
   * // Self-joins pattern
   * db.query('employees')
   *   .whereRef('managerId', '=', 'id')
   * ```
   */
  whereRef<K1 extends keyof TRow, K2 extends keyof TRow>(
    leftField: K1,
    operator: SQLOperator,
    rightField: K2
  ): QueryBuilder<TRow, TSelected> {
    // Build WHERE clause with both sides as column references
    const clause = `${String(leftField)} ${operator} ${String(rightField)}`;

    return new QueryBuilder({
      ...this.#props,
      whereClauses: [...this.#props.whereClauses, clause],
      // Note: No params added since both sides are column references
      whereConjunctions:
        this.#props.whereClauses.length > 0
          ? [...this.#props.whereConjunctions, "AND"]
          : this.#props.whereConjunctions,
    });
  }

  /**
   * Adds an OR WHERE clause comparing two columns.
   */
  orWhereRef<K1 extends keyof TRow, K2 extends keyof TRow>(
    leftField: K1,
    operator: SQLOperator,
    rightField: K2
  ): QueryBuilder<TRow, TSelected> {
    const clause = `${String(leftField)} ${operator} ${String(rightField)}`;

    return new QueryBuilder({
      ...this.#props,
      whereClauses: [...this.#props.whereClauses, clause],
      whereConjunctions: [...this.#props.whereConjunctions, "OR"],
    });
  }
}
````

**Use Cases:**

- Self-referential comparisons
- Date range validations
- Audit trail queries
- Data quality checks

---

### 5. Add `$if()` for Conditional Queries

**Purpose:** Cleaner conditional query building without breaking the chain.

**Implementation:**

````typescript
export class QueryBuilder<
  TRow,
  TSelected extends keyof TRow | undefined = undefined,
> {
  /**
   * Conditionally call a function on the query builder.
   *
   * This method allows for cleaner conditional query building without
   * breaking the method chain or using temporary variables.
   *
   * @param condition - If true, the function is called
   * @param func - Function to call with this query builder
   * @returns Modified query builder if condition is true, otherwise unchanged
   *
   * @example
   * ```typescript
   * // Basic conditional filter
   * const users = await db.query('users')
   *   .where('status', '=', 'active')
   *   .$if(includeDeleted, qb => qb.orWhere('status', '=', 'deleted'))
   *   .all()
   *
   * // Multiple conditions
   * const query = db.query('products')
   *   .$if(minPrice !== null, qb => qb.where('price', '>=', minPrice))
   *   .$if(maxPrice !== null, qb => qb.where('price', '<=', maxPrice))
   *   .$if(category, qb => qb.where('category', '=', category))
   *
   * // Complex conditional logic
   * const orders = await db.query('orders')
   *   .$if(userRole === 'admin', qb => qb)
   *   .$if(userRole === 'user', qb =>
   *     qb.where('userId', '=', currentUserId)
   *   )
   *   .all()
   * ```
   */
  $if(
    condition: boolean,
    func: (qb: this) => QueryBuilder<TRow, any>
  ): QueryBuilder<TRow, TSelected> {
    if (condition) {
      return func(this) as any;
    }
    return this;
  }
}
````

**Benefits:**

- Cleaner code without if/else blocks
- Maintains method chaining
- Type-safe conditional queries
- Better readability

---

## Medium Priority Improvements

### 6. Type Narrowing Methods

**Purpose:** Help TypeScript understand runtime type guarantees.

**Implementation:**

````typescript
export class QueryBuilder<
  TRow,
  TSelected extends keyof TRow | undefined = undefined,
> {
  /**
   * Change the output type of the query.
   *
   * This method doesn't change the SQL. It simply returns a copy of this
   * QueryBuilder with a new output type. Use when you know more about the
   * return type than TypeScript can infer.
   *
   * @example
   * ```typescript
   * // Cast to specific type
   * const result = await db.query('users')
   *   .where('id', '=', userId)
   *   .$castTo<UserWithProfile>()
   *   .first()
   * ```
   */
  $castTo<T>(): QueryBuilder<T, TSelected> {
    return this as any;
  }

  /**
   * Omit null from the query's output type.
   *
   * Use when you know a field can't be null (e.g., after a NOT NULL check)
   * but TypeScript doesn't know that.
   *
   * @example
   * ```typescript
   * const users = await db.query('users')
   *   .where('email', 'IS NOT NULL', null)
   *   .$notNull()
   *   .all()
   * // Now users are typed without null in nullable fields
   * ```
   */
  $notNull(): QueryBuilder<
    {
      [K in keyof TRow]: NonNullable<TRow[K]>;
    },
    TSelected
  > {
    return this as any;
  }

  /**
   * Narrow specific fields in the output type.
   *
   * @example
   * ```typescript
   * type Narrowed = { email: string } // Remove null
   *
   * const users = await db.query('users')
   *   .where('email', 'IS NOT NULL', null)
   *   .$narrowType<Narrowed>()
   *   .all()
   * ```
   */
  $narrowType<T extends Partial<TRow>>(): QueryBuilder<
    {
      [K in keyof TRow]: K extends keyof T ? T[K] : TRow[K];
    },
    TSelected
  > {
    return this as any;
  }
}
````

**Use Cases:**

- After NOT NULL checks
- Custom type guards
- Complex type transformations
- Working with unions

---

### 7. Expression Builder for Complex WHERE Clauses

**Purpose:** Provide a dedicated builder for complex boolean expressions.

**Implementation:**

````typescript
/**
 * Expression builder for complex WHERE conditions.
 * Passed to callbacks in where() methods.
 */
export class ExpressionBuilder<TRow> {
  /**
   * Create a simple comparison expression.
   *
   * @example
   * ```typescript
   * db.query('users').where(eb =>
   *   eb('age', '>', 18)
   * )
   * ```
   */
  <K extends keyof TRow>(
    field: K,
    operator: SQLOperator,
    value: TRow[K] | TRow[K][]
  ): Expression {
    return new Expression(`${String(field)} ${operator} ?`, [value])
  }

  /**
   * Combine expressions with AND.
   *
   * @example
   * ```typescript
   * db.query('users').where(eb =>
   *   eb.and([
   *     eb('age', '>', 18),
   *     eb('status', '=', 'active')
   *   ])
   * )
   * ```
   */
  and(expressions: Expression[]): Expression {
    const sql = expressions.map(e => `(${e.sql})`).join(' AND ')
    const params = expressions.flatMap(e => e.params)
    return new Expression(sql, params)
  }

  /**
   * Combine expressions with OR.
   *
   * @example
   * ```typescript
   * db.query('users').where(eb =>
   *   eb.or([
   *     eb('role', '=', 'admin'),
   *     eb('role', '=', 'moderator')
   *   ])
   * )
   * ```
   */
  or(expressions: Expression[]): Expression {
    const sql = expressions.map(e => `(${e.sql})`).join(' OR ')
    const params = expressions.flatMap(e => e.params)
    return new Expression(sql, params)
  }

  /**
   * Negate an expression with NOT.
   *
   * @example
   * ```typescript
   * db.query('users').where(eb =>
   *   eb.not(eb('status', '=', 'banned'))
   * )
   * ```
   */
  not(expression: Expression): Expression {
    return new Expression(`NOT (${expression.sql})`, expression.params)
  }

  /**
   * Reference a column (for use in expressions).
   *
   * @example
   * ```typescript
   * db.query('users').where(eb =>
   *   eb(eb.ref('firstName'), '=', eb.ref('lastName'))
   * )
   * ```
   */
  ref<K extends keyof TRow>(field: K): ColumnRef {
    return new ColumnRef(String(field))
  }
}

/**
 * Represents a SQL expression with parameters.
 */
export class Expression {
  constructor(
    public readonly sql: string,
    public readonly params: unknown[]
  ) {}
}

/**
 * Represents a column reference.
 */
export class ColumnRef {
  constructor(public readonly column: string) {}
}
````

**Update WHERE method:**

```typescript
where<K extends keyof TRow>(
  field: K | ((eb: ExpressionBuilder<TRow>) => Expression),
  operator?: SQLOperator,
  value?: TRow[K] | TRow[K][] | null
): QueryBuilder<TRow, TSelected> {
  // Handle expression builder callback
  if (typeof field === 'function') {
    const eb = new ExpressionBuilder<TRow>()
    const expression = field(eb)

    return new QueryBuilder({
      ...this.#props,
      whereClauses: [...this.#props.whereClauses, expression.sql],
      whereParams: [...this.#props.whereParams, ...expression.params],
      whereConjunctions: this.#props.whereClauses.length > 0
        ? [...this.#props.whereConjunctions, 'AND']
        : this.#props.whereConjunctions
    })
  }

  // Original implementation for simple where
  // ...
}
```

**Use Cases:**

- Complex AND/OR combinations
- Nested conditions
- Dynamic expression building
- Column-to-column comparisons

---

### 8. Enhanced WHERE with Object Syntax

**Purpose:** Simplify common equality checks with object notation.

**Implementation:**

````typescript
export class ExpressionBuilder<TRow> {
  /**
   * Create equality conditions from an object.
   * All conditions are combined with AND.
   *
   * @example
   * ```typescript
   * db.query('users').where(eb =>
   *   eb.and({
   *     status: 'active',
   *     role: 'admin',
   *     verified: true
   *   })
   * )
   * // Equivalent to:
   * // WHERE status = 'active' AND role = 'admin' AND verified = true
   * ```
   */
  and(conditions: Partial<TRow> | Expression[]): Expression {
    // If array, use existing implementation
    if (Array.isArray(conditions)) {
      const sql = conditions.map((e) => `(${e.sql})`).join(" AND ");
      const params = conditions.flatMap((e) => e.params);
      return new Expression(sql, params);
    }

    // Object syntax
    const entries = Object.entries(conditions);
    const clauses = entries.map(([key]) => `${key} = ?`);
    const params = entries.map(([, value]) => value);

    return new Expression(clauses.join(" AND "), params);
  }

  /**
   * Create equality conditions combined with OR.
   *
   * @example
   * ```typescript
   * db.query('users').where(eb =>
   *   eb.or({
   *     role: 'admin',
   *     role: 'moderator'  // Note: Same key, last wins
   *   })
   * )
   * ```
   */
  or(conditions: Partial<TRow> | Expression[]): Expression {
    if (Array.isArray(conditions)) {
      const sql = conditions.map((e) => `(${e.sql})`).join(" OR ");
      const params = conditions.flatMap((e) => e.params);
      return new Expression(sql, params);
    }

    const entries = Object.entries(conditions);
    const clauses = entries.map(([key]) => `${key} = ?`);
    const params = entries.map(([, value]) => value);

    return new Expression(clauses.join(" OR "), params);
  }
}
````

---

### 9. Add `exists()` Support

**Purpose:** Support EXISTS subqueries for efficient filtering.

**Implementation:**

````typescript
export class ExpressionBuilder<TRow> {
  /**
   * Create an EXISTS subquery expression.
   *
   * @example
   * ```typescript
   * // Find users who have at least one order
   * db.query('users').where(eb =>
   *   eb.exists(
   *     db.query('orders')
   *       .whereRef('orders.userId', '=', 'users.id')
   *   )
   * )
   * ```
   */
  exists<T>(subquery: QueryBuilder<T, any>): Expression {
    const { sql, params } = subquery.buildSQL();
    return new Expression(`EXISTS (${sql})`, params);
  }

  /**
   * Create a NOT EXISTS subquery expression.
   */
  notExists<T>(subquery: QueryBuilder<T, any>): Expression {
    const { sql, params } = subquery.buildSQL();
    return new Expression(`NOT EXISTS (${sql})`, params);
  }
}
````

**Note:** Requires making `buildSQL()` public or adding a method to compile without executing.

---

## Lower Priority (Future Enhancements)

### 10. Operation Node Architecture

**Purpose:** Create an abstract syntax tree (AST) representation of queries for better maintainability and extensibility.

**Concept Overview:**

Instead of building SQL strings directly, create intermediate operation nodes:

```typescript
// Example structure (simplified)
interface SelectQueryNode {
  kind: "SelectQuery";
  from: TableNode;
  where?: WhereNode;
  orderBy?: OrderByNode[];
  limit?: LimitNode;
}

interface WhereNode {
  kind: "Where";
  expression: ExpressionNode;
}

// etc.
```

**Benefits:**

- Query transformations
- Plugin system
- Query optimization
- Better error messages
- Query inspection/debugging
- Easier testing

**Note:** This is a significant architectural change. Consider only if planning major version bump or if current approach becomes limiting.

---

### 11. Plugin System

**Purpose:** Allow users to extend query building behavior.

**Concept:**

```typescript
interface QueryPlugin {
  transformQuery(node: QueryNode): QueryNode;
}

export class QueryBuilder {
  withPlugin(plugin: QueryPlugin): QueryBuilder {
    // ...
  }
}
```

**Use Cases:**

- Soft delete plugins
- Multi-tenancy filters
- Query logging
- Performance monitoring
- Query caching

**Note:** Requires operation node architecture (#10).

---

### 12. Query Compilation and Caching

**Purpose:** Improve performance for repeated queries.

**Implementation:**

```typescript
export class QueryBuilder {
  /**
   * Compile the query to SQL without executing.
   * Useful for inspection, caching, or preparation.
   */
  compile(): { sql: string; params: unknown[] } {
    return this.buildSQL();
  }

  /**
   * Explain query execution plan.
   * Only works with SQLite's EXPLAIN QUERY PLAN.
   */
  async explain(): Promise<any[]> {
    const { sql, params } = this.buildSQL();
    const explainSql = `EXPLAIN QUERY PLAN ${sql}`;
    return this.executeQuery(explainSql, params);
  }
}
```

---

## Implementation Guidelines

### Priority Order

1. **Phase 1** (High Priority): Implement items #1-5
   - These provide immediate value
   - Minimal breaking changes
   - Clear user benefits

2. **Phase 2** (Medium Priority): Implement items #6-9
   - Build on Phase 1 foundations
   - More complex features
   - Requires more testing

3. **Phase 3** (Future): Consider items #10-12
   - Major architectural changes
   - Only if needed for scaling
   - Requires careful planning

### Testing Requirements

For each improvement:

1. Add unit tests covering:
   - Happy path
   - Edge cases
   - Type checking (if applicable)
   - Integration with existing features

2. Add integration tests showing:
   - Real-world use cases
   - Interaction with database
   - Performance characteristics

3. Update documentation:
   - API documentation
   - Usage examples
   - Migration guide (if breaking)

### Breaking Changes

**Phase 1 Considerations:**

- #1 (Immutability) is technically breaking but should be transparent
- Test all existing code to ensure compatibility
- Consider providing compatibility mode if needed

**Migration Path:**

- All changes should be additive where possible
- Deprecate old methods before removing
- Provide migration guide for breaking changes
- Consider semantic versioning

---

## Example Usage After Implementation

Here's what the improved API will look like:

```typescript
// Reusable query fragments with $call
const withActiveStatus = <T extends QueryBuilder<any, any>>(qb: T) =>
  qb.where("status", "=", "active").where("deletedAt", "IS NULL", null);

const withPagination =
  (page: number, pageSize: number) =>
  <T extends QueryBuilder<any, any>>(qb: T) =>
    qb.limit(pageSize).skip((page - 1) * pageSize);

// Complex conditional queries with $if
const users = await db
  .query("users")
  .$call(withActiveStatus)
  .$if(searchTerm !== null, (qb) =>
    qb.where((eb) =>
      eb.or([
        eb("firstName", "LIKE", `%${searchTerm}%`),
        eb("lastName", "LIKE", `%${searchTerm}%`),
        eb("email", "LIKE", `%${searchTerm}%`),
      ])
    )
  )
  .$if(role !== null, (qb) => qb.where("role", "=", role))
  .$call(withPagination(page, 20))
  .orderBy("createdAt", "DESC")
  .all();

// Column comparisons with whereRef
const invalidOrders = await db
  .query("orders")
  .whereRef("shippedAt", "<", "orderedAt")
  .all();

// Complex expressions with ExpressionBuilder
const premiumUsers = await db
  .query("users")
  .where((eb) =>
    eb.and([
      eb.or([
        eb("subscriptionType", "=", "premium"),
        eb("subscriptionType", "=", "enterprise"),
      ]),
      eb("subscriptionExpiry", ">", new Date()),
      eb.exists(
        db
          .query("payments")
          .whereRef("payments.userId", "=", "users.id")
          .where("payments.status", "=", "completed")
      ),
    ])
  )
  .all();

// Safe query builder reuse (immutability)
const baseQuery = db.query("products").where("published", "=", true);

const cheapProducts = await baseQuery.where("price", "<", 20).all();
const expensiveProducts = await baseQuery.where("price", ">", 100).all();
// baseQuery is unchanged

// Dynamic query building with clear methods
let query = db
  .query("orders")
  .where("status", "=", "pending")
  .orderBy("createdAt", "DESC");

if (showAll) {
  query = query.clearWhere();
}

if (sortBy === "amount") {
  query = query.clearOrderBy().orderBy("amount", "DESC");
}

const results = await query.all();
```

---

## Questions for Clarification

Before implementation, please clarify:

1. **Version Planning**: Should these be implemented in a major version bump (2.0) or incrementally?

2. **Breaking Changes**: How should we handle the immutability change? Compatibility mode or clean break?

3. **TypeScript Version**: What's the minimum TypeScript version to support? (Some advanced types may require newer versions)

4. **Testing Coverage**: What's the target test coverage percentage?

5. **Documentation**: Should we create a full migration guide or just update API docs?

6. **Performance**: Are there specific performance benchmarks we need to hit?

---

## Success Metrics

After implementation, we should see:

- ✅ Improved type safety (fewer `any` types needed)
- ✅ More concise query building code
- ✅ Better code reusability
- ✅ Fewer bugs from query builder misuse
- ✅ Easier testing of complex queries
- ✅ Better developer experience
- ✅ Closer feature parity with Kysely

---

## References

- [Kysely GitHub Repository](https://github.com/kysely-org/kysely)
- [Kysely Documentation](https://kysely.dev/)
- Original analysis: Kysely `src/query-builder/` directory
