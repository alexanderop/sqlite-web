---
title: Installation
description: Install SQLite Web packages in your project
---

SQLite Web is distributed as two npm packages that work together to provide a complete solution for browser-based SQLite databases.

## Packages

- **`@alexop/sqlite-core`** - Core SQLite client (framework-agnostic)
- **`@alexop/sqlite-vue`** - Vue 3 integration (optional, includes core as dependency)

## Installation

### Core Package Only

If you're using vanilla JavaScript/TypeScript or a framework other than Vue:

```bash
# npm
npm install @alexop/sqlite-core zod

# pnpm
pnpm add @alexop/sqlite-core zod

# yarn
yarn add @alexop/sqlite-core zod
```

### Vue Package

If you're using Vue 3, install the Vue package which includes the core:

```bash
# npm
npm install @alexop/sqlite-vue zod

# pnpm
pnpm add @alexop/sqlite-vue zod

# yarn
yarn add @alexop/sqlite-vue zod
```

:::note
Zod is required for schema validation and type inference. Make sure to install it alongside the SQLite packages.
:::

## Browser Configuration

SQLite WASM requires specific HTTP headers to enable `SharedArrayBuffer` support. Configure your development server:

### Vite

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
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

### Other Build Tools

For other build tools (webpack, esbuild, etc.), you'll need to configure similar headers. See the [Browser Setup](/guides/browser-setup/) guide for detailed instructions.

## TypeScript Configuration

SQLite Web is written in TypeScript and includes full type definitions. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"]
  }
}
```

## Next Steps

- [Quick Start Guide](/getting-started/quick-start/) - Build your first type-safe database
- [Schema Definition](/core/schema/) - Learn how to define your database schema
- [Vue Plugin Setup](/vue/plugin/) - Set up Vue integration (if using Vue)
