---
title: Error Handling
description: Learn how to handle errors effectively with custom error classes
---

SQLite Web provides custom error classes that make it easier to handle different types of errors in your application. All errors inherit from the base `SQLiteError` class and include detailed information to help with debugging.

## Error Classes

### SQLiteError

The base error class for all SQLite-related errors.

**Properties:**

- `code: string` - Error code identifying the type of error
- `sql?: string` - The SQL statement that caused the error (when applicable)
- `message: string` - Human-readable error message

```typescript
import { SQLiteError } from "@alexop/sqlite-core";

try {
  await db.exec("INVALID SQL SYNTAX");
} catch (error) {
  if (error instanceof SQLiteError) {
    console.log(`Error code: ${error.code}`);
    console.log(`SQL: ${error.sql}`);
    console.log(`Message: ${error.message}`);
  }
}
```

### ValidationError

Thrown when Zod schema validation fails during insert or update operations.

**Properties:**

- All properties from `SQLiteError`
- `field: string` - The field name that failed validation
- `issues: ZodIssue[]` - Array of Zod validation issues with detailed error information

```typescript
import { ValidationError } from "@alexop/sqlite-core";

try {
  await db.insert("users").values({
    email: "invalid-email", // Not a valid email
    age: -5, // Negative age
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(`Field '${error.field}' failed validation`);

    // Loop through all validation issues
    error.issues.forEach((issue) => {
      console.log(`- ${issue.path.join(".")}: ${issue.message}`);
    });
  }
}
```

### ConstraintError

Thrown when a database constraint is violated (UNIQUE, FOREIGN KEY, NOT NULL, CHECK).

**Properties:**

- All properties from `SQLiteError`
- `constraint: string` - Description of the constraint that was violated

```typescript
import { ConstraintError } from "@alexop/sqlite-core";

try {
  // Try to insert duplicate email
  await db.insert("users").values({
    email: "duplicate@example.com",
  });
} catch (error) {
  if (error instanceof ConstraintError) {
    if (error.constraint.includes("UNIQUE")) {
      console.log("This email is already registered");
    }
  }
}
```

## Common Error Scenarios

### Validation Errors

Validation errors occur when data doesn't match the Zod schema:

```typescript
const schema = {
  users: z.object({
    name: z.string().min(3),
    email: z.string().email(),
    age: z.number().min(0).max(150),
  }),
};

try {
  await db.insert("users").values({
    name: "Jo", // Too short (min 3 characters)
    email: "not-an-email", // Invalid email format
    age: 200, // Too large (max 150)
  });
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
    console.error(`Validation failed: ${error.message}`);

    // Get all field errors
    const fieldErrors = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    console.table(fieldErrors);
  }
}
```

### Constraint Violations

#### UNIQUE Constraint

```typescript
// First user
await db.insert("users").values({
  email: "user@example.com",
  name: "John Doe",
});

// Try to insert duplicate email
try {
  await db.insert("users").values({
    email: "user@example.com", // Duplicate!
    name: "Jane Doe",
  });
} catch (error) {
  if (error instanceof ConstraintError) {
    if (error.constraint.includes("UNIQUE")) {
      console.log("Email already exists");
      // Show user a friendly message
    }
  }
}
```

#### FOREIGN KEY Constraint

```typescript
try {
  await db.insert("posts").values({
    userId: 999, // Non-existent user
    title: "My Post",
    content: "Post content",
  });
} catch (error) {
  if (error instanceof ConstraintError) {
    if (error.constraint.includes("FOREIGN KEY")) {
      console.log("Referenced user does not exist");
    }
  }
}
```

#### NOT NULL Constraint

```typescript
try {
  await db.exec(`
    INSERT INTO users (name) VALUES ('John')
    -- Missing required 'email' field
  `);
} catch (error) {
  if (error instanceof ConstraintError) {
    if (error.constraint.includes("NOT NULL")) {
      console.log("Required field is missing");
    }
  }
}
```

