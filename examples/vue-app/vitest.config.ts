import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  }, plugins: [vue()], resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  }, server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp", "Cross-Origin-Opener-Policy": "same-origin",
    },
  }, test: {
    globals: true,
    // Browser tests for Vue components with SQLite
    browser: {
      enabled: true,
      provider: playwright({
        launch: {
          headless: true,
        },
      }),
      instances: [{ browser: "chromium" }],
      // Take screenshots on test failure for debugging
      screenshotFailures: true,
      // Configure viewport for consistent testing
      viewport: {
        height: 720, width: 1280,
      },
      // Enable trace on failure for debugging
      trace: "retain-on-failure",
      // Custom test ID attribute for better semantics
      locators: {
        testIdAttribute: "data-testid",
      },
    },
    include: ["src/**/*.{test,spec}.ts"],
  },
});
