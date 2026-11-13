import { PGlite } from "@electric-sql/pglite";
import { InvalidGoogleCredential, type AuthProvider, type Identity } from "../src/auth.js";
import type { Database, Queryable } from "../src/db.js";
import { applyMigrations } from "../src/migrations.js";

export class TestDatabase implements Database {
  readonly pg = new PGlite();
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values: unknown[] = [],
  ) {
    return this.pg.query<T>(sql, values);
  }
  async transaction<T>(run: (db: Queryable) => Promise<T>): Promise<T> {
    return this.pg.transaction(async (tx) =>
      run({
        query: async <R extends Record<string, unknown> = Record<string, unknown>>(
          sql: string,
          values: unknown[] = [],
        ) => tx.query<R>(sql, values),
      }),
    );
  }
  async migrate() {
    return applyMigrations({
      exec: (sql) => this.pg.exec(sql),
      query: (sql, values) => this.pg.query(sql, values),
    });
  }
  async close() {
    await this.pg.close();
  }
}

export class TestAuth implements AuthProvider {
  readonly users = new Map<string, Identity>();
  async userFromToken(token: string) {
    return this.users.get(token) ?? null;
  }
  async requestEmailOtp(_email: string) {}
  async verifyEmailOtp(email: string, _token: string) {
    const user = [...this.users.entries()].find(([, identity]) => identity.email === email);
    if (!user) throw new Error("Unknown test user");
    return { accessToken: user[0], refreshToken: "test-refresh" };
  }
  async googleSignInUrl() {
    return {
      url: "https://accounts.google.com/test",
      verifier: "test-verifier",
      state: "test-state",
    };
  }
  async exchangeGoogleCode(code: string, verifier: string) {
    if (code !== "valid-code" || verifier !== "test-verifier")
      throw new Error("Invalid OAuth exchange");
    return { accessToken: "user-0", refreshToken: "test-refresh" };
  }
  async googleCredentialSignIn(credential: string) {
    if (credential !== "valid-credential".repeat(10))
      throw new InvalidGoogleCredential("Invalid Google credential");
    return { accessToken: "user-0", refreshToken: "test-refresh" };
  }
  async refreshSession(refreshToken: string) {
    if (refreshToken !== "test-refresh") throw new Error("Invalid refresh token");
    return { accessToken: "user-0", refreshToken: "test-refresh" };
  }
  async revokeSession(_token: string) {}
}
