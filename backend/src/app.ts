import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import cors from "@fastify/cors";
import { InvalidGoogleCredential, type AuthProvider, type Identity } from "./auth.js";
import type { ChainVerifier } from "./chain.js";
import type { Database } from "./db.js";
import { BASE_CHAIN_ID, PatelaService, ZARP_BASE, ZARP_DECIMALS } from "./service.js";
import { OrderService } from "./orders.js";
import { OutboxMailer, type MailTransport } from "./email.js";
import { OnboardingService, requireAdmin } from "./onboarding.js";
import { DomainError, requiredEmail as email } from "./validation.js";
import type { Address } from "viem";
import type { ExternalIntegrations, Point } from "./integrations.js";
import { addPostgresRateLimitHook } from "./rate-limit.js";

export interface AppDependencies {
  db: Database;
  auth: AuthProvider;
  chain?: ChainVerifier;
  escrowAddress: Address;
  publicOrigin: string;
  apiOrigin?: string;
  allowedOrigins?: readonly string[];
  cookieDomain?: string;
  cookieSameSite?: "Lax" | "None" | "Strict";
  integrations?: ExternalIntegrations;
  chainId?: number;
  tokenAddress?: Address;
  tokenDecimals?: number;
  googleClientId?: string;
  enableGoogleCodeFlow?: boolean;
  enableAuthSmokePage?: boolean;
  /** Sends queued emails; without one they stay in email_outbox. */
  mailTransport?: MailTransport;
  /** DEMO: also return one-time accept links in API responses, in case an email is slow on stage. */
  demoMode?: boolean;
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DomainError("JSON object required");
  return value as Record<string, unknown>;
}

function point(value: unknown): Point {
  const raw = objectBody(value);
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new DomainError("Valid latitude and longitude required");
  }
  return { lat, lng };
}

