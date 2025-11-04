import type { z } from "zod";
import type { SQLOperator, SortDirection } from "@alexop/sqlite-core";
import type { QueryResult } from "./types";

/**
 * Immutable properties for QueryBuilder
 * All properties are readonly to prevent accidental mutations
 * @internal
 */
interface QueryBuilderProps<_TRow, _TSelected> {
  readonly executeQuery: <T = unknown>(sql: string, params: unknown[]) => Promise<T[]>;
  readonly tableName: string;
  readonly schema: z.ZodObject<z.ZodRawShape>;
  readonly whereClauses: readonly string[];
  readonly whereParams: readonly unknown[];
  readonly whereConjunctions: readonly ('AND' | 'OR')[];
  readonly selectedFields: readonly string[] | undefined;
  readonly orderByClause: string | undefined;
  readonly limitCount: number | undefined;
  readonly offsetCount: number | undefined;
  readonly aggregates: ReadonlyArray<{ func: string; column: string; alias: string }>;
  readonly groupByFields: readonly string[];
}

/**
 * Query builder for SELECT queries with method chaining
 *
 * Provides a fluent API for building type-safe SELECT queries. Supports WHERE conditions,
 * field selection, sorting, pagination, and multiple execution modes (all, first, count).
 *
 * This QueryBuilder follows an immutable pattern - each method call returns a new instance
 * without modifying the original. This allows safe query builder reuse and composition.
 *
 * @template TRow - Full row type from the table schema
 * @template TSelected - Selected field keys (undefined means all fields)
 *
 * @example
 * ```typescript
 * // Get all users
 * const users = await db.query('users').all();
 *
 * // Filter with WHERE clause
 * const adults = await db.query('users')
 *   .where('age', '>', 18)
 *   .all();
 *
 * // Select specific fields
 * const emails = await db.query('users')
 *   .select('email', 'name')
 *   .all();
 *
 * // Complex query with sorting and pagination
 * const page = await db.query('users')
 *   .where('status', '=', 'active')
 *   .orderBy('createdAt', 'DESC')
 *   .limit(10)
 *   .skip(20)
 *   .all();
 *
 * // Safe query builder reuse (immutability)
 * const baseQuery = db.query('products').where('published', '=', true);
 * const cheap = await baseQuery.where('price', '<', 20).all();
 * const expensive = await baseQuery.where('price', '>', 100).all();
 * // baseQuery remains unchanged
 * ```
 */
export class QueryBuilder<TRow, TSelected extends keyof TRow | undefined = undefined> {
  readonly #props: QueryBuilderProps<TRow, TSelected>;

  /**
   * Create a new QueryBuilder instance
   * @param props - Immutable properties object
   * @internal
   */
  constructor(props: QueryBuilderProps<TRow, TSelected>) {
    this.#props = Object.freeze(props);
  }

  /**
   * Create initial QueryBuilder instance with default values
   * @internal
   */
  static create<TRow>(
    executeQuery: <T = unknown>(sql: string, params: unknown[]) => Promise<T[]>,
    tableName: string,
    schema: z.ZodObject<z.ZodRawShape>
  ): QueryBuilder<TRow, undefined> {
    return new QueryBuilder<TRow, undefined>({
      executeQuery,
      tableName,
      schema,
      whereClauses: [],
      whereParams: [],
      whereConjunctions: [],
      selectedFields: undefined,
      orderByClause: undefined,
      limitCount: undefined,
      offsetCount: undefined,
      aggregates: [],
      groupByFields: [],
    });
  }

