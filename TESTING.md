---
title: Browser Testing with Vitest
description: Complete guide to browser-based integration testing for SQLite Web
---

import { Card, CardGrid, Badge, Aside, Tabs, TabItem, Steps, FileTree, Code } from '@astrojs/starlight/components';

# Vitest Browser Mode Testing

<Aside type="tip" title="All Tests Passing! ✅">
  Complete test suite with **16 passing tests** covering full CRUD operations, reactivity, and browser APIs.
</Aside>

This guide describes the Vitest browser mode testing infrastructure for the SQLite Web library. Tests run in a real browser environment to validate WASM, OPFS, and Vue component integration.

## Overview

The testing setup uses **Vitest Browser Mode** with **Playwright** to run real browser-based integration tests. This is essential for testing SQLite WASM + OPFS functionality which requires actual browser APIs.

<CardGrid>
  <Card title="Real Browser Testing" icon="rocket">
    Tests run in actual Chromium browser, not jsdom simulation
  </Card>
  <Card title="OPFS Support" icon="seti:database">
    Full SQLite persistence testing with Origin Private File System
  </Card>
  <Card title="Vue Components" icon="seti:vue">
    Render and interact with actual Vue 3 components
  </Card>
  <Card title="Type-Safe" icon="seti:typescript">
    Full TypeScript support with Playwright locators
  </Card>
</CardGrid>

## Test Environment

<table>
  <thead>
    <tr>
      <th>Feature</th>
      <th>Configuration</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Browser</td>
      <td>Chromium (via Playwright)</td>
    </tr>
    <tr>
      <td>Mode</td>
      <td>Headless</td>
    </tr>
    <tr>
      <td>Viewport</td>
      <td>1280x720</td>
    </tr>
    <tr>
      <td>Isolation</td>
      <td>Each test runs in separate iframe</td>
    </tr>
  </tbody>
</table>

## File Structure

<FileTree>
- examples/
  - vue-app/
    - vitest.config.ts Test configuration
    - src/
      - App.test.ts Component integration tests
      - **screenshots**/ Generated screenshots (on failure)
    - **traces**/ Playwright traces (on failure)
</FileTree>

## Configuration

<Tabs>
  <TabItem label="Vitest Config">
    ```typescript title="examples/vue-app/vitest.config.ts"
    import { playwright } from "@vitest/browser-playwright";

    export default defineConfig({
      test: {
        browser: {
          enabled: true,
          provider: playwright({ launch: { headless: true } }),
          instances: [{ browser: "chromium" }],
          screenshotFailures: true,        // Debug screenshots
          viewport: { width: 1280, height: 720 },
          trace: "retain-on-failure",      // Playwright traces
          locators: {
            testIdAttribute: "data-testid",
          },
        },
      },
      server: {
        headers: {
          "Cross-Origin-Opener-Policy": "same-origin",
          "Cross-Origin-Embedder-Policy": "require-corp",
        },
      },
      optimizeDeps: {
        exclude: ["@sqlite.org/sqlite-wasm"],
      },
    });
    ```
  </TabItem>
  <TabItem label="Package Scripts">
    ```json title="package.json"
    {
      "scripts": {
        "test": "vitest",
        "test:run": "vitest run",
        "test:ui": "vitest --ui",
        "test:vue-app": "pnpm --filter vue-app test"
      }
    }
    ```
  </TabItem>
</Tabs>

