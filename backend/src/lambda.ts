import type { FastifyInstance } from "fastify";
import { createRuntime } from "./runtime.js";

export interface HttpApiEvent {
  version: "2.0";
  rawPath: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  cookies?: string[];
  body?: string;
  isBase64Encoded?: boolean;
  requestContext: { http: { method: string; sourceIp: string }; domainName?: string };
}

export function createLambdaHandler(app: FastifyInstance) {
  return async (event: HttpApiEvent) => {
    if (event.version !== "2.0") throw new Error("API Gateway HTTP API payload v2 is required");
    await app.ready();
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(event.headers ?? {})) {
      if (value !== undefined) headers[key] = value;
    }
    if (event.cookies?.length) headers.cookie = event.cookies.join("; ");
    const method = event.requestContext.http.method.toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(method)) {
      return { statusCode: 405, headers: {}, cookies: [], body: "Method Not Allowed", isBase64Encoded: false };
    }
    const response = await app.inject({
      method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS",
      url: event.rawPath + (event.rawQueryString ? `?${event.rawQueryString}` : ""),
      headers,
      remoteAddress: event.requestContext.http.sourceIp,
      payload: event.body === undefined ? undefined
        : event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body,
    });
    const outHeaders: Record<string, string> = {};
    let cookies: string[] = [];
    for (const [key, value] of Object.entries(response.headers)) {
      if (key.toLowerCase() === "set-cookie") {
        cookies = (Array.isArray(value) ? value : [value]).map(String);
      } else if (value !== undefined) {
        outHeaders[key] = Array.isArray(value) ? value.join(", ") : String(value);
      }
    }
    return { statusCode: response.statusCode, headers: outHeaders, cookies,
      body: response.body, isBase64Encoded: false };
  };
}

let cached: ReturnType<typeof createLambdaHandler> | undefined;
export async function handler(event: HttpApiEvent) {
  if (!cached) {
    if (!process.env.API_ORIGIN && event.requestContext.domainName) {
      process.env.API_ORIGIN = `https://${event.requestContext.domainName}`;
    }
    cached = createLambdaHandler(createRuntime().app);
  }
  return cached(event);
}
