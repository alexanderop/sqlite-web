import { z } from "zod";

/**
 * Map Zod type to SQLite column type
 */
export function zodTypeToSQL(schema: z.ZodTypeAny): string {
  // Unwrap optional, nullable, default
  if (schema instanceof z.ZodOptional) {
    return zodTypeToSQL(schema._def.innerType as z.ZodTypeAny);
  }
  if (schema instanceof z.ZodNullable) {
    return zodTypeToSQL(schema._def.innerType as z.ZodTypeAny);
  }
  if (schema instanceof z.ZodDefault) {
    return zodTypeToSQL(schema._def.innerType as z.ZodTypeAny);
  }

  // Map primitive types
  if (schema instanceof z.ZodString) {return "TEXT";}
  if (schema instanceof z.ZodNumber) {return "REAL";}
  if (schema instanceof z.ZodBoolean) {return "INTEGER";}
  if (schema instanceof z.ZodDate) {return "TEXT";}
  if (schema instanceof z.ZodEnum) {return "TEXT";}
  if (schema instanceof z.ZodLiteral) {return "TEXT";}

  // Fallback
  return "TEXT";
}

/**
 * Check if a Zod schema is optional/nullable
 */
export function isOptional(schema: z.ZodTypeAny): boolean {
  if (schema instanceof z.ZodOptional) {return true;}
  if (schema instanceof z.ZodNullable) {return true;}
  if (schema instanceof z.ZodDefault) {return true;}
  return false;
}

/**
 * Get default value from Zod schema if it has one
 */
export function getDefaultValue(schema: z.ZodTypeAny): unknown {
  if (schema instanceof z.ZodDefault) {
    const defaultValue = schema._def.defaultValue;
    return typeof defaultValue === "function" ? defaultValue() : defaultValue;
  }
  return undefined;
}

/**
 * Generate CREATE TABLE statement from Zod schema
 */
export function schemaToCreateTable(
  tableName: string,
  schema: z.ZodObject<z.ZodRawShape>,
  options: { primaryKey?: string } = {}
): string {
  const shape = schema.shape;
  const columns: string[] = [];

  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    const sqlType = zodTypeToSQL(fieldSchema as z.ZodTypeAny);
    const optional = isOptional(fieldSchema as z.ZodTypeAny);
    const defaultVal = getDefaultValue(fieldSchema as z.ZodTypeAny);

    let columnDef = `${fieldName} ${sqlType}`;

    // Add PRIMARY KEY constraint
    if (options.primaryKey === fieldName) {
      columnDef += " PRIMARY KEY";
    }

    // Add NOT NULL constraint
    if (!optional && !defaultVal && options.primaryKey !== fieldName) {
      columnDef += " NOT NULL";
    }

    // Add DEFAULT constraint
    if (defaultVal !== undefined) {
      if (typeof defaultVal === "string") {
        columnDef += ` DEFAULT '${defaultVal}'`;
      } else if (typeof defaultVal === "number" || typeof defaultVal === "boolean") {
        columnDef += ` DEFAULT ${defaultVal}`;
      }
    }

    columns.push(columnDef);
  }

  return `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${columns.join(",\n  ")}\n)`;
}
