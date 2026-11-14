import { PgDatabase } from "./db.js";
import { applyMigrations } from "./migrations.js";

/** Invoke manually after deploying new code, before directing traffic to it. */
export async function handler() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = new PgDatabase(process.env.DATABASE_URL, 1, process.env.DATABASE_SSL === "true");
  try {
    const applied = await applyMigrations({
      exec: sql => db.query(sql), query: (sql, values) => db.query(sql, values),
    });
    return { applied };
  } finally { await db.close(); }
}
