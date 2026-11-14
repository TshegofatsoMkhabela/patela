import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Address } from "viem";
import { buildApp } from "../src/app.js";
import { missingCapability } from "../src/onboarding.js";
import { TestAuth, TestDatabase } from "./helpers.js";

const escrow = "0x1111111111111111111111111111111111111111" as Address;
const business = {
  legalName: "Limpopo Fresh Produce (Pty) Ltd",
  registrationNumber: "2019/123456/07",
  vatNumber: "4123456789",
  capabilities: ["supplier", "warehouse"],
};

async function setup(people: number) {
  const db = new TestDatabase();
  assert.deepEqual(await db.migrate(), ["001_core.sql", "002_organizations.sql", "003_auth.sql",
    "004_two_handoff_orders.sql", "005_rate_limits.sql"]);
  assert.deepEqual(await db.migrate(), [], "each migration is applied only once");
  const auth = new TestAuth();
  const ids = Array.from({ length: people }, () => randomUUID());
  ids.forEach((id, i) => auth.users.set(`user-${i}`, { id, email: `user${i}@example.test` }));
  const app = buildApp({ db, auth, escrowAddress: escrow, publicOrigin: "http://localhost:3000" });
  const call = (method: "GET" | "POST" | "PATCH", url: string, user: number, payload?: object) =>
    app.inject({ method, url, payload, headers: { authorization: `Bearer user-${user}` } });
  const close = async () => { await app.close(); await db.close(); };
  /** Reads the newest invite email from the demo outbox, as the invitee's inbox would. */
  const latestInvite = async (admin: number) => {
    const email = (await call("GET", "/admin/outbox", admin)).json().emails
      .filter((e: { template: string }) => e.template === "member_invited").at(-1);
    return { to: email.to_email as string, url: new URL(email.payload.acceptUrl),
      token: new URL(email.payload.acceptUrl).searchParams.get("token") };
  };
  return { db, ids, call, close, latestInvite };
}

test("a new sign-up has no trading rights until a business is created and approved", async () => {
  const { db, ids, call, close } = await setup(2);
  try {
    const fresh = await call("GET", "/onboarding", 0);
    assert.equal(fresh.statusCode, 200, fresh.body);
    assert.equal(fresh.json().profile.role, "member");
    assert.deepEqual(fresh.json().organizations, []);
    assert.equal(fresh.json().nextStep, "create_organization");

    const badCipc = await call("POST", "/organizations", 0, { ...business, registrationNumber: "12345" });
    assert.equal(badCipc.statusCode, 400);
    const badCapability = await call("POST", "/organizations", 0, { ...business, capabilities: ["admin"] });
    assert.equal(badCapability.statusCode, 400);

    const created = await call("POST", "/organizations", 0, business);
    assert.equal(created.statusCode, 200, created.body);
    const org = created.json();
    assert.equal(org.status, "draft");
    assert.equal(org.member_role, "owner");
    assert.deepEqual(org.capabilities, ["supplier", "warehouse"]);
    assert.equal((await call("GET", "/onboarding", 0)).json().nextStep, "submit_for_review");

    const duplicate = await call("POST", "/organizations", 1, business);
    assert.equal(duplicate.statusCode, 409);
    const notMine = await call("POST", `/organizations/${org.id}/submit`, 1);
    assert.equal(notMine.statusCode, 404);

    const submitted = await call("POST", `/organizations/${org.id}/submit`, 0);
    assert.equal(submitted.statusCode, 200, submitted.body);
    assert.equal(submitted.json().status, "submitted");
    assert.equal((await call("GET", "/onboarding", 0)).json().nextStep, "awaiting_review");
    const lockedEdit = await call("PATCH", `/organizations/${org.id}`, 0, { legalName: "Changed (Pty) Ltd" });
    assert.equal(lockedEdit.statusCode, 409);

    const notAdmin = await call("POST", `/admin/organizations/${org.id}/review`, 1,
      { decision: "approve" });
    assert.equal(notAdmin.statusCode, 403);
    await db.query("update profiles set role='admin' where id=$1", [ids[1]]);
    const queue = await call("GET", "/admin/organizations?status=submitted", 1);
    assert.equal(queue.statusCode, 200);
    assert.deepEqual(queue.json().organizations.map((o: { id: string }) => o.id), [org.id]);

    const noReason = await call("POST", `/admin/organizations/${org.id}/review`, 1, { decision: "reject" });
    assert.equal(noReason.statusCode, 400);
    const rejected = await call("POST", `/admin/organizations/${org.id}/review`, 1,
      { decision: "reject", reason: "CIPC certificate name does not match." });
    assert.equal(rejected.statusCode, 200, rejected.body);
    assert.equal(rejected.json().status, "rejected");
    const afterReject = (await call("GET", "/onboarding", 0)).json();
    assert.equal(afterReject.nextStep, "fix_and_resubmit");
    assert.equal(afterReject.organizations[0].rejection_reason, "CIPC certificate name does not match.");

    const edited = await call("PATCH", `/organizations/${org.id}`, 0, { legalName: "Limpopo Fresh (Pty) Ltd" });
    assert.equal(edited.statusCode, 200, edited.body);
    assert.equal(edited.json().legal_name, "Limpopo Fresh (Pty) Ltd");
    assert.equal((await call("POST", `/organizations/${org.id}/submit`, 0)).statusCode, 200);
    const approved = await call("POST", `/admin/organizations/${org.id}/review`, 1, { decision: "approve" });
    assert.equal(approved.statusCode, 200, approved.body);
    assert.equal(approved.json().status, "approved");
    assert.equal((await call("GET", "/onboarding", 0)).json().nextStep, "ready");
    assert.equal(await missingCapability(db, [[ids[0], "supplier"]]), null);
    assert.equal(await missingCapability(db, [[ids[0], "carrier"]]), "carrier");
    const reReview = await call("POST", `/admin/organizations/${org.id}/review`, 1, { decision: "reject",
      reason: "Second look at the same business." });
    assert.equal(reReview.statusCode, 409);

    const outbox = await call("GET", "/admin/outbox", 1);
    assert.equal(outbox.statusCode, 200);
    assert.equal(outbox.json().demo, true);
    assert.deepEqual(outbox.json().emails.map((e: { template: string; to_email: string }) =>
      [e.template, e.to_email]), [
      ["organization_submitted", "user0@example.test"],
      ["organization_rejected", "user0@example.test"],
      ["organization_submitted", "user0@example.test"],
      ["organization_approved", "user0@example.test"],
    ]);
    assert.equal((await call("GET", "/admin/outbox", 0)).statusCode, 403);
  } finally {
    await close();
  }
});

