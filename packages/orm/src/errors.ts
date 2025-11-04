import { SQLiteError } from "@alexop/sqlite-core";
import type { ZodIssue } from "zod";

// Type declaration for V8-specific Error.captureStackTrace
interface ErrorConstructor {
  captureStackTrace?(targetObject: object, constructorOpt?: Function): void;
}

/**
 * Error thrown when Zod schema validation fails during insert or update operations
 *
 * Contains detailed information about which fields failed validation and why,
 * including the original Zod validation issues for debugging.
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert("users").values({
 *     email: "invalid-email",
 *     age: -5
 *   });
 * } catch (e) {
 *   if (e instanceof ValidationError) {
 *     console.log(`Field '${e.field}' failed validation`);
 *     e.issues.forEach(issue => {
 *       console.log(`- ${issue.path.join(".")}: ${issue.message}`);
 *     });
 *   }
 * }
 * ```
 */
export class ValidationError extends SQLiteError {
  /** The field name that failed validation (for single-field errors) */
  field: string;
  /** Array of Zod validation issues with detailed error information */
  issues: ZodIssue[];

  constructor(message: string, field: string, issues: ZodIssue[]) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.field = field;
    this.issues = issues;
    (Error as ErrorConstructor).captureStackTrace?.(this, ValidationError);
  }
}
