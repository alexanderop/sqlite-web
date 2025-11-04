import type { InjectionKey } from "vue";
import type { SQLiteClient, SchemaRegistry } from "@alexop/sqlite-orm";

/**
 * Vue injection key for the SQLite client promise
 *
 * This key is used internally by the plugin to provide/inject the SQLite client
 * through Vue's dependency injection system. It's exported for advanced use cases
 * where you need direct access to the injection key.
 *
 * **Note**: Most users should use `useSQLiteClientAsync()` instead of injecting
 * this key directly.
 *
 * @example
 * ```typescript
 * // Advanced usage: Direct injection
 * import { inject } from 'vue';
 * import { SQLITE_CLIENT_KEY } from '@alexop/sqlite-vue';
 *
 * const dbPromise = inject(SQLITE_CLIENT_KEY);
 * ```
 */
export const SQLITE_CLIENT_KEY: InjectionKey<Promise<SQLiteClient<SchemaRegistry>>> =
  Symbol("SQLITE_CLIENT");
