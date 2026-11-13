import assert from "node:assert/strict";
import test from "node:test";
import { GmailTransport, parseSmtpSecret } from "../src/gmail.js";

type Sent = { from: string; to: string; subject: string; text: string };

test("Gmail transport reads the secret once per container and sends from that account", async () => {
  let loads = 0;
  const sent: Sent[] = [];
  const configs: unknown[] = [];
  const transport = new GmailTransport(async () => { loads++; return { user: "patela.demo@gmail.com", appPassword: "app-pass" }; },
    config => { configs.push(config); return { sendMail: async (mail: Sent) => { sent.push(mail); } }; });
  await transport.send({ to: "a@example.test", subject: "One", text: "1" });
  await transport.send({ to: "b@example.test", subject: "Two", text: "2" });
  assert.equal(loads, 1);
  assert.deepEqual(configs, [{ host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: "patela.demo@gmail.com", pass: "app-pass" } }]);
  assert.deepEqual(sent.map(m => [m.from, m.to]), [
    ["Patela demo <patela.demo@gmail.com>", "a@example.test"],
    ["Patela demo <patela.demo@gmail.com>", "b@example.test"],
  ]);
});

test("a failed secret read is retried on the next send instead of being cached", async () => {
  let loads = 0;
  const transport = new GmailTransport(async () => {
    loads++;
    if (loads === 1) throw new Error("AccessDenied");
    return { user: "patela.demo@gmail.com", appPassword: "app-pass" };
  }, () => ({ sendMail: async () => {} }));
  await assert.rejects(transport.send({ to: "a@example.test", subject: "x", text: "x" }), /AccessDenied/);
  await transport.send({ to: "a@example.test", subject: "x", text: "x" });
  assert.equal(loads, 2);
});

test("the SMTP secret must be JSON with a Gmail user and an app password", () => {
  assert.deepEqual(parseSmtpSecret('{"user":"a@gmail.com","appPassword":"abcd efgh ijkl mnop"}'),
    { user: "a@gmail.com", appPassword: "abcdefghijklmnop" });
  assert.throws(() => parseSmtpSecret("not json"), /SMTP secret/);
  assert.throws(() => parseSmtpSecret('{"user":"a@gmail.com"}'), /SMTP secret/);
});
