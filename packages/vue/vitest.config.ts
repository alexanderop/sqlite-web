import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
  plugins: [vue()],
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  test: {
    globals: true,
    // Browser tests for Vue composables
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
