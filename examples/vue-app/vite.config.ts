import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

export default defineConfig({
  plugins: [vue()],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp"
    }
  },
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"]
  },
  resolve: {
    alias: {
      "@alexop/sqlite-core": path.resolve(__dirname, "../../packages/core/src"),
      "@alexop/sqlite-vue": path.resolve(__dirname, "../../packages/vue/src")
    }
  }
});
