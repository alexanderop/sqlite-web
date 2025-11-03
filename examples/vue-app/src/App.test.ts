import { beforeEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-vue";
import { page } from "vitest/browser";
import { createSQLite } from "@alexop/sqlite-vue";
import { z } from "zod";
import App from "./App.vue";

// Define Zod schema for the database
const todoSchema = z.object({
  completed: z.boolean().default(false), createdAt: z.string().default(() => new Date().toISOString()), id: z.string(), title: z.string(),
});

const dbSchema = {
  todos: todoSchema,
} as const;

// Helper to render App with SQLite plugin
function renderApp() {
  const sqlitePlugin = createSQLite({
    filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`, migrations: [
      {
        sql: `
          CREATE TABLE IF NOT EXISTS todos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `, version: 1,
      },
    ], schema: dbSchema,
  });

  return render(App, {
    global: {
      plugins: [sqlitePlugin],
    },
  });
}

describe("Todo App - Component Integration Tests", () => {
  beforeEach(async () => {
    // Each test gets a fresh render of the app
  });

  describe("Initial Render", () => {
    it("should display the app title", async () => {
      const screen = renderApp();
      await expect.element(screen.getByText("SQLite Vue test")).toBeInTheDocument();
    });

    it("should display empty state when no todos", async () => {
      renderApp();
      // Wait for loading to finish
      await expect.element(page.getByText("No todos yet.")).toBeInTheDocument();
    });

    it("should render input field and add button", async () => {
      renderApp();
      await expect.element(page.getByPlaceholder("Todo title")).toBeInTheDocument();
      await expect.element(page.getByRole("button", { name: /add/i })).toBeInTheDocument();
    });
  });

  describe("Adding Todos", () => {
    it("should add a new todo", async () => {
      renderApp();

      // Wait for app to be ready

      // Fill in the input
      const input = page.getByPlaceholder("Todo title");
      await input.fill("Buy groceries");

      // Click add button
      await page.getByRole("button", { name: /add/i }).click();

      // Verify todo appears in the list
      await expect.element(page.getByText("Buy groceries")).toBeInTheDocument();
    });

    it("should clear input after adding todo", async () => {
      renderApp();


      const input = page.getByPlaceholder("Todo title");
      await input.fill("Test todo");
      await page.getByRole("button", { name: /add/i }).click();

      // Input should be cleared
      await expect.element(input).toHaveValue("");
    });

    it("should not add empty todos", async () => {
      renderApp();


      // Try to add empty todo
      await page.getByRole("button", { name: /add/i }).click();

      // Should still show empty state
      await expect.element(page.getByText("No todos yet.")).toBeInTheDocument();
    });

    it("should add multiple todos", async () => {
      renderApp();


      const input = page.getByPlaceholder("Todo title");
      const addButton = page.getByRole("button", { name: /add/i });

      // Add first todo
      await input.fill("First todo");
      await addButton.click();
      // Wait for first todo to appear
      await expect.element(page.getByText("First todo")).toBeInTheDocument();

      // Add second todo
      await input.fill("Second todo");
      await addButton.click();
      // Wait for second todo to appear
      await expect.element(page.getByText("Second todo")).toBeInTheDocument();

      // Both should still be visible
      await expect.element(page.getByText("First todo")).toBeInTheDocument();
      await expect.element(page.getByText("Second todo")).toBeInTheDocument();
    });
  });

  describe("Completing Todos", () => {
    it("should toggle todo completion", async () => {
      renderApp();


      // Add a todo
      await page.getByPlaceholder("Todo title").fill("Complete me");
      await page.getByRole("button", { name: /add/i }).click();

      // Find and click the checkbox
      const checkbox = page.getByRole("checkbox").first();
      await checkbox.click();

      // Checkbox should be checked
      await expect.element(checkbox).toBeChecked();

      // Click again to uncheck
      await checkbox.click();
      await expect.element(checkbox).not.toBeChecked();
    });

    it("should apply strikethrough style to completed todos", async () => {
      renderApp();


      // Add and complete a todo
      await page.getByPlaceholder("Todo title").fill("Completed todo");
      await page.getByRole("button", { name: /add/i }).click();

      const checkbox = page.getByRole("checkbox").first();
      await checkbox.click();

      // Wait for the UI to update
      await expect.element(checkbox).toBeChecked();

      // The text should have line-through class
      const todoText = page.getByText("Completed todo");
      await expect.element(todoText).toHaveClass(/line-through/);
    });
  });

  describe("Editing Todos", () => {
    it("should enter edit mode when clicking edit button", async () => {
      renderApp();


      // Add a todo
      await page.getByPlaceholder("Todo title").fill("Original title");
      await page.getByRole("button", { name: /add/i }).click();

      // Click edit button
      await page.getByRole("button", { name: /edit/i }).click();

      // Should show save and cancel buttons
      await expect.element(page.getByRole("button", { name: /save/i })).toBeInTheDocument();
      await expect.element(page.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("should update todo title when saving", async () => {
      renderApp();


      // Add a todo
      await page.getByPlaceholder("Todo title").fill("Old title");
      await page.getByRole("button", { name: /add/i }).click();

      // Click edit
      await page.getByRole("button", { name: /edit/i }).click();

      // The edit input becomes the focused textbox
      // Get all textboxes - the second one is the edit input
      const editInput = page.getByRole("textbox").nth(1);

      // Type new title (fill replaces existing value)
      await editInput.fill("New title");

      // Save
      await page.getByRole("button", { name: /save/i }).click();

      // Verify updated title
      await expect.element(page.getByText("New title")).toBeInTheDocument();
      await expect.element(page.getByText("Old title")).not.toBeInTheDocument();
    });

    it("should cancel editing without saving changes", async () => {
      renderApp();


      // Add a todo
      await page.getByPlaceholder("Todo title").fill("Original title");
      await page.getByRole("button", { name: /add/i }).click();

      // Click edit
      await page.getByRole("button", { name: /edit/i }).click();

      // Modify the title - get the edit input (second textbox)
      const editInput = page.getByRole("textbox").nth(1);
      await editInput.fill("Modified title");

      // Cancel
      await page.getByRole("button", { name: /cancel/i }).click();

      // Should still show original title
      await expect.element(page.getByText("Original title")).toBeInTheDocument();
      await expect.element(page.getByText("Modified title")).not.toBeInTheDocument();
    });
  });

  describe("Deleting Todos", () => {
    it("should delete a todo when clicking delete button", async () => {
      renderApp();


      // Add a todo
      await page.getByPlaceholder("Todo title").fill("To be deleted");
      await page.getByRole("button", { name: /add/i }).click();

      // Verify it exists
      await expect.element(page.getByText("To be deleted")).toBeInTheDocument();

      // Click delete
      await page.getByRole("button", { name: /delete/i }).click();

      // Should be removed
      await expect.element(page.getByText("To be deleted")).not.toBeInTheDocument();
      await expect.element(page.getByText("No todos yet.")).toBeInTheDocument();
    });

    it("should delete the correct todo when multiple exist", async () => {
      renderApp();


      const input = page.getByPlaceholder("Todo title");
      const addButton = page.getByRole("button", { name: /add/i });

      // Add multiple todos
      await input.fill("First todo");
      await addButton.click();
      await expect.element(page.getByText("First todo")).toBeInTheDocument();

      await input.fill("Second todo");
      await addButton.click();
      await expect.element(page.getByText("Second todo")).toBeInTheDocument();

      await input.fill("Third todo");
      await addButton.click();
      await expect.element(page.getByText("Third todo")).toBeInTheDocument();

      // Delete the second one (middle one in the list)
      const deleteButtons = page.getByRole("button", { name: /delete/i }).elements();
      await deleteButtons[1].click();

      // First and third should remain
      await expect.element(page.getByText("First todo")).toBeInTheDocument();
      await expect.element(page.getByText("Second todo")).not.toBeInTheDocument();
      await expect.element(page.getByText("Third todo")).toBeInTheDocument();
    });
  });

  describe("Full CRUD Flow", () => {
    it("should complete full todo lifecycle", async () => {
      renderApp();


      // 1. Add a todo
      await page.getByPlaceholder("Todo title").fill("Learn Vitest");
      await page.getByRole("button", { name: /add/i }).click();
      await expect.element(page.getByText("Learn Vitest")).toBeInTheDocument();

      // 2. Edit the todo
      await page.getByRole("button", { name: /edit/i }).click();
      const editInput = page.getByRole("textbox").nth(1);
      await editInput.fill("Master Vitest");
      await page.getByRole("button", { name: /save/i }).click();
      await expect.element(page.getByText("Master Vitest")).toBeInTheDocument();

      // 3. Complete the todo
      const checkbox = page.getByRole("checkbox").first();
      await checkbox.click();
      await expect.element(checkbox).toBeChecked();

      // 4. Delete the todo
      await page.getByRole("button", { name: /delete/i }).click();
      await expect.element(page.getByText("Master Vitest")).not.toBeInTheDocument();
      await expect.element(page.getByText("No todos yet.")).toBeInTheDocument();
    });
  });

  describe("Reactivity", () => {
    it("should reactively update when todos change", async () => {
      renderApp();


      // Start with empty state
      await expect.element(page.getByText("No todos yet.")).toBeInTheDocument();

      // Add todo - should remove empty state
      await page.getByPlaceholder("Todo title").fill("New todo");
      await page.getByRole("button", { name: /add/i }).click();
      await expect.element(page.getByText("No todos yet.")).not.toBeInTheDocument();

      // Delete todo - should show empty state again
      await page.getByRole("button", { name: /delete/i }).click();
      await expect.element(page.getByText("No todos yet.")).toBeInTheDocument();
    });
  });
});