  /**
   * Add a WHERE condition to filter results
   *
   * Multiple WHERE calls are combined with AND. Supports standard comparison operators
   * and IN/NOT IN for array values. All field names and values are type-checked.
   *
   * @template K - Field name from the table schema
   * @param field - Column name to filter on (type-safe)
   * @param operator - SQL comparison operator (=, !=, >, <, >=, <=, LIKE, IN, NOT IN)
   * @param value - Value to compare against (or array for IN/NOT IN)
   * @returns This QueryBuilder instance for chaining
   *
   * @example
   * ```typescript
   * // Simple equality
   * db.query('users').where('age', '=', 25)
   *
   * // Greater than
   * db.query('users').where('age', '>', 18)
   *
   * // LIKE pattern matching
   * db.query('users').where('email', 'LIKE', '%@example.com')
   *
   * // IN with array
   * db.query('users').where('status', 'IN', ['active', 'pending'])
   *
   * // Multiple conditions (AND)
   * db.query('users')
   *   .where('age', '>', 18)
   *   .where('status', '=', 'active')
   * ```
   */
  /**
   * Internal method to add a WHERE condition with specified conjunction
   * Returns new props object with the added condition
   * @internal
   */
  private addWhereCondition(
    field: string,
    operator: SQLOperator,
    value: unknown,
    conjunction: 'AND' | 'OR'
  ): QueryBuilderProps<TRow, TSelected> {
    let newClauses: string[];
    let newParams: unknown[];
    let newConjunctions: ('AND' | 'OR')[];

    if (operator === 'IN' || operator === 'NOT IN') {
      const values = Array.isArray(value) ? value : [value];
      const placeholders = values.map(() => '?').join(', ');
      newClauses = [...this.#props.whereClauses, `${field} ${operator} (${placeholders})`];
      newParams = [...this.#props.whereParams, ...values];
      newConjunctions = this.#props.whereClauses.length > 0
        ? [...this.#props.whereConjunctions, conjunction]
        : [...this.#props.whereConjunctions];
    } else if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
      newClauses = [...this.#props.whereClauses, `${field} ${operator}`];
      newParams = [...this.#props.whereParams];
      newConjunctions = this.#props.whereClauses.length > 0
        ? [...this.#props.whereConjunctions, conjunction]
        : [...this.#props.whereConjunctions];
    } else if (operator === 'BETWEEN') {
      const values = Array.isArray(value) ? value : [];
      if (values.length !== 2) {
        throw new Error('BETWEEN operator requires an array of exactly 2 values');
      }
      newClauses = [...this.#props.whereClauses, `${field} ${operator} ? AND ?`];
      newParams = [...this.#props.whereParams, values[0], values[1]];
      newConjunctions = this.#props.whereClauses.length > 0
        ? [...this.#props.whereConjunctions, conjunction]
        : [...this.#props.whereConjunctions];
    } else {
      newClauses = [...this.#props.whereClauses, `${field} ${operator} ?`];
      newParams = [...this.#props.whereParams, value];
      newConjunctions = this.#props.whereClauses.length > 0
        ? [...this.#props.whereConjunctions, conjunction]
        : [...this.#props.whereConjunctions];
    }

    return {
      ...this.#props,
      whereClauses: newClauses,
      whereParams: newParams,
      whereConjunctions: newConjunctions,
    };
  }

  where<K extends keyof TRow>(
    field: K | ((qb: QueryBuilder<TRow, TSelected>) => QueryBuilder<TRow, TSelected>),
    operator?: SQLOperator,
    value?: TRow[K] | TRow[K][] | null
  ): QueryBuilder<TRow, TSelected> {
    // Handle callback for grouped conditions
    if (typeof field === 'function') {
      const subBuilder = QueryBuilder.create<TRow>(
        this.#props.executeQuery,
        this.#props.tableName,
        this.#props.schema
      ) as QueryBuilder<TRow, TSelected>;
      const resultBuilder = field(subBuilder);

      if (resultBuilder.#props.whereClauses.length > 0) {
        const groupedCondition = this.buildWhereClauseFromProps(resultBuilder.#props);
        const newClauses = [...this.#props.whereClauses, `(${groupedCondition})`];
        const newParams = [...this.#props.whereParams, ...resultBuilder.#props.whereParams];
        const newConjunctions = this.#props.whereClauses.length > 0
          ? [...this.#props.whereConjunctions, 'AND' as const]
          : [...this.#props.whereConjunctions];

        return new QueryBuilder({
          ...this.#props,
          whereClauses: newClauses,
          whereParams: newParams,
          whereConjunctions: newConjunctions,
        });
      }

      return this;
    }

    const fieldName = String(field);
    if (operator) {
      const newProps = this.addWhereCondition(fieldName, operator, value, 'AND');
      return new QueryBuilder(newProps);
    }
    return this;
  }

  /**
   * Add an OR WHERE condition to filter results
   *
   * Used to combine conditions with OR logic instead of AND. Must be called after
   * an initial where() call.
   *
   * @template K - Field name from the table schema
   * @param field - Column name to filter on (type-safe)
   * @param operator - SQL comparison operator
   * @param value - Value to compare against (or array for IN/NOT IN)
   * @returns This QueryBuilder instance for chaining
   *
   * @example
   * ```typescript
   * // Get completed OR high priority tasks
   * db.query('todos')
   *   .where('completed', '=', true)
   *   .orWhere('priority', '=', 'high')
   *
   * // Combine with AND
   * db.query('todos')
   *   .where('userId', '=', 'user1')
   *   .where('completed', '=', false)
   *   .orWhere('priority', '=', 'urgent')
   * // This creates: WHERE userId = 'user1' AND (completed = false OR priority = 'urgent')
   * ```
   */
  orWhere<K extends keyof TRow>(
    field: K,
    operator: SQLOperator,
    value: TRow[K] | TRow[K][] | null
  ): QueryBuilder<TRow, TSelected> {
    const fieldName = String(field);
    const newProps = this.addWhereCondition(fieldName, operator, value, 'OR');
    return new QueryBuilder(newProps);
  }

  /**
   * Select specific fields to return (narrows return type)
   *
   * By default, all fields are returned. Use select() to specify only the fields
   * you need. The return type is automatically narrowed to only include selected fields.
   *
   * @template K - Field names to select
   * @param fields - Column names to include in results (type-safe)
   * @returns QueryBuilder with narrowed type for selected fields
   *
   * @example
   * ```typescript
   * // Select specific fields
   * const result = await db.query('users')
   *   .select('id', 'email')
   *   .all();
   * // result type: Array<{ id: number; email: string }>
   *
   * // Combine with WHERE
   * const names = await db.query('users')
   *   .where('age', '>', 18)
   *   .select('name')
   *   .all();
   * // names type: Array<{ name: string }>
   * ```
   */
  select<K extends keyof TRow>(
    ...fields: K[]
  ): QueryBuilder<TRow, K> {
    return new QueryBuilder({
      ...this.#props,
      selectedFields: fields.map((f) => String(f)),
    }) as unknown as QueryBuilder<TRow, K>;
  }

  /**
   * Add ORDER BY clause to sort results
   *
   * Only one orderBy() call is supported per query. The last call wins.
   *
   * @template K - Field name from the table schema
   * @param field - Column name to sort by (type-safe)
   * @param direction - Sort direction ('ASC' or 'DESC', default: 'ASC')
   * @returns This QueryBuilder instance for chaining
   *
   * @example
   * ```typescript
   * // Ascending order (default)
   * db.query('users').orderBy('createdAt')
   *
   * // Descending order
   * db.query('users').orderBy('createdAt', 'DESC')
   *
   * // With WHERE and LIMIT
   * db.query('users')
   *   .where('status', '=', 'active')
   *   .orderBy('score', 'DESC')
   *   .limit(10)
   * ```
   */
  orderBy<K extends keyof TRow>(field: K, direction: SortDirection = 'ASC'): QueryBuilder<TRow, TSelected> {
    return new QueryBuilder({
      ...this.#props,
      orderByClause: `${String(field)} ${direction}`,
    });
  }

  /**
   * Limit the number of results returned
   *
   * Useful for pagination when combined with skip().
   *
   * @param count - Maximum number of rows to return
   * @returns This QueryBuilder instance for chaining
   *
   * @example
   * ```typescript
   * // Get first 10 users
   * db.query('users').limit(10)
   *
   * // Pagination: page 3, 20 items per page
   * db.query('users')
   *   .orderBy('id')
   *   .limit(20)
   *   .skip(40)
   * ```
   */
  limit(count: number): QueryBuilder<TRow, TSelected> {
    return new QueryBuilder({
      ...this.#props,
      limitCount: count,
    });
  }

  /**
   * Skip a number of rows (OFFSET)
   *
   * Used for pagination. Typically combined with limit().
   *
   * @param count - Number of rows to skip
   * @returns This QueryBuilder instance for chaining
   *
   * @example
   * ```typescript
   * // Skip first 10 rows
   * db.query('users').skip(10)
   *
   * // Pagination helper
   * const page = 3;
   * const pageSize = 20;
   * db.query('users')
   *   .limit(pageSize)
   *   .skip((page - 1) * pageSize)
   * ```
   */
  skip(count: number): QueryBuilder<TRow, TSelected> {
    return new QueryBuilder({
      ...this.#props,
      offsetCount: count,
    });
  }

  /**
   * Calculate sum of a numeric column
   *
   * Can be used in two ways:
   * 1. Terminal operation: Returns sum immediately
   * 2. Chainable operation: Adds aggregate for use with GROUP BY
   *
   * @template K - Field name from the table schema
   * @param column - Column name to sum (must be numeric)
   * @param alias - Optional alias for the result (required for GROUP BY usage)
   * @returns Promise<number> for terminal operation, or this QueryBuilder for chaining
   *
   * @example
   * ```typescript
   * // Terminal operation
   * const total = await db.query('orders').sum('amount');
   *
   * // With WHERE
   * const userTotal = await db.query('orders')
   *   .where('userId', '=', '123')
   *   .sum('amount');
   *
   * // With GROUP BY (chainable)
   * const totals = await db.query('orders')
   *   .select('userId')
   *   .sum('amount', 'total')
   *   .groupBy('userId')
   *   .all();
   * ```
   */
  sum<K extends keyof TRow>(column: K): Promise<number | null>;
  sum<K extends keyof TRow>(column: K, alias: string): QueryBuilder<TRow, TSelected>;
  sum<K extends keyof TRow>(column: K, alias?: string): Promise<number | null> | QueryBuilder<TRow, TSelected> {
    if (alias === undefined) {
      // Terminal operation
      return this.executeAggregate('SUM', String(column));
    }
    // Chainable operation
    return new QueryBuilder({
      ...this.#props,
      aggregates: [...this.#props.aggregates, { func: 'SUM', column: String(column), alias }],
    });
  }

  /**
   * Calculate average of a numeric column
   *
   * Can be used in two ways:
   * 1. Terminal operation: Returns average immediately
   * 2. Chainable operation: Adds aggregate for use with GROUP BY
   *
   * @template K - Field name from the table schema
   * @param column - Column name to average (must be numeric)
   * @param alias - Optional alias for the result (required for GROUP BY usage)
   * @returns Promise<number> for terminal operation, or this QueryBuilder for chaining
   *
   * @example
   * ```typescript
   * // Terminal operation
   * const avgScore = await db.query('ratings').avg('score');
   *
   * // With GROUP BY (chainable)
   * const avgScores = await db.query('ratings')
   *   .select('userId')
   *   .avg('score', 'avgScore')
   *   .groupBy('userId')
   *   .all();
   * ```
   */
  avg<K extends keyof TRow>(column: K): Promise<number | null>;
  avg<K extends keyof TRow>(column: K, alias: string): QueryBuilder<TRow, TSelected>;
  avg<K extends keyof TRow>(column: K, alias?: string): Promise<number | null> | QueryBuilder<TRow, TSelected> {
    if (alias === undefined) {
      // Terminal operation
      return this.executeAggregate('AVG', String(column));
    }
    // Chainable operation
    return new QueryBuilder({
      ...this.#props,
      aggregates: [...this.#props.aggregates, { func: 'AVG', column: String(column), alias }],
    });
  }

  /**
   * Find minimum value of a column
   *
   * Can be used in two ways:
   * 1. Terminal operation: Returns minimum immediately
   * 2. Chainable operation: Adds aggregate for use with GROUP BY
   *
   * @template K - Field name from the table schema
   * @param column - Column name to find minimum
   * @param alias - Optional alias for the result (required for GROUP BY usage)
   * @returns Promise<number | null> for terminal operation, or this QueryBuilder for chaining
   *
   * @example
   * ```typescript
   * // Terminal operation
   * const minPrice = await db.query('products').min('price');
   *
   * // With GROUP BY (chainable)
   * const minPrices = await db.query('products')
   *   .select('category')
   *   .min('price', 'minPrice')
   *   .groupBy('category')
   *   .all();
   * ```
   */
  min<K extends keyof TRow>(column: K): Promise<number | null>;
  min<K extends keyof TRow>(column: K, alias: string): QueryBuilder<TRow, TSelected>;
  min<K extends keyof TRow>(column: K, alias?: string): Promise<number | null> | QueryBuilder<TRow, TSelected> {
    if (alias === undefined) {
      // Terminal operation
      return this.executeAggregate('MIN', String(column));
    }
    // Chainable operation
    return new QueryBuilder({
      ...this.#props,
      aggregates: [...this.#props.aggregates, { func: 'MIN', column: String(column), alias }],
    });
  }

  /**
   * Find maximum value of a column
   *
   * Can be used in two ways:
   * 1. Terminal operation: Returns maximum immediately
   * 2. Chainable operation: Adds aggregate for use with GROUP BY
   *
   * @template K - Field name from the table schema
   * @param column - Column name to find maximum
   * @param alias - Optional alias for the result (required for GROUP BY usage)
   * @returns Promise<number | null> for terminal operation, or this QueryBuilder for chaining
   *
   * @example
   * ```typescript
   * // Terminal operation
   * const maxPrice = await db.query('products').max('price');
   *
   * // With GROUP BY (chainable)
   * const maxPrices = await db.query('products')
   *   .select('category')
   *   .max('price', 'maxPrice')
   *   .groupBy('category')
   *   .all();
   * ```
   */
  max<K extends keyof TRow>(column: K): Promise<number | null>;
  max<K extends keyof TRow>(column: K, alias: string): QueryBuilder<TRow, TSelected>;
  max<K extends keyof TRow>(column: K, alias?: string): Promise<number | null> | QueryBuilder<TRow, TSelected> {
    if (alias === undefined) {
      // Terminal operation
      return this.executeAggregate('MAX', String(column));
    }
    // Chainable operation
    return new QueryBuilder({
      ...this.#props,
      aggregates: [...this.#props.aggregates, { func: 'MAX', column: String(column), alias }],
    });
  }

  /**
   * Group results by one or more columns
   *
   * Used with aggregate functions to group rows by specific columns.
   * Must be used with select() and at least one aggregate function.
   *
   * @template K - Field names from the table schema
   * @param fields - Column names to group by
   * @returns This QueryBuilder instance for chaining
   *
   * @example
   * ```typescript
   * // Group by single column
   * const totals = await db.query('orders')
   *   .select('userId')
   *   .sum('amount', 'total')
   *   .groupBy('userId')
   *   .all();
   *
   * // Group by multiple columns
   * const stats = await db.query('orders')
   *   .select('userId', 'status')
   *   .sum('amount', 'total')
   *   .groupBy('userId', 'status')
   *   .all();
   * ```
   */
  groupBy<K extends keyof TRow>(...fields: K[]): QueryBuilder<TRow, TSelected> {
    return new QueryBuilder({
      ...this.#props,
      groupByFields: fields.map((f) => String(f)),
    });
  }

  /**
   * Execute an aggregate function as a terminal operation
   * @internal
   */
  private async executeAggregate(func: string, column: string): Promise<number | null> {
    let sql = `SELECT ${func}(${column}) as result FROM ${this.#props.tableName}`;

    if (this.#props.whereClauses.length > 0) {
      sql += ` WHERE ${this.buildWhereClause()}`;
    }

    const results = await this.#props.executeQuery(sql, [...this.#props.whereParams]) as Array<{ result: number | null }>;
    const result = results[0]?.result;

    // For SUM and AVG, return 0 if null (no rows or all nulls)
    if (func === 'SUM' || func === 'AVG') {
      return result ?? 0;
    }

    // For MIN and MAX, return null if no rows
    return result;
  }

  /**
   * Build the WHERE clause string using stored conjunctions
   * @returns WHERE clause string without the "WHERE" keyword
   * @internal
   */
  private buildWhereClause(): string {
    return this.buildWhereClauseFromProps(this.#props);
  }

  /**
   * Build WHERE clause from props object
   * @internal
   */
  private buildWhereClauseFromProps(props: QueryBuilderProps<TRow, TSelected>): string {
    if (props.whereClauses.length === 0) {
      return '';
    }

    let result = props.whereClauses[0];
    for (let i = 1; i < props.whereClauses.length; i++) {
      const conjunction = props.whereConjunctions[i - 1] || 'AND';
      result += ` ${conjunction} ${props.whereClauses[i]}`;
    }

    return result;
  }

  /**
   * Build the final SQL query string and parameters
   * @returns Object with SQL string and bind parameters
   * @internal
   */
  private buildSQL(): { sql: string; params: unknown[] } {
    let selectParts: string[] = [];

    // Add selected fields
    if (this.#props.selectedFields && this.#props.selectedFields.length > 0) {
      selectParts.push(...this.#props.selectedFields);
    }

    // Add aggregates
    if (this.#props.aggregates.length > 0) {
      const aggregateParts = this.#props.aggregates.map(
        (agg) => `${agg.func}(${agg.column}) as ${agg.alias}`
      );
      selectParts.push(...aggregateParts);
    }

    // If no fields or aggregates specified, use *
    const fields = selectParts.length > 0 ? selectParts.join(", ") : "*";
    let sql = `SELECT ${fields} FROM ${this.#props.tableName}`;

    if (this.#props.whereClauses.length > 0) {
      sql += ` WHERE ${this.buildWhereClause()}`;
    }

    if (this.#props.groupByFields.length > 0) {
      sql += ` GROUP BY ${this.#props.groupByFields.join(", ")}`;
    }

    if (this.#props.orderByClause) {
      sql += ` ORDER BY ${this.#props.orderByClause}`;
    }

    if (this.#props.limitCount !== undefined) {
      sql += ` LIMIT ${this.#props.limitCount}`;
    }

    if (this.#props.offsetCount !== undefined) {
      sql += ` OFFSET ${this.#props.offsetCount}`;
    }

    return { params: [...this.#props.whereParams], sql };
  }

  /**
   * Execute query and return all matching rows
   *
   * Returns an array of all rows that match the query conditions.
   * If select() was used, only the selected fields are included in each row.
   *
   * @returns Promise resolving to array of matching rows
   *
   * @example
   * ```typescript
   * // Get all users
   * const users = await db.query('users').all();
   *
   * // With filtering
   * const activeUsers = await db.query('users')
   *   .where('status', '=', 'active')
   *   .all();
   *
   * // With field selection
   * const emails = await db.query('users')
   *   .select('email')
   *   .all();
   * // emails type: Array<{ email: string }>
   * ```
   */
  async all(): Promise<QueryResult<TRow, TSelected>[]> {
    const { sql, params } = this.buildSQL();
    return this.#props.executeQuery<QueryResult<TRow, TSelected>>(sql, params);
  }

  /**
   * Execute query and return the first matching row or null
   *
   * Automatically adds LIMIT 1 to the query for efficiency.
   * Returns null if no rows match the conditions.
   *
   * @returns Promise resolving to first matching row or null
   *
   * @example
   * ```typescript
   * // Get user by ID
   * const user = await db.query('users')
   *   .where('id', '=', 1)
   *   .first();
   *
   * if (user) {
   *   console.log(user.name);
   * }
   *
   * // With field selection
   * const email = await db.query('users')
   *   .where('id', '=', 1)
   *   .select('email')
   *   .first();
   * // email type: { email: string } | null
   * ```
   */
  async first(): Promise<QueryResult<TRow, TSelected> | null> {
    // Create a temporary instance with limit(1) to avoid mutating this instance
    const limitedQuery = new QueryBuilder({
      ...this.#props,
      limitCount: 1,
    });

    const { sql, params } = limitedQuery.buildSQL();
    const results = await this.#props.executeQuery<QueryResult<TRow, TSelected>>(sql, params);

    return results[0] || null;
  }

  /**
   * Execute query and return count of matching rows
   *
   * Uses SQL COUNT(*) for efficient counting without fetching all rows.
   * Respects WHERE conditions but ignores SELECT, ORDER BY, LIMIT, and OFFSET.
   *
   * @returns Promise resolving to number of matching rows
   *
   * @example
   * ```typescript
   * // Count all users
   * const totalUsers = await db.query('users').count();
   *
   * // Count with filtering
   * const activeCount = await db.query('users')
   *   .where('status', '=', 'active')
   *   .count();
   *
   * // Pagination info
   * const total = await db.query('posts').count();
   * const pageSize = 20;
   * const totalPages = Math.ceil(total / pageSize);
   * ```
   */
  async count(): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${this.#props.tableName}`;

    if (this.#props.whereClauses.length > 0) {
      sql += ` WHERE ${this.buildWhereClause()}`;
    }

    const results = await this.#props.executeQuery(sql, [...this.#props.whereParams]) as Array<{ count: number }>;
    return results[0]?.count || 0;
  }

  /**
   * Change the output type of the query.
   *
   * This method doesn't change the SQL. It simply returns a copy of this
   * QueryBuilder with a new output type. Use when you know more about the
   * return type than TypeScript can infer.
   *
   * @template T - The target type to cast to
   * @returns QueryBuilder with cast type
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
  $castTo<T>(): QueryBuilder<T, TSelected extends keyof TRow ? keyof T & string : undefined> {
    return this as unknown as QueryBuilder<T, TSelected extends keyof TRow ? keyof T & string : undefined>;
  }

  /**
   * Omit null from the query's output type.
   *
   * Use when you know a field can't be null (e.g., after a NOT NULL check)
   * but TypeScript doesn't know that.
   *
   * @returns QueryBuilder with non-nullable fields
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
  $notNull(): QueryBuilder<{
    [K in keyof TRow]: NonNullable<TRow[K]>
  }, TSelected> {
    return this as unknown as QueryBuilder<{
      [K in keyof TRow]: NonNullable<TRow[K]>
    }, TSelected>;
  }

  /**
   * Narrow specific fields in the output type.
   *
   * @template T - Partial type with narrowed fields
   * @returns QueryBuilder with narrowed fields
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
      [K in keyof TRow]: K extends keyof T ? T[K] : TRow[K]
    },
    TSelected
  > {
    return this as unknown as QueryBuilder<
      {
        [K in keyof TRow]: K extends keyof T ? T[K] : TRow[K]
      },
      TSelected
    >;
  }
}
