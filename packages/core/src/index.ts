import { sqlite3Worker1Promiser } from "@sqlite.org/sqlite-wasm";

export type Migration = {
  version: number;
  sql: string;
};

export type SQLiteClient = {
  exec: (sql: string, params?: unknown[]) => Promise<any>;
  query: <T = any>(sql: string, params?: unknown[]) => Promise<T[]>;
  notifyTable: (table: string) => void;
  subscribe: (table: string, cb: () => void) => () => void;
};

type Options = {
  filename: string;
  migrations?: Migration[];
};

export async function createSQLiteClient(opts: Options): Promise<SQLiteClient> {
  let promiser: ReturnType<typeof sqlite3Worker1Promiser> | null = null;
  let dbId: string | null = null;

  const emitter = new Map<string, Set<() => void>>();

  function emit(table: string) {
    const set = emitter.get(table);
    if (!set) return;
    for (const cb of set) cb();
  }

  function subscribe(table: string, cb: () => void) {
    if (!emitter.has(table)) emitter.set(table, new Set());
    emitter.get(table)!.add(cb);
    return () => {
      emitter.get(table)!.delete(cb);
    };
  }

  async function init() {
    if (promiser && dbId) return;

    promiser = await new Promise(resolve => {
      const p = sqlite3Worker1Promiser({
        onready: () => resolve(p)
      });
    });

    if (!promiser) {
      throw new Error("Failed to initialize SQLite worker");
    }

    const openResponse = await promiser("open", {
      filename: opts.filename
    });

    if (openResponse.type === "error") {
      throw new Error(openResponse.result?.message || "Failed to open database");
    }

    if (!openResponse.result?.dbId) {
      throw new Error("No database ID returned");
    }

    dbId = openResponse.result.dbId as string;

    if (opts.migrations?.length) {
      const ordered = opts.migrations.sort((a, b) => a.version - b.version);
      for (const mig of ordered) {
        await promiser("exec", {
          dbId,
          sql: mig.sql
        });
      }
    }
  }

  async function exec(sql: string, params: unknown[] = []) {
    if (!promiser || !dbId) {
      await init();
    }

    if (!promiser || !dbId) {
      throw new Error("Database not initialized");
    }

    const result = await promiser("exec", {
      dbId,
      sql,
      bind: params,
      returnValue: "resultRows"
    });

    if (result.type === "error") {
      throw new Error(result.result?.message || "Query failed");
    }

    return result;
  }

  async function query<T = any>(sql: string, params: unknown[] = []) {
    const res = await exec(sql, params);
    const rows = res.result?.resultRows ?? [];
    return rows as T[];
  }

  return {
    exec,
    query,
    notifyTable: emit,
    subscribe
  };
}
