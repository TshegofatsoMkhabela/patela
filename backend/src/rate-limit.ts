import { createHash } from "node:crypto";
import { normalizeIP } from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import type { Database } from "./db.js";

interface LimitOptions {
  max: number;
  timeWindow: number | string;
}

function milliseconds(value: number | string): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const match = typeof value === "string"
    ? /^(\d+)\s*(ms|milliseconds?|s|seconds?|m|minutes?|h|hours?)$/i.exec(value.trim()) : null;
  if (!match) throw new Error(`Invalid rate-limit time window: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "ms" || unit.startsWith("millisecond")) return amount;
  if (unit === "s" || unit.startsWith("second")) return amount * 1_000;
  if (unit === "m" || unit.startsWith("minute")) return amount * 60_000;
  return amount * 3_600_000;
}

async function increment(db: Database, keyHash: string, timeWindow: number) {
  const result = await db.query<{ count: number; ttl: number }>(`
    insert into api_rate_limits (key_hash, count, expires_at)
    values ($1, 1, clock_timestamp() + ($2 * interval '1 millisecond'))
    on conflict (key_hash) do update set
      count = case when api_rate_limits.expires_at <= clock_timestamp()
        then 1 else api_rate_limits.count + 1 end,
      expires_at = case when api_rate_limits.expires_at <= clock_timestamp()
        then excluded.expires_at else api_rate_limits.expires_at end
    returning count,
      greatest(0, ceil(extract(epoch from (expires_at - clock_timestamp())) * 1000))::integer as ttl
  `, [keyHash, timeWindow]);
  const row = result.rows[0];
  if (!row) throw new Error("Rate-limit counter was not returned");
  return { current: Number(row.count), ttl: Number(row.ttl) };
}

/** Shared counters survive Lambda freezes without persisting raw client IPs. */
export function addPostgresRateLimitHook(app: FastifyInstance, db: Database) {
  app.addHook("onRequest", async (request, reply) => {
    const options = request.routeOptions.config.rateLimit;
    if (!options || typeof options !== "object") return;
    const { max, timeWindow } = options as LimitOptions;
    const windowMs = milliseconds(timeWindow);
    const route = `${request.method} ${request.routeOptions.url}`;
    const client = normalizeIP(request.ip);
    const keyHash = createHash("sha256").update(route).update("\0").update(client).digest("hex");
    const { current, ttl } = await increment(db, keyHash, windowMs);
    const remaining = Math.max(0, max - current);
    const reset = Math.max(1, Math.ceil(ttl / 1_000));
    reply.headers({
      "x-ratelimit-limit": String(max),
      "x-ratelimit-remaining": String(remaining),
      "x-ratelimit-reset": String(reset),
    });
    if (current > max) {
      return reply.code(429).header("retry-after", String(reset)).send({
        statusCode: 429, error: "Too Many Requests", message: `Rate limit exceeded, retry in ${reset} seconds`,
      });
    }
  });
}
