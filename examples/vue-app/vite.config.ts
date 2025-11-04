import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

export default defineConfig({
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
  plugins: [vue()],
  resolve: {
    alias: {
      "@alexop/sqlite-core": path.resolve(__dirname, "../../packages/core/src"),
      "@alexop/sqlite-vue": path.resolve(__dirname, "../../packages/vue/src"),
    },
  },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
});
