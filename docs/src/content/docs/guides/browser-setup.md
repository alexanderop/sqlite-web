---
title: Browser Setup
description: Configure your build tool for SQLite WASM
---

SQLite WASM requires specific HTTP headers and build configuration to work properly in browsers. This guide covers setup for popular build tools.

## Requirements

SQLite WASM uses `SharedArrayBuffer`, which requires these HTTP headers for security:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

Without these headers, you'll see errors like:

```
ReferenceError: SharedArrayBuffer is not defined
```

## Vite

The recommended setup for Vite projects:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue"; // If using Vue

export default defineConfig({
  plugins: [vue()],

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

### Why exclude sqlite-wasm?

The `exclude` option prevents Vite from pre-bundling the SQLite WASM files, which can cause issues with worker initialization.

### Development Server

Start your dev server as usual:

```bash
npm run dev
```

The headers are automatically applied in development.

### Production Build

For production, you need to configure your hosting platform to send these headers.

## webpack

For webpack-based projects:

```javascript
// webpack.config.js
module.exports = {
  devServer: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },

  // Exclude sqlite-wasm from bundling
  externals: {
    "@sqlite.org/sqlite-wasm": "commonjs @sqlite.org/sqlite-wasm",
  },
};
```

## esbuild

For esbuild:

```javascript
// build.js
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/bundle.js",

  // Exclude sqlite-wasm
  external: ["@sqlite.org/sqlite-wasm"],
});
```

For dev server, use a plugin or middleware to add headers:

```javascript
import { serve } from "esbuild";

const { host, port } = await serve(
  {
    servedir: "dist",
    onRequest: ({ headers }) => {
      headers["Cross-Origin-Opener-Policy"] = "same-origin";
      headers["Cross-Origin-Embedder-Policy"] = "require-corp";
    },
  },
  {}
);
```

## Production Hosting

Configure your hosting platform to send the required headers.

### Vercel

Create `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    }
  ]
}
```

### Netlify

Create `netlify.toml`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
```

### Cloudflare Pages

Create `_headers` file in your public directory:

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

### GitHub Pages

GitHub Pages doesn't support custom headers. You'll need to:

1. Use a different hosting provider, or
2. Use a service worker to inject headers (complex)

We recommend Vercel, Netlify, or Cloudflare Pages instead.

### Nginx

Add to your nginx config:

```nginx
location / {
  add_header Cross-Origin-Opener-Policy same-origin;
  add_header Cross-Origin-Embedder-Policy require-corp;
}
```

### Apache

Add to `.htaccess`:

```apache
Header set Cross-Origin-Opener-Policy "same-origin"
Header set Cross-Origin-Embedder-Policy "require-corp"
```

## Troubleshooting

### SharedArrayBuffer is not defined

The headers aren't being sent. Check:

1. Your dev server configuration
2. Browser dev tools > Network tab > Response Headers
3. That you're accessing via `http://localhost`, not `file://`

### Worker initialization failed

The SQLite WASM files might be incorrectly bundled. Ensure:

1. `@sqlite.org/sqlite-wasm` is excluded from bundling
2. You're using a supported browser (Chrome 91+, Firefox 89+, Safari 15.2+)

### CORS errors

If loading resources from a CDN:

```
Cross-Origin-Embedder-Policy requires CORP headers
```

Ensure all external resources have `Cross-Origin-Resource-Policy: cross-origin` or are served from the same origin.

### Browser Support

SQLite WASM requires:

- Chrome/Edge 91+
- Firefox 89+
- Safari 15.2+

Check browser support at [caniuse.com/sharedarraybuffer](https://caniuse.com/sharedarraybuffer).

## Testing

Verify your setup by checking the headers:

```bash
curl -I http://localhost:5173

# Should show:
# Cross-Origin-Opener-Policy: same-origin
# Cross-Origin-Embedder-Policy: require-corp
```

Or in browser dev tools:

1. Open Network tab
2. Refresh the page
3. Click on the document request
4. Check Response Headers

## Next Steps

- [Installation](/getting-started/installation/) - Install SQLite Web
- [Quick Start](/getting-started/quick-start/) - Build your first app
- [Type Safety](/guides/type-safety/) - Configure TypeScript
