# Changelog

All notable changes to `@alexop/sqlite-core` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-11-02

### Added

- Initial release
- Type-safe SQLite client for the browser using WASM and OPFS
- Zod schema validation for table definitions
- Query builder API inspired by Nuxt Content's queryCollection
- Support for `query()`, `insert()`, `update()`, `delete()` operations
- Migration system with version-based sorting
- Pub/Sub system for table change notifications
- Raw SQL execution via `exec()` and `raw()` methods
- Full TypeScript type inference for table names, columns, and values
- `select()` method with type narrowing for field projection
- `where()`, `orderBy()`, `limit()`, `skip()` query builder methods
- Worker-based SQLite implementation using sqlite3Worker1Promiser
