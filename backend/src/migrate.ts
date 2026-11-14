import { PgDatabase } from "./db.js";
import { applyMigrations } from "./migrations.js";
import { PgliteDatabase, isPgliteUrl } from "./pglite-db.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
if (isPgliteUrl(connectionString)) {
  // PGlite migrates when it opens (see pglite-db.ts).
  const db = new PgliteDatabase(connectionString);
  try {
    await db.open();
    process.stdout.write("Patela migrations applied to the local PGlite database\n");
  } finally {
    await db.close();
  }
} else {
  const db = new PgDatabase(connectionString, 2, process.env.DATABASE_SSL === "true");
  try {
    const files = await applyMigrations({ exec: sql => db.query(sql), query: (sql, values) => db.query(sql, values) });
    process.stdout.write(files.length ? `Patela migrations applied: ${files.join(", ")}\n`
      : "Patela migrations already up to date\n");
  } finally {
    await db.close();
  }
}
