import { PgDatabase } from "./db.js";
import { applyMigrations } from "./migrations.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const db = new PgDatabase(connectionString);
try {
  const files = await applyMigrations({ exec: sql => db.query(sql), query: (sql, values) => db.query(sql, values) });
  process.stdout.write(files.length ? `Patela migrations applied: ${files.join(", ")}\n`
    : "Patela migrations already up to date\n");
} finally {
  await db.close();
}
