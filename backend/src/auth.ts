import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import type { Database, Queryable } from "./db.js";
import { queueEmail } from "./email.js";
import { sha256Hex } from "./validation.js";

export interface Identity { id: string; email: string }
export interface Session { accessToken: string; refreshToken: string }
export class InvalidGoogleCredential extends Error {}
export interface AuthProvider {
  userFromToken(token: string): Promise<Identity | null>;
  requestEmailOtp(email: string): Promise<void>;
  verifyEmailOtp(email: string, code: string): Promise<Session>;
  googleSignInUrl(redirectTo: string): Promise<{ url: string; verifier: string; state: string }>;
  exchangeGoogleCode(code: string, verifier: string, redirectTo: string): Promise<Session>;
  googleCredentialSignIn(credential: string): Promise<Session>;
  refreshSession(refreshToken: string): Promise<Session>;
  revokeSession(token: string, refreshToken?: string): Promise<void>;
}

export interface GoogleIdentityProvider {
  authorizationUrl(redirectTo: string, state: string, challenge: string): string;
  exchange(code: string, verifier: string, redirectTo: string): Promise<{
    subject: string; email: string; emailVerified: boolean;
  }>;
  verifyCredential(credential: string): Promise<{
    subject: string; email: string; emailVerified: boolean;
  }>;
}

export class GoogleOidcProvider implements GoogleIdentityProvider {
  private readonly client: OAuth2Client;
  constructor(private readonly clientId: string, private readonly clientSecret?: string) {
    this.client = new OAuth2Client(clientId, clientSecret);
  }
  authorizationUrl(redirectTo: string, state: string, challenge: string): string {
    return this.client.generateAuthUrl({
      redirect_uri: redirectTo, response_type: "code", scope: ["openid", "email", "profile"],
      state, access_type: "online", code_challenge: challenge, code_challenge_method: CodeChallengeMethod.S256,
    });
  }
  async exchange(code: string, verifier: string, redirectTo: string) {
    if (!this.clientSecret) throw new Error("Google OAuth code flow is not configured");
    const { tokens } = await this.client.getToken({
      code, codeVerifier: verifier, redirect_uri: redirectTo,
    });
    if (!tokens.id_token) throw new Error("Google returned no ID token");
    return this.verifyCredential(tokens.id_token);
  }
  async verifyCredential(credential: string) {
    const ticket = await this.client.verifyIdToken({ idToken: credential, audience: this.clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) throw new Error("Google identity is incomplete");
    return { subject: payload.sub, email: payload.email,
      emailVerified: payload.email_verified === true };
  }
}

const hash = sha256Hex;
function token(): string { return randomBytes(32).toString("base64url"); }
function emailKey(email: string): string { return email.trim().toLowerCase(); }

export class PostgresAuth implements AuthProvider {
  constructor(private readonly db: Database, private readonly google: GoogleIdentityProvider) {}

  async userFromToken(accessToken: string): Promise<Identity | null> {
    if (!accessToken || accessToken.length > 256) return null;
    const result = await this.db.query<{ id: string; email: string }>(
      `select p.id,p.email from auth_sessions s join profiles p on p.id=s.user_id
       where s.access_hash=$1 and s.access_expires_at>now() and s.revoked_at is null`,
      [hash(accessToken)],
    );
    return result.rows[0] ?? null;
  }

  private async session(db: Queryable, userId: string): Promise<Session> {
    const accessToken = token();
    const refreshToken = token();
    await db.query(
      `insert into auth_sessions (id,user_id,access_hash,refresh_hash,access_expires_at,refresh_expires_at)
       values ($1,$2,$3,$4,now()+interval '1 hour',now()+interval '30 days')`,
      [randomUUID(), userId, hash(accessToken), hash(refreshToken)],
    );
    return { accessToken, refreshToken };
  }

  private async profileByEmail(db: Queryable, email: string): Promise<string> {
    const result = await db.query<{ id: string }>(
      `insert into profiles (id,email) values ($1,$2)
       on conflict ((lower(email))) do update set email=excluded.email returning id`,
      [randomUUID(), emailKey(email)],
    );
    return result.rows[0].id;
  }

