# SQLite Web

SQLite in the browser with SQLite WASM, OPFS and Vue 3.

## Packages

- `@alexop/sqlite-core` - Core SQLite client implementation using SQLite WASM
- `@alexop/sqlite-vue` - Vue 3 plugin and composables
- `examples/vue-app` - Example Vue application demonstrating usage

## Features

- SQLite database running entirely in the browser using WASM
- Persistent storage using OPFS (Origin Private File System)
- Type-safe TypeScript API
- Reactive queries for Vue 3
- Migration support
- Zero backend required

## Development

Install dependencies:

```bash
pnpm install
```

Build all packages:

```bash
pnpm build
```

Run the Vue example:

```bash
pnpm dev:vue
```

## Project Structure

```
├── packages/
│   ├── core/          # Core SQLite client
│   └── vue/           # Vue plugin and composables
├── examples/
│   └── vue-app/       # Example Vue application
└── pnpm-workspace.yaml
```

## Publishing

1. Build all packages:
   ```bash
   pnpm -r run build
   ```

2. Publish core package:
   ```bash
   cd packages/core
   npm publish --access public
   ```

3. Publish Vue package:
   ```bash
   cd packages/vue
   npm publish --access public
   ```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Test with the example app
5. Submit a pull request

## License

MIT
