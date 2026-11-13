import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { GoogleOidcProvider, PostgresAuth, type GoogleIdentityProvider } from "../src/auth.js";
import { DomainError } from "../src/validation.js";
import { TestDatabase } from "./helpers.js";

// A wrong or reused code is the user's mistake, so it must surface as a 401, not a 500.
const rejectedCode = (error: unknown) => error instanceof DomainError && error.status === 401;

test("Google authorization URL carries state and a matching PKCE challenge", async () => {
  const db = new TestDatabase();
  try {
    const provider = new GoogleOidcProvider("example-client-id", "example-secret");
    const auth = new PostgresAuth(db, provider);
    const callback = "http://localhost:4000/auth/google/callback";
    const started = await auth.googleSignInUrl(callback);
    const url = new URL(started.url);
    assert.equal(url.hostname, "accounts.google.com");
    assert.equal(url.searchParams.get("client_id"), "example-client-id");
    assert.equal(url.searchParams.get("redirect_uri"), callback);
    assert.equal(url.searchParams.get("state"), started.state);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(
      url.searchParams.get("code_challenge"),
      createHash("sha256").update(started.verifier).digest("base64url"),
    );
  } finally {
    await db.close();
  }
});

test("Google ID-token verification rejects an unsigned credential", async () => {
  const provider = new GoogleOidcProvider("example-client-id");
  await assert.rejects(provider.verifyCredential("not-a-signed-google-id-token"));
});

test("Google identity creates a PostgreSQL session, rotates it, and revokes it", async () => {
  const db = new TestDatabase();
  const provider: GoogleIdentityProvider = {
    authorizationUrl: () => "https://accounts.google.com/test",
    exchange: async (_code, verifier, redirectTo) => {
      assert.equal(verifier, "test-verifier");
      assert.equal(redirectTo, "http://localhost:4000/auth/google/callback");
      return { subject: "stable-google-subject", email: "buyer@example.test", emailVerified: true };
    },
    verifyCredential: async (credential) => {
      assert.equal(credential, "signed-google-id-token");
      return { subject: "stable-google-subject", email: "buyer@example.test", emailVerified: true };
    },
  };
  try {
    await db.migrate();
    const auth = new PostgresAuth(db, provider);
    const first = await auth.exchangeGoogleCode(
      "test-code",
      "test-verifier",
      "http://localhost:4000/auth/google/callback",
    );
    const identity = await auth.userFromToken(first.accessToken);
    assert.equal(identity?.email, "buyer@example.test");
    const second = await auth.refreshSession(first.refreshToken);
    assert.equal(await auth.userFromToken(first.accessToken), null);
    assert.equal((await auth.userFromToken(second.accessToken))?.id, identity?.id);
    await assert.rejects(auth.refreshSession(first.refreshToken));
    await auth.revokeSession(second.accessToken, second.refreshToken);
    assert.equal(await auth.userFromToken(second.accessToken), null);
    await assert.rejects(auth.refreshSession(second.refreshToken));
    const again = await auth.exchangeGoogleCode(
      "test-code",
      "test-verifier",
      "http://localhost:4000/auth/google/callback",
    );
    assert.equal((await auth.userFromToken(again.accessToken))?.id, identity?.id);
    const fromCredential = await auth.googleCredentialSignIn("signed-google-id-token");
    assert.equal((await auth.userFromToken(fromCredential.accessToken))?.id, identity?.id);
    const sessions = await db.query<{ access_hash: string }>(
      "select access_hash from auth_sessions",
    );
    assert.ok(
      sessions.rows.every(
        (row) => row.access_hash !== first.accessToken && row.access_hash !== second.accessToken,
      ),
    );
  } finally {
    await db.close();
  }
});

test("email OTP is one-time and wrong guesses consume attempts", async () => {
  const db = new TestDatabase();
  const provider: GoogleIdentityProvider = {
    authorizationUrl: () => "",
    exchange: async () => {
      throw new Error("Unused");
    },
    verifyCredential: async () => {
      throw new Error("Unused");
    },
  };
  try {
    await db.migrate();
    const auth = new PostgresAuth(db, provider);
    await auth.requestEmailOtp("BUYER@example.test");
    const outbox = await db.query<{ payload: { code: string } }>(
      "select payload from email_outbox where template='login_otp'",
    );
    const code = outbox.rows[0].payload.code;
    await assert.rejects(auth.verifyEmailOtp("buyer@example.test", "000000"), rejectedCode);
    const attempts = await db.query<{ attempts: number }>(
      "select attempts from email_otp_challenges",
    );
    assert.equal(attempts.rows[0].attempts, 1);
    const session = await auth.verifyEmailOtp("buyer@example.test", code);
    assert.equal((await auth.userFromToken(session.accessToken))?.email, "buyer@example.test");
    await assert.rejects(auth.verifyEmailOtp("buyer@example.test", code), rejectedCode);
  } finally {
    await db.close();
  }
});

test("unverified Google email cannot create a Patela session", async () => {
  const db = new TestDatabase();
  const provider: GoogleIdentityProvider = {
    authorizationUrl: () => "",
    exchange: async () => ({
      subject: "unverified",
      email: "unverified@example.test",
      emailVerified: false,
    }),
    verifyCredential: async () => ({
      subject: "unverified",
      email: "unverified@example.test",
      emailVerified: false,
    }),
  };
  try {
    await db.migrate();
    const auth = new PostgresAuth(db, provider);
    await assert.rejects(
      auth.exchangeGoogleCode("code", "verifier", "http://localhost:4000/auth/google/callback"),
    );
    await assert.rejects(auth.googleCredentialSignIn("unverified-token"));
    const sessions = await db.query("select id from auth_sessions");
    assert.equal(sessions.rows.length, 0);
  } finally {
    await db.close();
  }
});
