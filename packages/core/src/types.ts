/**
 * SQL comparison operators
 */
export type SQLOperator =
  | "="
  | ">"
  | "<"
  | ">="
  | "<="
  | "!="
  | "LIKE"
  | "IN"
  | "NOT IN"
  | "IS NULL"
  | "IS NOT NULL"
  | "BETWEEN";

/**
 * Sort direction
 */
export type SortDirection = "ASC" | "DESC";

/**
 * Represents a database migration with a version number and SQL statement
 * @example
 * ```typescript
 * const migration: Migration = {
 *   version: 1,
 *   sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)'
 * };
 * ```
 */
export type Migration = {
  /** Unique version number for the migration (must be positive integer) */
  version: number;
  /** SQL statement to execute for this migration */
  sql: string;
};