export function buildApp({ db, auth, chain, escrowAddress, publicOrigin, apiOrigin = "http://localhost:4000",
  allowedOrigins = [], cookieDomain, cookieSameSite = "Lax", integrations,
  chainId, tokenAddress, tokenDecimals, googleClientId, enableGoogleCodeFlow = true,
  enableAuthSmokePage = false, mailTransport, demoMode = false }: AppDependencies) {
  const app = Fastify({ logger: false, bodyLimit: 128 * 1024 });
  const secureCookie = new URL(apiOrigin).protocol === "https:" ? "; Secure" : "";
  const domainCookie = cookieDomain ? `; Domain=${cookieDomain}` : "";
  const browserOrigins = new Set([publicOrigin, apiOrigin, ...allowedOrigins]);
  const originAllowed = (origin: string | undefined) => !origin || browserOrigins.has(origin);
  const callbackUrl = new URL("/auth/google/callback", apiOrigin);
  const cookie = (name: string, value: string, maxAge: number) =>
    `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=${cookieSameSite}; Max-Age=${maxAge}${domainCookie}${secureCookie}`;
  const sessionCookies = (session: { accessToken: string; refreshToken: string }) => [
    cookie("patela_access", session.accessToken, 3600),
    cookie("patela_refresh", session.refreshToken, 60 * 60 * 24 * 30),
  ];
  function readCookie(request: FastifyRequest, name: string): string | undefined {
    const part = request.headers.cookie?.split(";").map(s => s.trim())
      .find(s => s.startsWith(`${name}=`));
    if (!part) return undefined;
    try { return decodeURIComponent(part.slice(name.length + 1)); }
    catch { return undefined; }
  }
  void app.register(cors, {
    origin: (origin, callback) => callback(null, originAllowed(origin)),
    methods: ["GET", "POST", "PATCH"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  });
  addPostgresRateLimitHook(app, db);
  const service = new PatelaService(db, chainId ?? BASE_CHAIN_ID);
  const mailer = new OutboxMailer(db, mailTransport);
  const orders = new OrderService({ db, chain, escrowAddress, chainId: chainId ?? BASE_CHAIN_ID,
    tokenAddress: tokenAddress ?? ZARP_BASE, tokenDecimals: tokenDecimals ?? ZARP_DECIMALS, publicOrigin, demoMode });
  // Any write may have queued email (sign-in codes, order and business invites, review decisions).
  // Send it before the reply: a Lambda freezes once it has responded. A mail outage never fails the request.
  app.addHook("onSend", async request => {
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
      await mailer.flush().catch(() => { /* Rows stay pending for the next flush. */ });
    }
  });
  const onboarding = new OnboardingService(db, publicOrigin);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      void reply.code(error.status).send({ error: error.message });
      return;
    }
    if (typeof error === "object" && error !== null && "validation" in error) {
      void reply.code(400).send({ error: "Invalid request" });
      return;
    }
    app.log.error(error);
    void reply.code(500).send({ error: "Internal server error" });
  });

  async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<Identity> {
    const authorization = request.headers.authorization;
    if (!authorization && !originAllowed(request.headers.origin)) {
      throw new DomainError("Origin is not allowed for cookie authentication", 403);
    }
    let token = authorization?.startsWith("Bearer ") ? authorization.slice(7)
      : readCookie(request, "patela_access");
    if (!token) throw new DomainError("Session required", 401);
    let identity = await auth.userFromToken(token);
    if (!identity && !authorization) {
      const refresh = readCookie(request, "patela_refresh");
      if (refresh) {
        try {
          const session = await auth.refreshSession(refresh);
          token = session.accessToken;
          identity = await auth.userFromToken(token);
          if (identity) reply.header("Set-Cookie", sessionCookies(session));
        } catch { /* Expired or revoked refresh token. */ }
      }
    }
    if (!identity) throw new DomainError("Invalid or expired session", 401);
    await service.ensureProfile(identity);
    return identity;
  }

  app.get("/health", async () => ({ ok: true }));

  app.post("/auth/otp/request", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = objectBody(request.body);
    await auth.requestEmailOtp(email(body.email));
    return { queued: true };
  });
  app.post("/auth/otp/verify", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = objectBody(request.body);
    if (typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) throw new DomainError("Six-digit code required");
    const session = await auth.verifyEmailOtp(email(body.email), body.code);
    const identity = await auth.userFromToken(session.accessToken);
    if (!identity) throw new DomainError("Verified session had no user", 401);
    await service.ensureProfile(identity);
    reply.header("Cache-Control", "no-store");
    reply.header("Set-Cookie", sessionCookies(session));
    return { authenticated: true, profile: await service.profile(identity.id) };
  });
  app.get("/auth/google/url", async (_request, reply) => {
    if (!enableGoogleCodeFlow) throw new DomainError("Google authorization-code sign-in is not configured", 503);
    const started = await auth.googleSignInUrl(callbackUrl.toString());
    reply.header("Cache-Control", "no-store");
    reply.header("Set-Cookie", cookie("patela_pkce", JSON.stringify({ v: started.verifier, s: started.state }), 300));
    return { url: started.url };
  });
  app.get("/auth/google/start", async (_request, reply) => {
    if (!enableGoogleCodeFlow) throw new DomainError("Google authorization-code sign-in is not configured", 503);
    const started = await auth.googleSignInUrl(callbackUrl.toString());
    reply.header("Cache-Control", "no-store");
    reply.header("Set-Cookie", cookie("patela_pkce", JSON.stringify({ v: started.verifier, s: started.state }), 300));
    return reply.redirect(started.url, 303);
  });
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>("/auth/google/callback", async (request, reply) => {
    if (!enableGoogleCodeFlow) throw new DomainError("Google authorization-code sign-in is not configured", 503);
    reply.header("Cache-Control", "no-store");
    let challenge: { v: string; s: string } | undefined;
    try { challenge = JSON.parse(readCookie(request, "patela_pkce") ?? ""); } catch { /* Missing cookie. */ }
    if (request.query.error || !request.query.code || !challenge?.v || !challenge.s
      || !request.query.state || request.query.state !== challenge.s) {
      throw new DomainError("Google sign-in was cancelled or its state expired", 400);
    }
    let session: { accessToken: string; refreshToken: string };
    try { session = await auth.exchangeGoogleCode(request.query.code, challenge.v, callbackUrl.toString()); }
    catch { throw new DomainError("Google sign-in could not be completed", 401); }
    const identity = await auth.userFromToken(session.accessToken);
    if (!identity) throw new DomainError("Google session had no verified user", 401);
    await service.ensureProfile(identity);
    reply.header("Set-Cookie", [
      ...sessionCookies(session), cookie("patela_pkce", "", 0),
    ]);
    return reply.redirect(new URL(publicOrigin === apiOrigin ? "/auth/success" : "/?auth=google", publicOrigin).toString(), 303);
  });
  app.post("/auth/google/id-token", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!request.headers.origin || !originAllowed(request.headers.origin)) {
        throw new DomainError("Origin is not allowed", 403);
      }
      if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
        throw new DomainError("JSON required", 415);
      }
      const credential = objectBody(request.body).credential;
      if (typeof credential !== "string" || credential.length < 100 || credential.length > 8192) {
        throw new DomainError("Google credential required", 400);
      }
      let session;
      try { session = await auth.googleCredentialSignIn(credential); }
      catch (error) {
        if (error instanceof InvalidGoogleCredential) throw new DomainError("Google credential is invalid", 401);
        throw error;
      }
      const identity = await auth.userFromToken(session.accessToken);
      if (!identity) throw new DomainError("Google session had no verified user", 401);
      await service.ensureProfile(identity);
      reply.header("Cache-Control", "no-store");
      reply.header("Set-Cookie", sessionCookies(session));
      return { authenticated: true, profile: await service.profile(identity.id) };
    });
  if (enableAuthSmokePage && googleClientId) {
    app.get("/auth/google/test", async (_request, reply) => {
      const nonce = randomBytes(16).toString("base64");
      const clientId = JSON.stringify(googleClientId).replace(/</g, "\\u003c");
      reply.header("Cache-Control", "no-store");
      reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
      reply.header("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
      reply.header("Content-Security-Policy",
        `default-src 'none'; script-src 'nonce-${nonce}' https://accounts.google.com https://*.gstatic.com; `
        + "style-src 'unsafe-inline' https://accounts.google.com; frame-src https://accounts.google.com; "
        + "connect-src 'self' https://accounts.google.com; img-src https: data:; base-uri 'none'; form-action 'self'");
      return reply.type("text/html; charset=utf-8").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Patela sign-in test</title></head>
<body><main><h1>Patela sign-in test</h1><div id="google-button"></div><p id="status" role="status"></p></main>
<script nonce="${nonce}">window.onload = () => {
  google.accounts.id.initialize({client_id: ${clientId}, callback: async ({credential}) => {
    const result = await fetch('/auth/google/id-token', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'include', body: JSON.stringify({credential})});
    if (result.ok) window.location.assign('/auth/success');
    else document.getElementById('status').textContent = 'Sign-in failed (' + result.status + ')';
  }});
  google.accounts.id.renderButton(document.getElementById('google-button'), {theme: 'outline', size: 'large'});
};</script>
<script src="https://accounts.google.com/gsi/client" async defer></script></body></html>`);
    });
  }
  app.get("/auth/success", async (request, reply) => {
    const user = await requireUser(request, reply);
    reply.header("Cache-Control", "no-store");
    return { authenticated: true, profile: await service.profile(user.id) };
  });
  app.post("/auth/logout", async (request, reply) => {
    if (!originAllowed(request.headers.origin)) {
      throw new DomainError("Origin is not allowed", 403);
    }
    const access = request.headers.authorization?.startsWith("Bearer ")
      ? request.headers.authorization.slice(7) : readCookie(request, "patela_access");
    const refresh = readCookie(request, "patela_refresh");
    if (access || refresh) await auth.revokeSession(access ?? "", refresh);
    reply.header("Set-Cookie", [cookie("patela_access", "", 0), cookie("patela_refresh", "", 0)]);
    return { signedOut: true };
  });

  app.get("/me", async (request, reply) => {
    const user = await requireUser(request, reply);
    return service.profile(user.id);
  });
  app.patch("/me", async (request, reply) => {
    const user = await requireUser(request, reply);
    return service.updateProfile(user.id, objectBody(request.body).fullName);
  });
  app.post("/wallet/challenge", async (request, reply) => {
    const user = await requireUser(request, reply);
    return service.issueWalletChallenge(user.id, objectBody(request.body).wallet);
  });
  app.post("/wallet/link", async (request, reply) => {
    const user = await requireUser(request, reply);
    const body = objectBody(request.body);
    return service.linkWallet(user.id, body.challengeId, body.signature);
  });
  app.get("/onboarding", async (request, reply) => {
    const user = await requireUser(request, reply);
    return onboarding.state(user.id);
  });
  app.post("/organizations", async (request, reply) => {
    const user = await requireUser(request, reply);
    return onboarding.create(user.id, objectBody(request.body));
  });
  app.patch<{ Params: { id: string } }>("/organizations/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    return onboarding.update(user.id, request.params.id, objectBody(request.body));
  });
  app.post<{ Params: { id: string } }>("/organizations/:id/submit", async (request, reply) => {
    const user = await requireUser(request, reply);
    return onboarding.submit(user.id, request.params.id);
  });
  app.post<{ Params: { id: string } }>("/organizations/:id/invitations",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const user = await requireUser(request, reply);
    const body = objectBody(request.body);
    return onboarding.invite(user.id, request.params.id, body.email, body.memberRole);
  });
  app.post("/invitations/accept", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const user = await requireUser(request, reply);
    return onboarding.accept(user.id, objectBody(request.body).token);
  });
  app.get<{ Querystring: { status?: string } }>("/admin/organizations", async (request, reply) => {
    const user = await requireUser(request, reply);
    return { organizations: await onboarding.listForReview(user.id, request.query.status) };
  });
  app.post<{ Params: { id: string } }>("/admin/organizations/:id/review", async (request, reply) => {
    const user = await requireUser(request, reply);
    const body = objectBody(request.body);
    return onboarding.review(user.id, request.params.id, body.decision, body.reason);
  });
  app.get("/admin/outbox", async (request, reply) => {
    const user = await requireUser(request, reply);
    await requireAdmin(db, user.id);
    return mailer.outbox();
  });
  app.post("/admin/outbox/flush", async (request, reply) => {
    const user = await requireUser(request, reply);
    await requireAdmin(db, user.id);
    await mailer.flush();
    return mailer.outbox();
  });

  app.get("/dashboard", async (request, reply) => {
    const user = await requireUser(request, reply);
    return { profile: await service.profile(user.id), orders: await orders.list(user.id) };
  });
  app.get("/orders", async (request, reply) => {
    const user = await requireUser(request, reply);
    return { orders: await orders.list(user.id) };
  });
  app.post("/orders", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const user = await requireUser(request, reply);
    return orders.createOrder(user.id, objectBody(request.body));
  });
  app.get<{ Params: { id: string } }>("/orders/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    return orders.view(user.id, request.params.id);
  });
  app.get<{ Params: { token: string } }>("/invitations/:token",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async request => orders.invitation(request.params.token));
  app.post<{ Params: { token: string } }>("/invitations/:token/accept",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const user = await requireUser(request, reply);
    return orders.acceptInvitation(user.id, request.params.token, objectBody(request.body).walletAddress);
  });
  type OrderParams = { Params: { id: string } };
  type StageParams = { Params: { id: string; stage: string } };
  type SessionParams = { Params: { id: string; stage: string; sessionId: string } };
  app.post<OrderParams>("/orders/:id/chain", async (request, reply) => {
    const user = await requireUser(request, reply);
    const body = objectBody(request.body);
    return orders.linkChain(user.id, request.params.id, body.chainOrderId, body.createTxHash);
  });
  const txRoutes = {
    "funding/verify": orders.verifyFunding,
    "acceptance/verify": orders.verifyAcceptance,
    "driver/verify": orders.verifyDriver,
    "refund/verify": orders.verifyRefund,
  } as const;
  for (const [path, verify] of Object.entries(txRoutes)) {
    app.post<OrderParams>(`/orders/:id/${path}`, async (request, reply) => {
      const user = await requireUser(request, reply);
      return verify.call(orders, user.id, request.params.id, objectBody(request.body).txHash);
    });
  }
  app.post<OrderParams>("/orders/:id/driver-invite",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const user = await requireUser(request, reply);
    return orders.inviteDriver(user.id, request.params.id, objectBody(request.body).email);
  });
  app.post<StageParams>("/orders/:id/handoffs/:stage/session", async (request, reply) => {
    const user = await requireUser(request, reply);
    return orders.openSession(user.id, request.params.id, request.params.stage, objectBody(request.body));
  });
  app.get<SessionParams>("/orders/:id/handoffs/:stage/session/:sessionId", async (request, reply) => {
    const user = await requireUser(request, reply);
    const { id, stage, sessionId } = request.params;
    return orders.sessionState(user.id, id, stage, sessionId);
  });
  app.post<SessionParams>("/orders/:id/handoffs/:stage/session/:sessionId/receiver", async (request, reply) => {
    const user = await requireUser(request, reply);
    const { id, stage, sessionId } = request.params;
    return orders.submitReceiver(user.id, id, stage, sessionId, objectBody(request.body));
  });
  app.post<StageParams>("/orders/:id/handoffs/:stage/verify", async (request, reply) => {
    const user = await requireUser(request, reply);
    return orders.verifyHandoff(user.id, request.params.id, request.params.stage, objectBody(request.body).txHash);
  });
  app.post<OrderParams>("/orders/:id/disputes", async (request, reply) => {
    const user = await requireUser(request, reply);
    return orders.raiseDispute(user.id, request.params.id, objectBody(request.body).reason);
  });
  app.get("/admin/disputes", async (request, reply) => {
    const user = await requireUser(request, reply);
    return { disputes: await orders.listOpenDisputes(user.id) };
  });
  app.post<OrderParams>("/admin/disputes/:id/review", async (request, reply) => {
    const user = await requireUser(request, reply);
    const body = objectBody(request.body);
    return orders.reviewDispute(user.id, request.params.id, body.decision, body.note);
  });
  app.post<{ Params: { id: string } }>("/orders/:id/route",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const user = await requireUser(request, reply);
    await orders.requireParticipant(user.id, request.params.id);
    if (!integrations) throw new DomainError("Google Maps is not configured", 503);
    const body = objectBody(request.body);
    const origin = point(body.origin);
    const destination = point(body.destination);
    try { return await integrations.route(origin, destination); }
    catch (error) { throw new DomainError(error instanceof Error ? error.message : "Route unavailable", 502); }
  });
  app.post("/voice/transcribe", { bodyLimit: 1_500_000,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    await requireUser(request, reply);
    if (!integrations) throw new DomainError("Google Speech is not configured", 503);
    const body = objectBody(request.body);
    if (typeof body.audioBase64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.audioBase64)) {
      throw new DomainError("Base64 WebM/Opus audio required");
    }
    const audio = Buffer.from(body.audioBase64, "base64");
    if (audio.length < 100 || audio.length > 1_000_000) throw new DomainError("Audio must be 100 bytes to 1 MB");
    const languageCode = typeof body.languageCode === "string" ? body.languageCode : "en-ZA";
    if (!/^[a-z]{2,3}-[A-Z]{2}$/.test(languageCode)) throw new DomainError("Invalid language code");
    const sampleRateHertz = body.sampleRateHertz === undefined ? 48000 : Number(body.sampleRateHertz);
    if (![8000,12000,16000,24000,48000].includes(sampleRateHertz)) {
      throw new DomainError("Unsupported WebM/Opus sample rate");
    }
    try { return { transcript: await integrations.transcribe(audio, languageCode, sampleRateHertz) }; }
    catch { throw new DomainError("Transcription unavailable", 502); }
  });
  app.post("/voice/speak", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    await requireUser(request, reply);
    if (!integrations) throw new DomainError("Google Speech is not configured", 503);
    const body = objectBody(request.body);
    if (typeof body.text !== "string" || body.text.trim().length < 1 || body.text.length > 500) {
      throw new DomainError("Text must be 1 to 500 characters");
    }
    const languageCode = typeof body.languageCode === "string" ? body.languageCode : "en-ZA";
    if (!/^[a-z]{2,3}-[A-Z]{2}$/.test(languageCode)) throw new DomainError("Invalid language code");
    try {
      const audio = await integrations.speak(body.text.trim(), languageCode);
      return { mimeType: "audio/mpeg", audioBase64: audio.toString("base64") };
    } catch { throw new DomainError("Speech synthesis unavailable", 502); }
  });
  return app;
}
