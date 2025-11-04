import type { z } from "zod";

/**
 * Schema registry type - maps table names to Zod schemas
 */
export type SchemaRegistry = Record<string, z.ZodObject<z.ZodRawShape>>;

/**
 * Infer TypeScript type from Zod schema
 */
export type InferSchema<T extends z.ZodObject<z.ZodRawShape>> = z.infer<T>;

/**
 * Get all table names from schema registry
 */
export type TableName<TSchema extends SchemaRegistry> = keyof TSchema & string;

/**
 * Get row type for a specific table
 */
export type TableRow<
  TSchema extends SchemaRegistry,
  TTable extends TableName<TSchema>
> = InferSchema<TSchema[TTable]>;

/**
 * Select specific fields from a row type
 */
export type SelectFields<T, K extends keyof T> = Pick<T, K>;

/**
 * Query result type based on selected fields
 * If no fields selected (TSelected = undefined), returns full row
 * Otherwise returns only selected fields
 */
export type QueryResult<
  TRow,
  TSelected extends keyof TRow | undefined
> = TSelected extends keyof TRow ? SelectFields<TRow, TSelected> : TRow;
