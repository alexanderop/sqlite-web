import type { z } from "zod";
import type { SQLOperator } from "./types";

/**
 * Insert builder for INSERT operations with Zod validation
 */
export class InsertBuilder<TRow> {
  constructor(
    private executeQuery: (sql: string, params: unknown[]) => Promise<any>,
    private tableName: string,
    private schema: z.ZodObject<any>
  ) {}

  /**
   * Insert a row with validation
   * Returns the last inserted row ID
   */
  async values(data: Partial<TRow>): Promise<number> {
    // Validate with Zod - use partial to allow optional fields
    const validated = this.schema.partial().parse(data);

    const keys = Object.keys(validated);
    const values = Object.values(validated);
    const placeholders = keys.map(() => "?").join(", ");

    const sql = `INSERT INTO ${this.tableName} (${keys.join(", ")}) VALUES (${placeholders})`;
    await this.executeQuery(sql, values);

    // Get last insert row ID
    const result = await this.executeQuery(
      "SELECT last_insert_rowid() as id",
      []
    );
    return (result[0] as any)?.id || 0;
  }
}

/**
 * Update builder for UPDATE operations with WHERE conditions
 */
export class UpdateBuilder<TRow> {
  private whereClauses: string[] = [];
  private whereParams: unknown[] = [];
  private setData: Partial<TRow> | undefined;

  constructor(
    private executeQuery: (sql: string, params: unknown[]) => Promise<any>,
    private tableName: string,
    private schema: z.ZodObject<any>
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
   * Set the data to update (with partial validation)
   */
  set(data: Partial<TRow>): this {
    this.setData = data;
    return this;
  }

  /**
   * Execute the update
   * Returns the number of affected rows
   */
  async execute(): Promise<number> {
    if (!this.setData) {
      throw new Error("No data to update. Call set() before execute()");
    }

    // Validate with Zod partial schema
    const validated = this.schema.partial().parse(this.setData);

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
    const result = await this.executeQuery("SELECT changes() as count", []);
    return (result[0] as any)?.count || 0;
  }
}

/**
 * Delete builder for DELETE operations with WHERE conditions
 */
export class DeleteBuilder<TRow> {
  private whereClauses: string[] = [];
  private whereParams: unknown[] = [];

  constructor(
    private executeQuery: (sql: string, params: unknown[]) => Promise<any>,
    private tableName: string
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
   * Execute the delete
   * Returns the number of affected rows
   */
  async execute(): Promise<number> {
    let sql = `DELETE FROM ${this.tableName}`;

    if (this.whereClauses.length > 0) {
      sql += ` WHERE ${this.whereClauses.join(" AND ")}`;
    }

    await this.executeQuery(sql, this.whereParams);

    // Get number of affected rows
    const result = await this.executeQuery("SELECT changes() as count", []);
    return (result[0] as any)?.count || 0;
  }
}
