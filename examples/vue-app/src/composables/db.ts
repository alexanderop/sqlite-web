/**
 * Typed database composables for this app
 *
 * This file creates fully typed composables based on our schema.
 * Import from here instead of directly from @alexop/sqlite-vue to get full type safety.
 */

import { createTypedComposables } from "@alexop/sqlite-vue";
import { z } from "zod";

// Define the same schema as in main.ts
const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean().default(false),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export const dbSchema = {
  todos: todoSchema,
} as const;

// Create and export typed composables
export const { useSQLiteClientAsync, useSQLiteQuery } =
  createTypedComposables<typeof dbSchema>();
