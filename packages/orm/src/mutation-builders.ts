import { type z, ZodError } from "zod";
import type { SQLOperator } from "@alexop/sqlite-core";
import { ValidationError } from "./errors";

/**
 * Insert builder for INSERT operations with Zod validation
 *
 * Handles both single and batch inserts with automatic runtime validation
 * using the table's Zod schema. All data is validated before insertion.
 *
 * @template TRow - Row type from the table schema
 *
 * @example
 * ```typescript
 * // Single insert
 * const id = await db.insert('users').values({
 *   name: 'Alice',
 *   email: 'alice@example.com'
 * });
 *
 * // Batch insert
 * await db.insert('users').values([
 *   { name: 'Bob', email: 'bob@example.com' },
 *   { name: 'Charlie', email: 'charlie@example.com' }
 * ]);
 * ```
 */
export class InsertBuilder<TRow> {
  /**
   * Create a new InsertBuilder instance
   * @param executeQuery - Function to execute SQL queries
   * @param tableName - Name of the table to insert into
   * @param schema - Zod schema for runtime validation
   * @internal
   */
  constructor(
    private executeQuery: <T = unknown>(
      sql: string,
      params: unknown[]
    ) => Promise<T[]>,
    private tableName: string,
    private schema: z.ZodObject<z.ZodRawShape>
  ) {}

  /**
   * Insert one or more rows with Zod validation
   *
   * Validates all data against the table schema before insertion.
   * Automatically detects single vs batch insert based on input type.
   * All fields are optional (uses schema.partial() for validation).
   *
   * @param data - Single row object or array of row objects to insert
   * @returns Promise resolving to the last inserted row ID
   * @throws {z.ZodError} If validation fails
   *
   * @example
   * ```typescript
   * // Single insert
   * const userId = await db.insert('users').values({
   *   name: 'Alice',
   *   email: 'alice@example.com',
   *   age: 25
   * });
   *
   * // Batch insert (more efficient than multiple single inserts)
   * const lastId = await db.insert('users').values([
   *   { name: 'Bob', email: 'bob@example.com' },
   *   { name: 'Charlie', email: 'charlie@example.com' },
   *   { name: 'Diana', email: 'diana@example.com' }
   * ]);
   *
   * // Partial data (fields can be omitted if schema allows)
   * await db.insert('posts').values({
   *   title: 'My Post',
   *   // other fields will use DEFAULT values
   * });
   * ```
   */
  async values(data: Partial<TRow> | Partial<TRow>[]): Promise<number> {
    if (Array.isArray(data)) {
      return this.batchInsert(data);
    }
    return this.singleInsert(data);
  }

  /**
   * Insert a single row into the table
   * @param data - Row data to insert
   * @returns Last inserted row ID
   * @internal
   */
  private async singleInsert(data: Partial<TRow>): Promise<number> {
    let validated: Partial<TRow>;
    try {
      validated = this.schema.partial().parse(data) as Partial<TRow>;
    } catch (error) {
      if (error instanceof ZodError) {
        const firstIssue = error.issues[0];
        const field = firstIssue?.path[0]?.toString() || "unknown";
        throw new ValidationError(
          `Validation failed for field '${field}': ${firstIssue?.message || "Invalid data"}`,
          field,
          error.issues
        );
      }
      throw error;
    }

    const keys = Object.keys(validated);
    const values = Object.values(validated);
    const placeholders = keys.map(() => "?").join(", ");

    const sql = `INSERT INTO ${this.tableName} (${keys.join(", ")}) VALUES (${placeholders})`;
    await this.executeQuery(sql, values);

    return this.getLastInsertId();
  }

  /**
   * Insert multiple rows in a single SQL statement (batch operation)
   * @param data - Array of row objects to insert
   * @returns Last inserted row ID
   * @internal
   */
  private async batchInsert(data: Partial<TRow>[]): Promise<number> {
    if (data.length === 0) {
      return 0;
    }

    // Validate all rows before executing
    let validatedRows: Partial<TRow>[];
    try {
      validatedRows = data.map(
        (row) => this.schema.partial().parse(row) as Partial<TRow>
      );
    } catch (error) {
      if (error instanceof ZodError) {
        const firstIssue = error.issues[0];
        const field = firstIssue?.path[0]?.toString() || "unknown";
        throw new ValidationError(
          `Validation failed for field '${field}': ${firstIssue?.message || "Invalid data"}`,
          field,
          error.issues
        );
      }
      throw error;
    }

    // Build multi-row INSERT statement
    const keys = Object.keys(validatedRows[0]);
    const placeholders = keys.map(() => "?").join(", ");
    const valuesClauses = validatedRows
      .map(() => `(${placeholders})`)
      .join(", ");

    const sql = `INSERT INTO ${this.tableName} (${keys.join(", ")}) VALUES ${valuesClauses}`;
    const allValues = validatedRows.flatMap((row) => Object.values(row));

    await this.executeQuery(sql, allValues);

    return this.getLastInsertId();
  }

