# Changelog

All notable changes to `@alexop/sqlite-vue` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-11-02

### Added
- Initial release
- Vue 3 plugin for SQLite integration via `createSQLite()`
- `useSQLiteClientAsync()` composable for accessing the SQLite client
- `useSQLiteQuery()` composable for reactive query execution
- Automatic re-execution of queries when subscribed tables change
- Type-safe integration with `@alexop/sqlite-core`
- Dependency injection pattern for providing SQLite client to components
- Full TypeScript support with type inference from schemas
