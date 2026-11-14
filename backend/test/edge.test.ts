import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { zeroAddress } from "viem";
import { buildApp } from "../src/app.js";
import { TestAuth, TestDatabase } from "./helpers.js";

test("rate limits are shared across app instances and keyed by client IP", async () => {
  const db = new TestDatabase();
  const auth = new TestAuth();
  await db.migrate();
  const makeApp = () => buildApp({ db, auth, escrowAddress: zeroAddress,
    publicOrigin: "https://app.example.test", apiOrigin: "https://api.example.test" });
  const request = (app: ReturnType<typeof makeApp>, remoteAddress: string) => app.inject({
    method: "POST", url: "/auth/otp/request", remoteAddress,
    payload: { email: "person@example.test" },
  });
  const first = makeApp();
  try {
    for (let i = 0; i < 5; i++) assert.equal((await request(first, "203.0.113.10")).statusCode, 200);
  } finally { await first.close(); }

  const second = makeApp();
  try {
    assert.equal((await request(second, "203.0.113.10")).statusCode, 429,
      "a cold Lambda instance retains the existing counter");
    assert.equal((await request(second, "203.0.113.11")).statusCode, 200,
      "a different source IP has an independent counter");
  } finally {
    await second.close();
    await db.close();
  }
});

test("additional origins can use credential cookies with configured attributes", async () => {
  const db = new TestDatabase();
  const auth = new TestAuth();
  const id = randomUUID();
  auth.users.set("browser-access", { id, email: "person@example.test" });
  await db.migrate();
  const app = buildApp({ db, auth, escrowAddress: zeroAddress,
    publicOrigin: "https://app.example.test", apiOrigin: "https://api.example.test",
    allowedOrigins: ["https://demo.example.test"], cookieDomain: ".example.test", cookieSameSite: "None" });
  try {
    const cors = await app.inject({ method: "GET", url: "/health",
      headers: { origin: "https://demo.example.test" } });
    assert.equal(cors.headers["access-control-allow-origin"], "https://demo.example.test");
    assert.equal(cors.headers["access-control-allow-credentials"], "true");

    const login = await app.inject({ method: "POST", url: "/auth/otp/verify",
      headers: { origin: "https://demo.example.test" },
      payload: { email: "person@example.test", code: "123456" } });
    assert.equal(login.statusCode, 200, login.body);
    assert.equal(login.json().accessToken, undefined);
    const cookies = login.headers["set-cookie"] as string[];
    assert.ok(cookies.every(value => value.includes("Domain=.example.test")));
    assert.ok(cookies.every(value => value.includes("SameSite=None")));
    assert.ok(cookies.every(value => value.includes("Secure")));
    const cookieHeader = cookies.map(value => value.split(";")[0]).join("; ");
    const me = await app.inject({ method: "GET", url: "/me",
      headers: { origin: "https://demo.example.test", cookie: cookieHeader } });
    assert.equal(me.statusCode, 200, me.body);
  } finally {
    await app.close();
    await db.close();
  }
});