  /**
   * Get the last inserted row ID using SQLite's last_insert_rowid()
   * @returns Last inserted row ID
   * @internal
   */
  private async getLastInsertId(): Promise<number> {
    const result = (await this.executeQuery(
      "SELECT last_insert_rowid() as id",
      []
    )) as Array<{ id: number }>;
    return result[0]?.id || 0;
  }
}

/**
 * Update builder for UPDATE operations with WHERE conditions and Zod validation
 *
 * Provides a fluent API for building UPDATE queries with type-safe field names
 * and runtime validation. Supports multiple WHERE conditions combined with AND.
 *
 * @template TRow - Row type from the table schema
 *
 * @example
 * ```typescript
 * // Update a single user
 * await db.update('users')
 *   .where('id', '=', 1)
 *   .set({ name: 'Updated Name', age: 26 })
 *   .execute();
 *
 * // Update multiple rows
 * await db.update('users')
 *   .where('status', '=', 'pending')
 *   .set({ status: 'active' })
 *   .execute();
 * ```
 */
export class UpdateBuilder<TRow> {
  private whereClauses: string[] = [];
  private whereParams: unknown[] = [];
  private setData: Partial<TRow> | undefined;

  /**
   * Create a new UpdateBuilder instance
   * @param executeQuery - Function to execute SQL queries
   * @param tableName - Name of the table to update
   * @param schema - Zod schema for runtime validation
   * @internal
   */
  constructor(
    private executeQuery: <T = unknown>(
      sql: string,
      params: unknown[]
    ) => Promise<T[]>,
    private tableName: string,
    private schema: z.ZodObject<z.ZodRawShape>
  ) {}

  /**
   * Add a WHERE condition to filter which rows to update
   *
   * Multiple WHERE calls are combined with AND. Supports standard comparison
   * operators and IN/NOT IN for array values.
   *
   * @template K - Field name from the table schema
   * @param field - Column name to filter on (type-safe)
   * @param operator - SQL comparison operator
   * @param value - Value to compare against (or array for IN/NOT IN)
   * @returns This UpdateBuilder instance for chaining
   *
   * @example
   * ```typescript
   * // Single condition
   * db.update('users')
   *   .where('id', '=', 1)
   *   .set({ name: 'Alice' })
   *
   * // Multiple conditions
   * db.update('users')
   *   .where('status', '=', 'active')
   *   .where('age', '>', 18)
   *   .set({ verified: true })
   *
   * // IN operator
   * db.update('users')
   *   .where('id', 'IN', [1, 2, 3])
   *   .set({ group: 'premium' })
   * ```
   */
  where<K extends keyof TRow>(
    field: K,
    operator: SQLOperator,
    value: TRow[K] | TRow[K][]
  ): this {
    const fieldName = String(field);

    if (operator === "IN" || operator === "NOT IN") {
      const values = Array.isArray(value) ? value : [value];
      const placeholders = values.map(() => "?").join(", ");
      this.whereClauses.push(`${fieldName} ${operator} (${placeholders})`);
      this.whereParams.push(...values);
    } else {
      this.whereClauses.push(`${fieldName} ${operator} ?`);
      this.whereParams.push(value);
    }

    return this;
  }

  /**
   * Specify the field values to update with Zod validation
   *
   * Validates data against the table schema before updating.
   * All fields are optional (uses schema.partial() for validation).
   *
   * @param data - Partial object with fields to update
   * @returns This UpdateBuilder instance for chaining
   * @throws {z.ZodError} If validation fails
   *
   * @example
   * ```typescript
   * // Update single field
   * db.update('users')
   *   .where('id', '=', 1)
   *   .set({ name: 'New Name' })
   *
   * // Update multiple fields
   * db.update('users')
   *   .where('id', '=', 1)
   *   .set({ name: 'Alice', age: 26, status: 'active' })
   * ```
   */
  set(data: Partial<TRow>): this {
    this.setData = data;
    return this;
  }

  /**
   * Execute the UPDATE statement
   *
   * Runs the UPDATE query with all specified WHERE conditions and SET values.
   * Returns the number of rows that were actually modified.
   *
   * @returns Promise resolving to number of affected rows
   * @throws {Error} If set() was not called before execute()
   * @throws {z.ZodError} If validation fails
   *
   * @example
   * ```typescript
   * // Execute and get affected count
   * const count = await db.update('users')
   *   .where('status', '=', 'pending')
   *   .set({ status: 'active' })
   *   .execute();
   * console.log(`Updated ${count} users`);
   *
   * // Check if update succeeded
   * const updated = await db.update('users')
   *   .where('id', '=', 1)
   *   .set({ lastLogin: new Date().toISOString() })
   *   .execute();
   * if (updated === 0) {
   *   console.log('User not found');
   * }
   * ```
   */
  async execute(): Promise<number> {
    if (!this.setData) {
      throw new Error("No data to update. Call set() before execute()");
    }

    // Validate with Zod partial schema
    let validated: Partial<TRow>;
    try {
      validated = this.schema.partial().parse(this.setData) as Partial<TRow>;
    } catch (error) {
      if (error instanceof ZodError) {
        const firstIssue = error.issues[0];
        const field = firstIssue?.path[0]?.toString() || "unknown";
        throw new ValidationError(
          `Validation failed for field '${field}': ${firstIssue?.message || "Invalid data"}`,
          field,
          error.issues
        );
      }
      throw error;
    }

    const setClause = Object.keys(validated)
      .map((k) => `${k} = ?`)
      .join(", ");

    let sql = `UPDATE ${this.tableName} SET ${setClause}`;
    const params = [...Object.values(validated), ...this.whereParams];

    if (this.whereClauses.length > 0) {
      sql += ` WHERE ${this.whereClauses.join(" AND ")}`;
    }

    await this.executeQuery(sql, params);

    // Get number of affected rows
    const result = (await this.executeQuery(
      "SELECT changes() as count",
      []
    )) as Array<{ count: number }>;
    return result[0]?.count || 0;
  }
}

