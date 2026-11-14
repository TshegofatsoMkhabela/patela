import assert from "node:assert/strict";
import test from "node:test";
import { OutboxMailer, renderEmail } from "../src/email.js";
import { zeroAddress } from "viem";
import { buildApp } from "../src/app.js";
import { TestAuth, TestDatabase } from "./helpers.js";
import { TestMail } from "./demo-helpers.js";

test("order invite emails name the role and carry the accept link", () => {
  const email = renderEmail("order_supplier_invited",
    { acceptUrl: "https://demo.example/accept?token=abc", agreementText: "20 crates" });
  assert.match(email.subject, /supplier/i);
  assert.ok(email.text.includes("https://demo.example/accept?token=abc"));
  assert.ok(email.text.includes("20 crates"));
});

test("the mailer sends pending rows once, and gives up on a row after three failures", async () => {
  const db = new TestDatabase();
  const mail = new TestMail();
  const mailer = new OutboxMailer(db, mail);
  try {
    await db.migrate();
    await db.query(`insert into email_outbox (id,to_email,template,payload) values
      (gen_random_uuid(),'a@example.test','order_driver_invited','{"acceptUrl":"https://x/accept?token=1"}')`);
    mail.failing = true;
    for (let attempt = 1; attempt <= 2; attempt++) {
      await mailer.flush();
      const row = (await db.query("select status,attempts from email_outbox")).rows[0];
      assert.deepEqual(row, { status: "pending", attempts: attempt });
    }
    await mailer.flush();
    assert.equal((await db.query("select status from email_outbox")).rows[0].status, "failed");
    await db.query(`insert into email_outbox (id,to_email,template,payload) values
      (gen_random_uuid(),'b@example.test','order_driver_invited','{"acceptUrl":"https://x/accept?token=2"}')`);
    mail.failing = false;
    await mailer.flush();
    await mailer.flush();
    assert.deepEqual(mail.sent.map(m => m.to), ["b@example.test"], "sent once; failed rows are not retried");
    const sent = (await db.query("select status,sent_at from email_outbox where to_email='b@example.test'")).rows[0];
    assert.equal(sent.status, "sent");
    assert.ok(sent.sent_at);
  } finally { await db.close(); }
});

test("without a transport the mailer leaves every row queued", async () => {
  const db = new TestDatabase();
  try {
    await db.migrate();
    await db.query(`insert into email_outbox (id,to_email,template,payload)
      values (gen_random_uuid(),'a@example.test','order_supplier_invited','{}')`);
    await new OutboxMailer(db, undefined).flush();
    assert.equal((await db.query("select status from email_outbox")).rows[0].status, "pending");
  } finally { await db.close(); }
});

test("a sign-in code email shows the six-digit code", () => {
  const email = renderEmail("login_otp", { code: "042137" });
  assert.match(email.subject, /sign-in code/i);
  assert.ok(email.text.includes("042137"));
});

test("requesting a sign-in code sends the email before the response", async () => {
  const db = new TestDatabase();
  const mail = new TestMail();
  // Queues like PostgresAuth does, so the route's flush is what delivers it.
  class QueueingAuth extends TestAuth {
    override async requestEmailOtp(email: string) {
      await db.query(`insert into email_outbox (id,to_email,template,payload)
        values (gen_random_uuid(),$1,'login_otp','{"code":"123456"}')`, [email]);
    }
  }
  const app = buildApp({ db, auth: new QueueingAuth(), escrowAddress: zeroAddress,
    publicOrigin: "http://localhost:3000", mailTransport: mail });
  try {
    await db.migrate();
    const response = await app.inject({ method: "POST", url: "/auth/otp/request",
      payload: { email: "supplier@example.test" } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(mail.sent.map(m => m.to), ["supplier@example.test"]);
    assert.ok(mail.sent[0].text.includes("123456"));
  } finally { await app.close(); await db.close(); }
});

test("a stalled mail server holds a request up for one time budget, not per email", async () => {
  const db = new TestDatabase();
  const hanging = { send: () => new Promise<void>(() => {}) };
  const mailer = new OutboxMailer(db, hanging, 50, 120);
  try {
    await db.migrate();
    for (let i = 0; i < 5; i++) {
      await db.query(`insert into email_outbox (id,to_email,template,payload)
        values (gen_random_uuid(),'a@example.test','order_driver_invited','{}')`);
    }
    const started = Date.now();
    await mailer.flush();
    assert.ok(Date.now() - started < 400, `flush took ${Date.now() - started} ms`);
    const rows = (await db.query("select status, attempts from email_outbox")).rows;
    assert.ok(rows.every(r => r.status === "pending"), "unsent rows stay pending");
    assert.ok(rows.some(r => r.attempts === 0), "rows past the budget are left for the next flush");
  } finally { await db.close(); }
});

test("a sign-in code older than ten minutes is never sent", async () => {
  const db = new TestDatabase();
  const mail = new TestMail();
  try {
    await db.migrate();
    await db.query(`insert into email_outbox (id,to_email,template,payload,created_at)
      values (gen_random_uuid(),'late@example.test','login_otp','{"code":"111111"}',now() - interval '11 minutes')`);
    await new OutboxMailer(db, mail).flush();
    assert.deepEqual(mail.sent, []);
    assert.equal((await db.query("select status from email_outbox")).rows[0].status, "failed");
  } finally { await db.close(); }
});

test("the supplier invite carries an invoice with the total and payment schedule", () => {
  const email = renderEmail("order_supplier_invited", {
    acceptUrl: "https://demo.example/accept?token=abc",
    agreementText: "40 office chairs to Durban by Friday",
    invoice: {
      number: "PAT-1A2B3C4D",
      issuedAt: "2026-11-14T08:00:00.000Z",
      buyerEmail: "buyer@demo.patela.local",
      supplierEmail: "supplier@demo.patela.local",
      total: "48000",
      lines: [
        { label: "Driver, at pickup", amount: "4800" },
        { label: "Supplier, at pickup", amount: "19200" },
        { label: "Supplier, at delivery", amount: "24000" },
      ],
      refundDeadline: "2026-11-17T08:00:00.000Z",
    },
  });
  assert.match(email.subject, /invoice PAT-1A2B3C4D/i);
  assert.match(email.text, /INVOICE PAT-1A2B3C4D/);
  assert.match(email.text, /Bill to: buyer@demo\.patela\.local/);
  assert.match(email.text, /40 office chairs to Durban by Friday/);
  assert.match(email.text, /Supplier, at delivery\s+R 24 000\.00/);
  assert.match(email.text, /Total held in escrow\s+R 48 000\.00/);
  assert.match(email.text, /https:\/\/demo\.example\/accept\?token=abc/);
});

test("an invite without invoice details still renders the plain invitation", () => {
  const email = renderEmail("order_driver_invited", { acceptUrl: "https://x/accept?token=t" });
  assert.doesNotMatch(email.text, /INVOICE/);
});
