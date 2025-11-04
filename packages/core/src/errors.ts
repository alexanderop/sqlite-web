// Type declaration for V8-specific Error.captureStackTrace
interface ErrorConstructor {
  captureStackTrace?(targetObject: object, constructorOpt?: Function): void;
}

/**
 * Base error class for all SQLite-related errors
 *
 * Extends the native Error class with SQLite-specific properties like
 * error codes and SQL statements. All custom SQLite errors inherit from this class.
 *
 * @example
 * ```typescript
 * try {
 *   await db.exec("INVALID SQL");
 * } catch (e) {
 *   if (e instanceof SQLiteError) {
 *     console.log(`Error code: ${e.code}`);
 *     console.log(`SQL: ${e.sql}`);
 *   }
 * }
 * ```
 */
export class SQLiteError extends Error {
  /** Error code identifying the type of error */
  code: string;
  /** The SQL statement that caused the error (if applicable) */
  sql?: string;

  constructor(message: string, code: string, sql?: string) {
    super(message);
    this.name = "SQLiteError";
    this.code = code;
    this.sql = sql;
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    (Error as ErrorConstructor).captureStackTrace?.(this, SQLiteError);
  }
}

/**
 * Error thrown when a database constraint is violated
 *
 * Handles UNIQUE, FOREIGN KEY, NOT NULL, and CHECK constraint violations.
 * Provides detailed information about which constraint was violated.
 *
 * @example
 * ```typescript
 * // UNIQUE constraint
 * try {
 *   await db.insert("users").values({ email: "duplicate@example.com" });
 * } catch (e) {
 *   if (e instanceof ConstraintError) {
 *     console.log(`Constraint violated: ${e.constraint}`);
 *     // Output: "Constraint violated: UNIQUE constraint failed: users.email"
 *   }
 * }
 *
 * // FOREIGN KEY constraint
 * try {
 *   await db.insert("posts").values({ userId: 999 }); // Non-existent user
 * } catch (e) {
 *   if (e instanceof ConstraintError) {
 *     console.log(e.constraint); // "FOREIGN KEY constraint failed"
 *   }
 * }
 * ```
 */
export class ConstraintError extends SQLiteError {
  /** Description of the constraint that was violated */
  constraint: string;

  constructor(message: string, constraint: string, sql?: string) {
    super(message, "CONSTRAINT_ERROR", sql);
    this.name = "ConstraintError";
    this.constraint = constraint;
    (Error as ErrorConstructor).captureStackTrace?.(this, ConstraintError);
  }
}

/**
 * Parse SQLite error message and create appropriate error instance
 *
 * Analyzes the error message to determine if it's a constraint violation,
 * validation error, or generic SQL error, and creates the appropriate error type.
 *
 * @param message - Original error message from SQLite
 * @param sql - SQL statement that caused the error
 * @returns Appropriate error instance (ConstraintError or SQLiteError)
 * @internal
 */
export function parseSQLiteError(message: string, sql?: string): SQLiteError {
  // Check for constraint violations
  if (message.includes("UNIQUE constraint failed")) {
    const match = message.match(/UNIQUE constraint failed: (.+)/);
    const constraint = match ? match[0] : "UNIQUE constraint failed";
    return new ConstraintError(message, constraint, sql);
  }

  if (message.includes("FOREIGN KEY constraint failed")) {
    return new ConstraintError(message, "FOREIGN KEY constraint failed", sql);
  }

  if (message.includes("NOT NULL constraint failed")) {
    const match = message.match(/NOT NULL constraint failed: (.+)/);
    const constraint = match ? match[0] : "NOT NULL constraint failed";
    return new ConstraintError(message, constraint, sql);
  }

  if (message.includes("CHECK constraint failed")) {
    const match = message.match(/CHECK constraint failed: (.+)/);
    const constraint = match ? match[0] : "CHECK constraint failed";
    return new ConstraintError(message, constraint, sql);
  }

  // Generic SQL error
  return new SQLiteError(message, "SQL_ERROR", sql);
}
