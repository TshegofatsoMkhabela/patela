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

const invoice = {
  orderId: "7d9c1f2e-0000-4000-8000-000000000001",
  buyerEmail: "buyer@example.test",
  totalWei: "1000000000000000000000",
  driverAtPickupWei: "100000000000000000000",
  supplierAtPickupWei: "400000000000000000000",
  supplierAtDeliveryWei: "500000000000000000000",
  chainId: 11142220,
  tokenAddress: "0x10CCfB235b0E1Ed394bACE4560C3ed016697687e",
  escrowAddress: "0xb7b05da3523bb21e320d8c73feb6da2c10c81426",
  agreementHash: "0xabc123",
  refundDeadline: "2026-11-16T10:00:00.000Z",
};

test("the sign-in code email has a branded HTML body with the code", () => {
  const email = renderEmail("login_otp", { code: "042137" });
  assert.ok(email.html, "an HTML body is rendered");
  assert.ok(email.html.includes("042137"));
  assert.match(email.html, /PATELA/);
  assert.match(email.html, /10 minutes/);
});

test("the supplier invite is an HTML invoice with their payout, the network and the accept button", () => {
  const email = renderEmail("order_supplier_invited", {
    acceptUrl: "https://demo.example/accept?token=abc&x=1",
    agreementText: "20 crates <script>alert(1)</script>",
    invoice,
  });
  const html = email.html ?? "";
  assert.ok(html.includes('href="https://demo.example/accept?token=abc&amp;x=1"'));
  assert.ok(html.includes("1,000.00"), "total");
  assert.ok(html.includes("400.00") && html.includes("500.00") && html.includes("100.00"), "every line");
  assert.match(html, /Your payout[\s\S]*900\.00/);
  assert.match(html, /Celo Sepolia/);
  assert.ok(html.includes("0xb7b05da3523bb21e320d8c73feb6da2c10c81426"), "escrow contract");
  assert.ok(html.includes("0xabc123"), "agreement hash");
  assert.ok(!html.includes("<script>"), "agreement text is escaped");
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(email.text.includes("1,000.00 ZARm"), "the plain-text part carries the invoice too");
  assert.match(email.subject, /invoice PAT-7D9C1F2E/i, "the subject names the invoice");
});

test("the driver invite shows the driver's pickup payment as their payout", () => {
  const html = renderEmail("order_driver_invited", { acceptUrl: "https://d/a", invoice }).html ?? "";
  assert.match(html, /Your payout[\s\S]*100\.00/);
  assert.match(html, /driver/i);
});

test("an invite queued before invoices existed still renders", () => {
  const email = renderEmail("order_supplier_invited", { acceptUrl: "https://d/a" });
  assert.ok(email.html?.includes('href="https://d/a"'));
});
