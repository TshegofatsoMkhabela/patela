import pg from "pg";

export interface Queryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}

export interface Database extends Queryable {
  transaction<T>(run: (db: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export class PgDatabase implements Database {
  private readonly pool: pg.Pool;

  constructor(connectionString: string, max = 2, verifyTls = false) {
    this.pool = new pg.Pool({
      connectionString,
      max,
      ssl: verifyTls ? { rejectUnauthorized: true } : undefined,
    });
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values: unknown[] = [],
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(sql, values);
  }

  async transaction<T>(run: (db: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const value = await run(client);
      await client.query("commit");
      return value;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
