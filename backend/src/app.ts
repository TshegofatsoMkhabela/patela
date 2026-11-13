import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import type { AuthProvider, Identity } from "./auth.js";
import type { ChainVerifier } from "./chain.js";
import type { Database } from "./db.js";
import { PatelaService } from "./service.js";
import { OnboardingService } from "./onboarding.js";
import { DomainError, requiredEmail as email } from "./validation.js";
import type { Address } from "viem";
import type { ExternalIntegrations, Point } from "./integrations.js";

export interface AppDependencies {
  db: Database;
  auth: AuthProvider;
  chain?: ChainVerifier;
  escrowAddress: Address;
  publicOrigin: string;
  apiOrigin?: string;
  integrations?: ExternalIntegrations;
  chainId?: number;
  tokenAddress?: Address;
  tokenDecimals?: number;
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

export function buildApp({ db, auth, chain, escrowAddress, publicOrigin, apiOrigin = "http://localhost:4000", integrations,
  chainId, tokenAddress, tokenDecimals }: AppDependencies) {
  const app = Fastify({ logger: false, bodyLimit: 128 * 1024 });
  const secureCookie = new URL(apiOrigin).protocol === "https:" ? "; Secure" : "";
  const callbackUrl = new URL("/auth/google/callback", apiOrigin);
  const cookie = (name: string, value: string, maxAge: number) =>
    `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookie}`;
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
    origin: (origin, callback) => callback(null, !origin || origin === publicOrigin),
    methods: ["GET", "POST", "PATCH"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  });
  void app.register(rateLimit, { global: false });
  const service = new PatelaService(db, chain, escrowAddress, chainId, tokenAddress, tokenDecimals);
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
    if (!authorization && request.headers.origin && request.headers.origin !== publicOrigin) {
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
    return session;
  });
  app.get("/auth/google/url", async (_request, reply) => {
    const started = await auth.googleSignInUrl(callbackUrl.toString());
    reply.header("Cache-Control", "no-store");
    reply.header("Set-Cookie", cookie("patela_pkce", JSON.stringify({ v: started.verifier, s: started.state }), 300));
    return { url: started.url };
  });
  app.get("/auth/google/start", async (_request, reply) => {
    const started = await auth.googleSignInUrl(callbackUrl.toString());
    reply.header("Cache-Control", "no-store");
    reply.header("Set-Cookie", cookie("patela_pkce", JSON.stringify({ v: started.verifier, s: started.state }), 300));
    return reply.redirect(started.url, 303);
  });
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>("/auth/google/callback", async (request, reply) => {
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
  app.get("/auth/success", async (request, reply) => {
    const user = await requireUser(request, reply);
    reply.header("Cache-Control", "no-store");
    return { authenticated: true, profile: await service.profile(user.id) };
  });
  app.post("/auth/logout", async (request, reply) => {
    if (request.headers.origin && request.headers.origin !== publicOrigin) {
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
    return onboarding.outbox(user.id);
  });

  app.get("/dashboard", async (request, reply) => {
    const user = await requireUser(request, reply);
    return { profile: await service.profile(user.id), orders: await service.listOrders(user.id) };
  });
  app.get("/orders", async (request, reply) => {
    const user = await requireUser(request, reply);
    return { orders: await service.listOrders(user.id) };
  });
  app.post("/orders", async (request, reply) => {
    const user = await requireUser(request, reply);
    const body = objectBody(request.body);
    return service.createOrder(user.id, body.amountZarp, body.handoffs, body.refundAfterHours);
  });
  app.get<{ Params: { id: string } }>("/orders/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    return service.orderFor(user.id, request.params.id);
  });
  app.post<{ Params: { id: string } }>("/orders/:id/funding/verify", async (request, reply) => {
    const user = await requireUser(request, reply);
    return service.verifyFunding(user.id, request.params.id, objectBody(request.body).txHash);
  });
  app.post<{ Params: { id: string } }>("/orders/:id/refund/verify", async (request, reply) => {
    const user = await requireUser(request, reply);
    return service.verifyRefund(user.id, request.params.id, objectBody(request.body).txHash);
  });
  app.post<{ Params: { id: string } }>("/orders/:id/disputes", async (request, reply) => {
    const user = await requireUser(request, reply);
    return service.raiseDispute(user.id, request.params.id, objectBody(request.body).reason);
  });
  app.get("/admin/disputes", async (request, reply) => {
    const user = await requireUser(request, reply);
    return { disputes: await service.listOpenDisputes(user.id) };
  });
  app.post<{ Params: { id: string } }>("/admin/disputes/:id/review", async (request, reply) => {
    const user = await requireUser(request, reply);
    const body = objectBody(request.body);
    return service.reviewDispute(user.id, request.params.id, body.decision, body.note);
  });
  app.post<{ Params: { id: string; stage: string } }>(
    "/orders/:id/handoffs/:stage/challenge", async (request, reply) => {
      const user = await requireUser(request, reply);
      return service.issueHandoff(user.id, request.params.id, request.params.stage);
    },
  );
  app.post<{ Params: { id: string; stage: string } }>(
    "/orders/:id/handoffs/:stage/submit", async (request, reply) => {
      const user = await requireUser(request, reply);
      const body = objectBody(request.body);
      return service.submitHandoff(user.id, request.params.id, request.params.stage,
        body.nonce, body.fromSignature, body.toSignature);
    },
  );
  app.post<{ Params: { id: string; stage: string } }>(
    "/orders/:id/handoffs/:stage/verify", async (request, reply) => {
      const user = await requireUser(request, reply);
      return service.verifyHandoff(user.id, request.params.id, request.params.stage,
        objectBody(request.body).txHash);
    },
  );
  app.post<{ Params: { id: string } }>("/orders/:id/route",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const user = await requireUser(request, reply);
    await service.orderFor(user.id, request.params.id);
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