  async requestEmailOtp(email: string): Promise<void> {
    const normalized = emailKey(email);
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const id = randomUUID();
    await this.db.transaction(async db => {
      await db.query("update email_otp_challenges set used_at=now() where email=$1 and used_at is null", [normalized]);
      await db.query(
        `insert into email_otp_challenges (id,email,code_hash,expires_at)
         values ($1,$2,$3,now()+interval '10 minutes')`,
        [id, normalized, hash(`${id}:${code}`)],
      );
      await queueEmail(db, normalized, "login_otp", { code });
    });
  }

  async verifyEmailOtp(email: string, code: string): Promise<Session> {
    const normalized = emailKey(email);
    const result = await this.db.transaction(async db => {
      const found = await db.query<{ id: string; code_hash: string; attempts: number }>(
        `select id,code_hash,attempts from email_otp_challenges
         where email=$1 and used_at is null and expires_at>now()
         order by created_at desc limit 1 for update`, [normalized],
      );
      const challenge = found.rows[0];
      if (!challenge || challenge.attempts >= 5) return null;
      await db.query("update email_otp_challenges set attempts=attempts+1 where id=$1", [challenge.id]);
      if (challenge.code_hash !== hash(`${challenge.id}:${code}`)) return null;
      await db.query("update email_otp_challenges set used_at=now() where id=$1", [challenge.id]);
      const userId = await this.profileByEmail(db, normalized);
      await db.query(
        `insert into auth_identities (provider,subject,user_id) values ('email',$1,$2)
         on conflict (provider,subject) do nothing`, [normalized, userId],
      );
      return this.session(db, userId);
    });
    if (!result) throw new Error("OTP expired or invalid");
    return result;
  }

  async googleSignInUrl(redirectTo: string) {
    const verifier = token();
    const state = token();
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    return { url: this.google.authorizationUrl(redirectTo, state, challenge), verifier, state };
  }

  async exchangeGoogleCode(code: string, verifier: string, redirectTo: string): Promise<Session> {
    const account = await this.google.exchange(code, verifier, redirectTo);
    return this.googleSession(account);
  }

  async googleCredentialSignIn(credential: string): Promise<Session> {
    let account: { subject: string; email: string; emailVerified: boolean };
    try { account = await this.google.verifyCredential(credential); }
    catch { throw new InvalidGoogleCredential("Invalid Google credential"); }
    if (!account.emailVerified) throw new InvalidGoogleCredential("Google email is not verified");
    return this.googleSession(account);
  }

  private async googleSession(account: { subject: string; email: string; emailVerified: boolean }): Promise<Session> {
    if (!account.emailVerified) throw new Error("Google email is not verified");
    return this.db.transaction(async db => {
      const previous = await db.query<{ user_id: string }>(
        "select user_id from auth_identities where provider='google' and subject=$1", [account.subject],
      );
      const userId = previous.rows[0]?.user_id ?? await this.profileByEmail(db, account.email);
      await db.query(
        `insert into auth_identities (provider,subject,user_id) values ('google',$1,$2)
         on conflict (provider,subject) do nothing`, [account.subject, userId],
      );
      return this.session(db, userId);
    });
  }

  async refreshSession(refreshToken: string): Promise<Session> {
    if (!refreshToken || refreshToken.length > 256) throw new Error("Invalid refresh token");
    return this.db.transaction(async db => {
      const found = await db.query<{ id: string }>(
        `select id from auth_sessions where refresh_hash=$1
         and refresh_expires_at>now() and revoked_at is null for update`, [hash(refreshToken)],
      );
      const row = found.rows[0];
      if (!row) throw new Error("Refresh token expired or revoked");
      const accessToken = token();
      const nextRefresh = token();
      await db.query(
        `update auth_sessions set access_hash=$2,refresh_hash=$3,
         access_expires_at=now()+interval '1 hour',refresh_expires_at=now()+interval '30 days'
         where id=$1`, [row.id, hash(accessToken), hash(nextRefresh)],
      );
      return { accessToken, refreshToken: nextRefresh };
    });
  }

  async revokeSession(accessToken: string, refreshToken?: string): Promise<void> {
    await this.db.query(
      "update auth_sessions set revoked_at=now() where access_hash=$1 or refresh_hash=$2",
      [hash(accessToken), refreshToken ? hash(refreshToken) : ""],
    );
  }
}