/**
 * Delete builder for DELETE operations with WHERE conditions
 *
 * Provides a fluent API for building DELETE queries with type-safe field names.
 * Supports multiple WHERE conditions combined with AND.
 *
 * @template TRow - Row type from the table schema
 *
 * @example
 * ```typescript
 * // Delete a single row
 * await db.delete('users')
 *   .where('id', '=', 1)
 *   .execute();
 *
 * // Delete multiple rows
 * await db.delete('posts')
 *   .where('status', '=', 'draft')
 *   .where('createdAt', '<', oldDate)
 *   .execute();
 * ```
 */
export class DeleteBuilder<TRow> {
  private whereClauses: string[] = [];
  private whereParams: unknown[] = [];

  /**
   * Create a new DeleteBuilder instance
   * @param executeQuery - Function to execute SQL queries
   * @param tableName - Name of the table to delete from
   * @internal
   */
  constructor(
    private executeQuery: <T = unknown>(
      sql: string,
      params: unknown[]
    ) => Promise<T[]>,
    private tableName: string
  ) {}

  /**
   * Add a WHERE condition to filter which rows to delete
   *
   * Multiple WHERE calls are combined with AND. Supports standard comparison
   * operators and IN/NOT IN for array values.
   *
   * WARNING: Calling execute() without any WHERE conditions will delete ALL rows.
   *
   * @template K - Field name from the table schema
   * @param field - Column name to filter on (type-safe)
   * @param operator - SQL comparison operator
   * @param value - Value to compare against (or array for IN/NOT IN)
   * @returns This DeleteBuilder instance for chaining
   *
   * @example
   * ```typescript
   * // Delete single row by ID
   * db.delete('users')
   *   .where('id', '=', 1)
   *
   * // Delete multiple rows
   * db.delete('users')
   *   .where('status', '=', 'inactive')
   *   .where('lastLogin', '<', cutoffDate)
   *
   * // Delete with IN operator
   * db.delete('users')
   *   .where('id', 'IN', [1, 2, 3])
   * ```
   */
  where<K extends keyof TRow>(
    field: K,
    operator: SQLOperator,
    value: TRow[K] | TRow[K][]
  ): this {
    const fieldName = String(field);

    if (operator === "IN" || operator === "NOT IN") {
      const values = Array.isArray(value) ? value : [value];
      const placeholders = values.map(() => "?").join(", ");
      this.whereClauses.push(`${fieldName} ${operator} (${placeholders})`);
      this.whereParams.push(...values);
    } else {
      this.whereClauses.push(`${fieldName} ${operator} ?`);
      this.whereParams.push(value);
    }

    return this;
  }

  /**
   * Execute the DELETE statement
   *
   * Runs the DELETE query with all specified WHERE conditions.
   * Returns the number of rows that were actually deleted.
   *
   * WARNING: If no WHERE conditions were added, this will delete ALL rows from the table.
   *
   * @returns Promise resolving to number of deleted rows
   *
   * @example
   * ```typescript
   * // Delete and get count
   * const count = await db.delete('users')
   *   .where('status', '=', 'deleted')
   *   .execute();
   * console.log(`Deleted ${count} users`);
   *
   * // Check if delete succeeded
   * const deleted = await db.delete('posts')
   *   .where('id', '=', 1)
   *   .execute();
   * if (deleted === 0) {
   *   console.log('Post not found');
   * }
   *
   * // Cleanup old records
   * const removed = await db.delete('logs')
   *   .where('createdAt', '<', thirtyDaysAgo)
   *   .execute();
   * ```
   */
  async execute(): Promise<number> {
    let sql = `DELETE FROM ${this.tableName}`;

    if (this.whereClauses.length > 0) {
      sql += ` WHERE ${this.whereClauses.join(" AND ")}`;
    }

    await this.executeQuery(sql, this.whereParams);

    // Get number of affected rows
    const result = (await this.executeQuery(
      "SELECT changes() as count",
      []
    )) as Array<{ count: number }>;
    return result[0]?.count || 0;
  }
}
