import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  test: {
    globals: true,
    // Browser tests for OPFS/WASM functionality
    browser: {
      enabled: true,
      instances: [{ browser: "chromium" }],
      provider: playwright({
        launch: {
          headless: true,
        },
      }),
    },
    include: ["src/**/*.{test,spec}.ts"],
    typecheck: {
      enabled: true,
      include: ["src/**/*.test-d.ts"],
    },
  },
});
