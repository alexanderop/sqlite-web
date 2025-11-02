import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "path";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
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
        width: 1280,
        height: 720,
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