test("an invitation adds an existing user to the business without overwriting their account", async () => {
  const { db, ids, call, close, latestInvite } = await setup(4);
  try {
    const org = (await call("POST", "/organizations", 0, business)).json();
    // user-1 signed up on their own before being invited.
    assert.equal((await call("GET", "/onboarding", 1)).json().profile.role, "member");
    await call("GET", "/onboarding", 3);
    await db.query("update profiles set role='admin' where id=$1", [ids[3]]);

    const invalidRole = await call("POST", `/organizations/${org.id}/invitations`, 0,
      { email: "user1@example.test", memberRole: "owner" });
    assert.equal(invalidRole.statusCode, 400);
    const invited = await call("POST", `/organizations/${org.id}/invitations`, 0,
      { email: "USER1@example.test", memberRole: "admin" });
    assert.equal(invited.statusCode, 200, invited.body);
    assert.equal(invited.json().email, "user1@example.test");
    assert.equal(invited.json().token, undefined);

    const { to, url, token } = await latestInvite(3);
    assert.equal(to, "user1@example.test");
    assert.equal(url.origin, "http://localhost:3000");
    assert.ok(token && token.length >= 40);

    const wrongPerson = await call("POST", "/invitations/accept", 2, { token });
    assert.equal(wrongPerson.statusCode, 403);
    const badToken = await call("POST", "/invitations/accept", 1, { token: "x".repeat(64) });
    assert.equal(badToken.statusCode, 404);
    const accepted = await call("POST", "/invitations/accept", 1, { token });
    assert.equal(accepted.statusCode, 200, accepted.body);
    assert.equal(accepted.json().id, org.id);
    assert.equal(accepted.json().member_role, "admin");
    const reused = await call("POST", "/invitations/accept", 1, { token });
    assert.equal(reused.statusCode, 409);

    const colleague = (await call("GET", "/onboarding", 1)).json();
    assert.equal(colleague.profile.role, "member");
    assert.deepEqual(colleague.organizations.map((o: { id: string; member_role: string }) =>
      [o.id, o.member_role]), [[org.id, "admin"]]);

    // An admin member may invite; a plain member may not.
    const byAdmin = await call("POST", `/organizations/${org.id}/invitations`, 1,
      { email: "user2@example.test", memberRole: "member" });
    assert.equal(byAdmin.statusCode, 200, byAdmin.body);
    const memberToken = (await latestInvite(3)).token;
    assert.equal((await call("POST", "/invitations/accept", 2, { token: memberToken })).statusCode, 200);
    const byMember = await call("POST", `/organizations/${org.id}/invitations`, 2,
      { email: "new@example.test", memberRole: "member" });
    assert.equal(byMember.statusCode, 403);
    const outsider = await call("POST", `/organizations/${org.id}/invitations`, 3,
      { email: "new@example.test", memberRole: "member" });
    assert.equal(outsider.statusCode, 404);

    const late = await call("POST", `/organizations/${org.id}/invitations`, 0,
      { email: "user3@example.test", memberRole: "member" });
    await db.query("update invitations set expires_at=now() - interval '1 minute' where id=$1", [late.json().id]);
    const lateToken = (await latestInvite(3)).token;
    assert.equal((await call("POST", "/invitations/accept", 3, { token: lateToken })).statusCode, 409);
  } finally {
    await close();
  }
});