<Aside type="caution" title="Required CORS Headers">
  SQLite WASM requires specific headers for SharedArrayBuffer support:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`

  These are already configured in the Vite server settings above.
</Aside>

## Test Suite

<Badge text="16 tests" variant="success" /> <Badge text="100% passing" variant="tip" />

### Test Coverage

<CardGrid stagger>
  <Card title="Initial Render" icon="approve-check">
    - Display app title
    - Display empty state when no todos
    - Render input field and add button

    <Badge text="3 tests" size="small" />
  </Card>

  <Card title="Adding Todos" icon="add-document">
    - Add a new todo
    - Clear input after adding todo
    - Not add empty todos
    - Add multiple todos

    <Badge text="4 tests" size="small" />
  </Card>

  <Card title="Completing Todos" icon="approve-check-circle">
    - Toggle todo completion
    - Apply strikethrough style to completed todos

    <Badge text="2 tests" size="small" />
  </Card>

  <Card title="Editing Todos" icon="pencil">
    - Enter edit mode when clicking edit button
    - Update todo title when saving
    - Cancel editing without saving changes

    <Badge text="3 tests" size="small" />
  </Card>

  <Card title="Deleting Todos" icon="error">
    - Delete a todo when clicking delete button
    - Delete the correct todo when multiple exist

    <Badge text="2 tests" size="small" />
  </Card>

  <Card title="Full CRUD Flow" icon="rocket">
    - Complete full todo lifecycle (add → edit → complete → delete)

    <Badge text="1 test" size="small" />
  </Card>

  <Card title="Reactivity" icon="random">
    - Reactively update when todos change

    <Badge text="1 test" size="small" />
  </Card>
</CardGrid>

## Test Patterns

### Setting Up Tests

<Steps>

1. **Import dependencies**

   ```typescript title="src/App.test.ts"
   import { describe, it, expect } from "vitest";
   import { render } from "vitest-browser-vue";
   import { page } from "vitest/browser";
   import { createSQLite } from "@alexop/sqlite-vue";
   ```

2. **Create render helper with SQLite plugin**

   ```typescript
   function renderApp() {
     const sqlitePlugin = createSQLite({
       schema: dbSchema,
       filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`,
       migrations: [/* ... */],
     });

     return render(App, {
       global: {
         plugins: [sqlitePlugin],
       },
     });
   }
   ```

   <Aside type="note">
     Each test gets a unique database using `crypto.randomUUID()` for complete isolation.
   </Aside>

3. **Write your test**

   ```typescript
   it("should add a new todo", async () => {
     renderApp();

     const input = page.getByPlaceholder("Todo title");
     await input.fill("Buy groceries");
     await page.getByRole("button", { name: /add/i }).click();

     await expect.element(page.getByText("Buy groceries")).toBeInTheDocument();
   });
   ```

</Steps>

### Using Locators

<Tabs>
  <TabItem label="Query by Role">
    ```typescript
    // Semantic queries (recommended)
    await page.getByRole("button", { name: /add/i }).click();
    await page.getByRole("textbox").fill("Hello");
    const checkbox = page.getByRole("checkbox").first();
    ```
  </TabItem>

  <TabItem label="Query by Text">
    ```typescript
    // Find by visible text
    await expect.element(page.getByText("New todo")).toBeInTheDocument();
    await page.getByText("Edit").click();
    ```
  </TabItem>

  <TabItem label="Query by Placeholder">
    ```typescript
    // Find inputs by placeholder
    const input = page.getByPlaceholder("Todo title");
    await input.fill("New todo");
    ```
  </TabItem>

  <TabItem label="Nth Element">
    ```typescript
    // Get specific item from multiple matches
    const editInput = page.getByRole("textbox").nth(1);
    const firstButton = page.getByRole("button").first();
    const lastItem = page.getByRole("listitem").last();
    ```
  </TabItem>
</Tabs>

### Assertions

<Tabs>
  <TabItem label="Presence">
    ```typescript
    // Check if element exists in DOM
    await expect.element(page.getByText("Hello")).toBeInTheDocument();
    await expect.element(page.getByText("Deleted")).not.toBeInTheDocument();
    ```
  </TabItem>

  <TabItem label="State">
    ```typescript
    // Check element state
    await expect.element(checkbox).toBeChecked();
    await expect.element(checkbox).not.toBeChecked();
    await expect.element(button).toBeDisabled();
    ```
  </TabItem>

  <TabItem label="Attributes">
    ```typescript
    // Check CSS classes and values
    await expect.element(text).toHaveClass(/line-through/);
    await expect.element(input).toHaveValue("");
    await expect.element(input).toHaveValue("Hello");
    ```
  </TabItem>
</Tabs>

## Running Tests

<Tabs>
  <TabItem label="From Root" icon="seti:folder">
    ```bash
    # Run all tests once
    pnpm test:run

    # Run in watch mode (development)
    pnpm test

    # Run with interactive UI
    pnpm test:ui

    # Run only Vue app tests
    pnpm test:vue-app
    ```
  </TabItem>

  <TabItem label="From Vue App" icon="seti:vue">
    ```bash
    cd examples/vue-app

    # Run tests once (CI mode)
    pnpm test:run

    # Watch mode for development
    pnpm test

    # Interactive UI with browser view
    pnpm test:ui
    ```
  </TabItem>

  <TabItem label="With Options" icon="setting">
    ```bash
    # Run specific test file
    pnpm test src/App.test.ts

    # Run with coverage
    pnpm test:run --coverage

    # Run in headed mode (visible browser)
    pnpm test --browser.headless=false

    # Run with specific reporter
    pnpm test:run --reporter=verbose
    ```
  </TabItem>
</Tabs>

<Aside type="tip" title="Test UI">
  Use `pnpm test:ui` during development for the best experience. The UI shows:
  - Real-time test results
  - Interactive browser view
  - Console logs and errors
  - Time travel debugging
</Aside>

## Dependencies

<CardGrid>
  <Card title="vitest" icon="seti:vitest">
    Test runner and framework

    `^4.0.6`
  </Card>
  <Card title="@vitest/browser" icon="laptop">
    Browser mode support

    `^4.0.6`
  </Card>
  <Card title="@vitest/browser-playwright" icon="seti:playwright">
    Playwright provider

    `^4.0.6`
  </Card>
  <Card title="@vitest/ui" icon="laptop">
    Interactive test UI

    `^4.0.6`
  </Card>
  <Card title="playwright" icon="seti:playwright">
    Browser automation

    `^1.56.1`
  </Card>
  <Card title="vitest-browser-vue" icon="seti:vue">
    Vue component rendering

    `^2.0.1`
  </Card>
</CardGrid>

## Key Implementation Details

<Steps>

1. **Test Isolation** <Badge text="Important" variant="caution" />

   Each test creates a fresh SQLite database with a unique filename using `crypto.randomUUID()`, ensuring complete isolation between tests.

   ```typescript
   filename: `file:test-${crypto.randomUUID()}.sqlite3?vfs=opfs`
   ```

2. **Plugin Installation**

   The SQLite plugin must be installed for each rendered component using Vue's `global.plugins` option.

   ```typescript
   render(App, {
     global: {
       plugins: [sqlitePlugin],
     },
   });
   ```

3. **Async Operations**

   All browser interactions are async. Always use `await` for:
   - Element interactions (`.click()`, `.fill()`)
   - Assertions (`expect.element()`)

4. **Element Selection**

   Best practices for finding elements:
   - ✅ Use semantic queries (`getByRole`, `getByPlaceholder`, `getByText`)
   - ✅ Use `.nth(index)` for multiple matches
   - ❌ Avoid using `.elements()` - use `.nth()` instead

5. **Reactive Updates**

   Tests verify that `db.notifyTable()` triggers reactive re-renders in Vue components.

</Steps>

## Debugging

<Aside type="note" title="Automatic Debug Artifacts">
  Tests automatically generate screenshots and traces on failure. No additional configuration needed!
</Aside>

### When Tests Fail

<Steps>

1. **Check Screenshots**

   Screenshots are saved in `__screenshots__/` directory.

   ```bash
   ls examples/vue-app/__screenshots__/
   # App.test.ts/
   #   should-add-a-new-todo-1-chromium-darwin.png
   ```

2. **View Playwright Traces**

   Traces are saved in `__traces__/` directory. Open them with Playwright Trace Viewer:

   ```bash
   npx playwright show-trace __traces__/path-to-trace.zip
   ```

   The trace viewer shows:
   - Timeline of all actions
   - DOM snapshots at each step
   - Network requests
   - Console logs

3. **Check Console Output**

   Look for SQLite errors or JavaScript exceptions in the test output.

4. **Run in Headed Mode**

   See the browser in action:

   ```bash
   pnpm test --browser.headless=false
   ```

</Steps>

<Aside type="tip" title="Debugging Tips">
  - Use `console.log()` in your tests - it appears in the test output
  - Add `.only` to run a single test: `it.only("test name", ...)`
  - Use `--reporter=verbose` for detailed output
  - Check browser console for client-side errors
</Aside>

## Best Practices

<CardGrid>
  <Card title="🔒 Test Isolation" icon="approve-check">
    Use `crypto.randomUUID()` for unique database names. Never share state between tests.
  </Card>

  <Card title="⏳ Async Operations" icon="random">
    Always `await` browser interactions and assertions. Vitest automatically waits for elements.
  </Card>

  <Card title="🎯 Semantic Queries" icon="magnifier">
    Prefer role-based queries (`getByRole`) over test IDs. Tests should reflect user behavior.
  </Card>

  <Card title="🌐 Real Browser APIs" icon="laptop">
    Tests use actual browser APIs (WASM, OPFS, DOM). No mocking required!
  </Card>

  <Card title="⚡ Verify Reactivity" icon="rocket">
    Always test that UI updates when data changes via `notifyTable()`.
  </Card>

  <Card title="📸 Visual Debugging" icon="document">
    Let tests fail once to capture screenshots/traces for debugging.
  </Card>
</CardGrid>

## Future Enhancements

<CardGrid>
  <Card title="Visual Regression Testing" icon="document">
    Add `toMatchScreenshot()` assertions to catch visual regressions in UI components.

    <Badge text="Coming Soon" variant="note" />
  </Card>

  <Card title="Multi-Browser Testing" icon="laptop">
    Run tests on Firefox and WebKit in addition to Chromium for better compatibility.

    ```typescript
    instances: [
      { browser: "chromium" },
      { browser: "firefox" },
      { browser: "webkit" },
    ]
    ```
  </Card>

  <Card title="Performance Benchmarks" icon="rocket">
    Add benchmarks to track SQLite query performance and OPFS operations over time.
  </Card>

  <Card title="Offline Scenarios" icon="warning">
    Test OPFS persistence across page reloads and offline/online transitions.
  </Card>

  <Card title="E2E Testing" icon="random">
    Add tests that span multiple components and complex user workflows.
  </Card>

  <Card title="CI/CD Integration" icon="github">
    Add GitHub Actions workflow to run tests on every PR.

    ```yaml
    - name: Run Tests
      run: pnpm test:run
    ```
  </Card>
</CardGrid>

## Resources

<CardGrid>
  <Card title="Vitest Browser Mode" icon="external">
    Official documentation for browser testing with Vitest.

    [View Docs →](https://vitest.dev/guide/browser/)
  </Card>

  <Card title="Playwright Locators" icon="external">
    Learn about Playwright's powerful element selection API.

    [View Docs →](https://playwright.dev/docs/locators)
  </Card>

  <Card title="Testing Library" icon="external">
    Query methods that encourage good testing practices.

    [View Docs →](https://testing-library.com/docs/queries/about)
  </Card>

  <Card title="Vue Test Utils" icon="external">
    Official testing utilities for Vue 3 components.

    [View Docs →](https://test-utils.vuejs.org/)
  </Card>
</CardGrid>

---

<Aside type="success" title="Happy Testing! 🎉">
  You now have a complete browser testing setup with Vitest. All 16 tests are passing, and you can confidently ship your SQLite Web library knowing it works in real browsers!
</Aside>
