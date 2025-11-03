import type { z } from "zod";
import type { QueryResult, SQLOperator, SortDirection } from "./types";

/**
 * Query builder for SELECT queries with method chaining
 */
export class QueryBuilder<TRow, TSelected extends keyof TRow | undefined = undefined> {
  private whereClauses: string[] = [];
  private whereParams: unknown[] = [];
  private selectedFields: string[] | undefined;
  private orderByClause: string | undefined;
  private limitCount: number | undefined;
  private offsetCount: number | undefined;

  constructor(
    private executeQuery: <T = unknown>(sql: string, params: unknown[]) => Promise<T[]>,
    private tableName: string,
    private schema: z.ZodObject<z.ZodRawShape>
  ) {}

  /**
   * Add WHERE condition
   */
  where<K extends keyof TRow>(
    field: K,
    operator: SQLOperator,
    value: TRow[K] | TRow[K][]
  ): this {
    const fieldName = String(field);

    if (operator === 'IN' || operator === 'NOT IN') {
      const values = Array.isArray(value) ? value : [value];
      const placeholders = values.map(() => '?').join(', ');
      this.whereClauses.push(`${fieldName} ${operator} (${placeholders})`);
      this.whereParams.push(...values);
    } else {
      this.whereClauses.push(`${fieldName} ${operator} ?`);
      this.whereParams.push(value);
    }

    return this;
  }

  /**
   * Select specific fields (narrows return type)
   */
  select<K extends keyof TRow>(
    ...fields: K[]
  ): QueryBuilder<TRow, K> {
    this.selectedFields = fields.map((f) => String(f));
    return this as unknown as QueryBuilder<TRow, K>;
  }

  /**
   * Add ORDER BY clause
   */
  orderBy<K extends keyof TRow>(field: K, direction: SortDirection = 'ASC'): this {
    this.orderByClause = `${String(field)} ${direction}`;
    return this;
  }

  /**
   * Add LIMIT clause
   */
  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  /**
   * Add OFFSET clause (skip rows)
   */
  skip(count: number): this {
    this.offsetCount = count;
    return this;
  }

  /**
   * Build SQL query string and parameters
   */
  private buildSQL(): { sql: string; params: unknown[] } {
    const fields = this.selectedFields?.join(", ") || "*";
    let sql = `SELECT ${fields} FROM ${this.tableName}`;

    if (this.whereClauses.length > 0) {
      sql += ` WHERE ${this.whereClauses.join(" AND ")}`;
    }

    if (this.orderByClause) {
      sql += ` ORDER BY ${this.orderByClause}`;
    }

    if (this.limitCount !== undefined) {
      sql += ` LIMIT ${this.limitCount}`;
    }

    if (this.offsetCount !== undefined) {
      sql += ` OFFSET ${this.offsetCount}`;
    }

    return { params: this.whereParams, sql };
  }

  /**
   * Execute query and return all matching rows
   */
  async all(): Promise<QueryResult<TRow, TSelected>[]> {
    const { sql, params } = this.buildSQL();
    return this.executeQuery<QueryResult<TRow, TSelected>>(sql, params);
  }

  /**
   * Execute query and return first matching row or null
   */
  async first(): Promise<QueryResult<TRow, TSelected> | null> {
    const originalLimit = this.limitCount;
    this.limitCount = 1;

    const { sql, params } = this.buildSQL();
    const results = await this.executeQuery<QueryResult<TRow, TSelected>>(sql, params);

    this.limitCount = originalLimit;
    return results[0] || null;
  }

  /**
   * Execute query and return count of matching rows
   */
  async count(): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;

    if (this.whereClauses.length > 0) {
      sql += ` WHERE ${this.whereClauses.join(" AND ")}`;
    }

    const results = await this.executeQuery(sql, this.whereParams) as Array<{ count: number }>;
    return results[0]?.count || 0;
  }
}