### SQL Errors

Generic SQL errors for syntax issues or invalid table names:

```typescript
try {
  await db.exec("SELECT * FROM non_existent_table");
} catch (error) {
  if (error instanceof SQLiteError) {
    if (error.code === "SQL_ERROR") {
      console.log("SQL execution failed:", error.message);
    }
  }
}
```

## Error Handling Best Practices

### 1. Use Type Guards

Always use `instanceof` checks to determine the error type:

```typescript
try {
  await db.insert("users").values(userData);
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
    return { success: false, errors: error.issues };
  } else if (error instanceof ConstraintError) {
    // Handle constraint violations
    return { success: false, message: "Duplicate entry" };
  } else if (error instanceof SQLiteError) {
    // Handle other SQL errors
    return { success: false, message: "Database error" };
  } else {
    // Handle unexpected errors
    throw error;
  }
}
```

### 2. Provide User-Friendly Messages

Convert technical errors into messages users can understand:

```typescript
function getUserMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    const field = error.field;
    const issue = error.issues[0];

    if (issue.code === "too_small") {
      return `${field} is too short`;
    }
    if (issue.code === "invalid_string" && issue.validation === "email") {
      return "Please enter a valid email address";
    }

    return `Invalid ${field}`;
  }

  if (error instanceof ConstraintError) {
    if (error.constraint.includes("UNIQUE")) {
      return "This value is already taken";
    }
    if (error.constraint.includes("FOREIGN KEY")) {
      return "Referenced item does not exist";
    }
  }

  return "An unexpected error occurred";
}
```

### 3. Log Detailed Errors

While showing user-friendly messages, log detailed errors for debugging:

```typescript
async function createUser(userData: any) {
  try {
    return await db.insert("users").values(userData);
  } catch (error) {
    // Log detailed error for debugging
    console.error("Failed to create user:", {
      error: error instanceof Error ? error.message : error,
      code: error instanceof SQLiteError ? error.code : undefined,
      sql: error instanceof SQLiteError ? error.sql : undefined,
      issues: error instanceof ValidationError ? error.issues : undefined,
    });

    // Show user-friendly message
    throw new Error(getUserMessage(error));
  }
}
```

### 4. Handle Errors in Forms

Example with Vue form handling:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { ValidationError, ConstraintError } from "@alexop/sqlite-core";

const form = ref({ name: "", email: "", age: 0 });
const errors = ref<Record<string, string>>({});

async function handleSubmit() {
  errors.value = {};

  try {
    const db = await useSQLiteClientAsync();
    await db.insert("users").values(form.value);

    // Success!
    alert("User created successfully");
  } catch (error) {
    if (error instanceof ValidationError) {
      // Map validation errors to form fields
      error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        errors.value[field] = issue.message;
      });
    } else if (error instanceof ConstraintError) {
      if (error.constraint.includes("UNIQUE")) {
        errors.value.email = "Email already registered";
      }
    }
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <input v-model="form.name" />
    <span v-if="errors.name">{{ errors.name }}</span>

    <input v-model="form.email" type="email" />
    <span v-if="errors.email">{{ errors.email }}</span>

    <input v-model="form.age" type="number" />
    <span v-if="errors.age">{{ errors.age }}</span>

    <button>Submit</button>
  </form>
</template>
```

## Error Codes

All errors include a `code` property:

| Code               | Description                           |
| ------------------ | ------------------------------------- |
| `VALIDATION_ERROR` | Zod schema validation failed          |
| `CONSTRAINT_ERROR` | Database constraint violated          |
| `SQL_ERROR`        | SQL syntax error or execution failure |

## Next Steps

- Learn about [Schema Definition](/core/schema) to prevent validation errors
- See [Mutations](/core/mutations) for insert/update/delete operations
- Explore [Type Safety](/guides/type-safety) for compile-time error prevention
