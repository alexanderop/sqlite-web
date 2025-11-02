import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    // Browser tests for Vue composables
    browser: {
      enabled: true,
      provider: playwright({
        launch: {
          headless: true,
        },
      }),
      instances: [{ browser: "chromium" }],
    },
    include: ["src/**/*.{test,spec}.ts"],
    typecheck: {
      enabled: true,
      include: ["src/**/*.test-d.ts"],
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
