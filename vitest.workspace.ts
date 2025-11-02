import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      // Type checking tests
      include: ["packages/*/src/**/*.test-d.ts"],
      name: "typecheck",
      typecheck: {
        enabled: true,
      },
    },
  },
  {
    extends: "./packages/core/vitest.config.ts",
    test: {
      include: ["packages/core/src/**/*.{test,spec}.ts"],
      exclude: ["packages/core/src/**/*.test-d.ts"],
      name: "core-browser",
    },
  },
  {
    extends: "./packages/vue/vitest.config.ts",
    test: {
      include: ["packages/vue/src/**/*.{test,spec}.ts"],
      exclude: ["packages/vue/src/**/*.test-d.ts"],
      name: "vue-browser",
    },
  },
]);
