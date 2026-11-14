import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface MigrationTarget {
  /** Runs a multi-statement SQL script. */
  exec(sql: string): Promise<unknown>;
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const FILE_NAME = /^[\w.-]+\.sql$/;

/**
 * Applies each migrations/*.sql file once, in name order, recording it in
 * schema_migrations. Each file runs in its own transaction with its record.
 * Returns the files applied by this call.
 */
export async function applyMigrations(db: MigrationTarget, dir = resolve("migrations")) {
  await db.exec(`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await db.query("select name from schema_migrations")).rows.map(r => String(r.name)));
  const pending = (await readdir(dir)).filter(name => FILE_NAME.test(name) && !done.has(name)).sort();
  for (const file of pending) {
    const sql = await readFile(resolve(dir, file), "utf8");
    await db.exec(`begin;\n${sql}\n;insert into schema_migrations (name) values ('${file}');\ncommit;`);
  }
  return pending;
}
