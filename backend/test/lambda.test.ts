import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { createLambdaHandler, type HttpApiEvent } from "../src/lambda.js";

test("API Gateway v2 adapter preserves path, query, body, and cookies", async () => {
  const app = Fastify();
  app.post("/echo", async (request, reply) => {
    reply.header("Set-Cookie", ["first=one; HttpOnly", "second=two; HttpOnly"]);
    return { query: request.query, body: request.body, cookie: request.headers.cookie };
  });
  try {
    const event: HttpApiEvent = {
      version: "2.0", rawPath: "/echo", rawQueryString: "a=1",
      headers: { "content-type": "application/json" }, cookies: ["session=abc"],
      body: JSON.stringify({ ok: true }), requestContext: { http: { method: "POST" } },
    };
    const response = await createLambdaHandler(app)(event);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.cookies, ["first=one; HttpOnly", "second=two; HttpOnly"]);
    assert.deepEqual(JSON.parse(response.body), {
      query: { a: "1" }, body: { ok: true }, cookie: "session=abc",
    });
  } finally { await app.close(); }
});
