import type { Database, Queryable } from "./db.js";
import { applyMigrations } from "./migrations.js";

type PGliteLike = {
  query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[]; affectedRows?: number }>;
  exec(sql: string): Promise<unknown>;
  transaction<T>(run: (tx: { query<R>(sql: string, values?: unknown[]): Promise<{ rows: R[] }> }) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

/** `pglite:<dir>` (on disk) or `pglite:memory` selects the in-process database used when Docker is unavailable. */
export const isPgliteUrl = (url: string) => url.startsWith("pglite:");

/**
 * LOCAL DEMO ONLY: in-process Postgres (PGlite, a dev dependency) so `npm run demo` works without
 * Docker. It is loaded lazily, so deployments without dev dependencies never import it, and it
 * applies the migrations itself because no other process can open the same data directory.
 */
export class PgliteDatabase implements Database {
  private readonly ready: Promise<PGliteLike>;

  constructor(url: string, migrationsDir?: string) {
    const dir = url.slice("pglite:".length);
    this.ready = (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const pg = (dir && dir !== "memory" ? new PGlite(dir) : new PGlite()) as unknown as PGliteLike;
      await applyMigrations({ exec: sql => pg.exec(sql), query: (sql, values) => pg.query(sql, values) },
        migrationsDir);
      return pg;
    })();
  }

  /** Resolves once the database is open and migrated (throws if that failed). */
  async open(): Promise<void> { await this.ready; }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values: unknown[] = []) {
    const result = await (await this.ready).query<T>(sql, values);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  }

  async transaction<T>(run: (db: Queryable) => Promise<T>): Promise<T> {
    return (await this.ready).transaction(async tx => run({
      query: async <R extends Record<string, unknown> = Record<string, unknown>>(sql: string, values: unknown[] = []) =>
        tx.query<R>(sql, values),
    }));
  }

  async close(): Promise<void> { await (await this.ready).close(); }
}
