import { randomBytes, randomUUID } from "node:crypto";
import type { Database, Queryable } from "./db.js";
import { queueEmail } from "./email.js";
import { DomainError, isUniqueViolation, requiredEmail, requiredText, requiredUuid, sha256Hex } from "./validation.js";

type Row = Record<string, unknown>;

export const CAPABILITIES = ["buyer", "supplier", "warehouse", "carrier"] as const;
export type Capability = (typeof CAPABILITIES)[number];
const STATUSES = ["draft", "submitted", "approved", "rejected"] as const;
/** Statuses in which the owner may still edit and (re)submit business details. */
const EDITABLE = new Set(["draft", "rejected"]);
const CIPC_NUMBER = /^\d{4}\/\d{6}\/\d{2}$/;
const VAT_NUMBER = /^4\d{9}$/;
const INVITE_DAYS = 7;
const ORG_COLUMNS = `o.id,o.legal_name,o.registration_number,o.vat_number,o.capabilities,o.status,
  o.rejection_reason,o.submitted_at,o.reviewed_at,o.created_at`;

function businessDetails(body: Record<string, unknown>, partial: boolean) {
  const details: { legal_name?: string; registration_number?: string; vat_number?: string | null;
    capabilities?: Capability[] } = {};
  if (!partial || body.legalName !== undefined) {
    details.legal_name = requiredText(body.legalName, "Legal name", 2, 200);
  }
  if (!partial || body.registrationNumber !== undefined) {
    if (typeof body.registrationNumber !== "string" || !CIPC_NUMBER.test(body.registrationNumber.trim())) {
      throw new DomainError("CIPC registration number must look like 2019/123456/07");
    }
    details.registration_number = body.registrationNumber.trim();
  }
  if (body.vatNumber !== undefined && body.vatNumber !== null && body.vatNumber !== "") {
    if (typeof body.vatNumber !== "string" || !VAT_NUMBER.test(body.vatNumber.trim())) {
      throw new DomainError("VAT number must be 10 digits starting with 4");
    }
    details.vat_number = body.vatNumber.trim();
  } else if (!partial || body.vatNumber !== undefined) {
    details.vat_number = null;
  }
  if (!partial || body.capabilities !== undefined) {
    const raw = body.capabilities;
    if (!Array.isArray(raw) || raw.length < 1
      || raw.some(c => !CAPABILITIES.includes(c as Capability)) || new Set(raw).size !== raw.length) {
      throw new DomainError(`Capabilities must be one or more of ${CAPABILITIES.join(", ")}`);
    }
    details.capabilities = CAPABILITIES.filter(c => raw.includes(c));
  }
  return details;
}

const hashToken = sha256Hex;

/** Platform staff check shared by every admin route. */
export async function requireAdmin(db: Queryable, userId: string): Promise<void> {
  const role = (await db.query<Row>("select role from profiles where id=$1", [userId])).rows[0]?.role;
  if (role !== "admin") throw new DomainError("Admin role required", 403);
}

/** Rethrows a duplicate CIPC number as a 409 instead of a server error. */
async function rejectDuplicateCipc<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError("A business with this CIPC number is already registered", 409);
    throw error;
  }
}

/**
 * Checks in one query that each user belongs to an approved organization with
 * the paired capability. A capability is trading authorization: profile roles
 * and unapproved organizations never satisfy it. Returns the first missing
 * capability, or null.
 */
export async function missingCapability(db: Queryable, required: ReadonlyArray<readonly [string, Capability]>) {
  const result = await db.query<{ user_id: string; capability: string }>(
    `select distinct p.user_id::text as user_id, p.capability
     from unnest($1::uuid[], $2::text[]) as p(user_id, capability)
     join organization_members m on m.user_id=p.user_id
     join organizations o on o.id=m.organization_id and o.status='approved' and p.capability = any(o.capabilities)`,
    [required.map(([userId]) => userId), required.map(([, capability]) => capability)],
  );
  const met = new Set(result.rows.map(r => `${r.user_id}:${r.capability}`));
  return required.find(([userId, capability]) => !met.has(`${userId}:${capability}`))?.[1] ?? null;
}

/**
 * LOCAL DEMO only: makes sure `userId` belongs to an approved business with `capability`, creating
 * an approved "Demo business" (all capabilities, a made-up CIPC number) when it has none. Used
 * instead of an admin review so the one-command demo can trade straight after sign-in.
 */
export async function ensureDemoCapability(db: Queryable, userId: string, capability: Capability) {
  if (!(await missingCapability(db, [[userId, capability]]))) return;
  const id = randomUUID();
  const cipc = `2026/${String(randomBytes(4).readUInt32BE() % 1_000_000).padStart(6, "0")}/07`;
  const email = (await db.query<Row>("select email from profiles where id=$1", [userId])).rows[0]?.email;
  await db.query(
    `insert into organizations (id,legal_name,registration_number,capabilities,status,created_by,submitted_at,reviewed_at)
     values ($1,$2,$3,$4,'approved',$5,now(),now())`,
    [id, `Demo business (${String(email ?? "demo user")})`, cipc, [...CAPABILITIES], userId],
  );
  await db.query("insert into organization_members (organization_id,user_id,member_role) values ($1,$2,'owner')",
    [id, userId]);
}

export class OnboardingService {
  constructor(private readonly db: Database, private readonly publicOrigin: string,
    /** LOCAL DEMO: a submitted business is approved at once instead of waiting for an admin. */
    private readonly demoAutoApprove = false) {}

  private async profile(db: Queryable, userId: string): Promise<Row> {
    const result = await db.query<Row>("select id,email,full_name,role from profiles where id=$1", [userId]);
    if (!result.rows[0]) throw new DomainError("Profile not found", 404);
    return result.rows[0];
  }

  private requireAdmin(userId: string) { return requireAdmin(this.db, userId); }

  /** The caller's view of one organization. Non-members get 404 so existence is not revealed. */
  private async membership(db: Queryable, userId: string, orgIdInput: unknown, lock = false): Promise<Row> {
    const orgId = requiredUuid(orgIdInput, "organization ID");
    const result = await db.query<Row>(
      `select ${ORG_COLUMNS},m.member_role from organizations o
       join organization_members m on m.organization_id=o.id and m.user_id=$2
       where o.id=$1${lock ? " for update of o" : ""}`, [orgId, userId],
    );
    if (!result.rows[0]) throw new DomainError("Organization not found", 404);
    return result.rows[0];
  }

  private async requireManager(db: Queryable, userId: string, orgId: unknown, lock = false) {
    const org = await this.membership(db, userId, orgId, lock);
    if (org.member_role !== "owner" && org.member_role !== "admin") {
      throw new DomainError("Organization owner or admin required", 403);
    }
    return org;
  }

  async state(userId: string) {
    const profile = await this.profile(this.db, userId);
    const organizations = (await this.db.query<Row>(
      `select ${ORG_COLUMNS},m.member_role from organizations o
       join organization_members m on m.organization_id=o.id
       where m.user_id=$1 order by o.created_at`, [userId],
    )).rows;
    const has = (status: string) => organizations.some(o => o.status === status);
    const nextStep = organizations.length === 0 ? "create_organization"
      : has("approved") ? "ready"
      : has("submitted") ? "awaiting_review"
      : has("rejected") ? "fix_and_resubmit"
      : "submit_for_review";
    return { profile, organizations, nextStep };
  }

  async create(userId: string, body: Record<string, unknown>) {
    const details = businessDetails(body, false);
    const id = randomUUID();
    await rejectDuplicateCipc(() => this.db.transaction(async db => {
      await db.query(
        `insert into organizations (id,legal_name,registration_number,vat_number,capabilities,created_by)
         values ($1,$2,$3,$4,$5,$6)`,
        [id, details.legal_name, details.registration_number, details.vat_number, details.capabilities, userId],
      );
      await db.query(
        "insert into organization_members (organization_id,user_id,member_role) values ($1,$2,'owner')",
        [id, userId],
      );
    }));
    return this.membership(this.db, userId, id);
  }

  async update(userId: string, orgId: unknown, body: Record<string, unknown>) {
    const details = businessDetails(body, true);
    const columns = Object.keys(details) as (keyof typeof details)[];
    if (columns.length === 0) throw new DomainError("Nothing to update");
    return rejectDuplicateCipc(() => this.db.transaction(async db => {
      const org = await this.requireManager(db, userId, orgId, true);
      if (!EDITABLE.has(String(org.status))) {
        throw new DomainError("Business details are locked while under review or once approved", 409);
      }
      await db.query(
        `update organizations set ${columns.map((c, i) => `${c}=$${i + 2}`).join(",")},updated_at=now()
         where id=$1`, [org.id, ...columns.map(c => details[c])],
      );
      return this.membership(db, userId, org.id);
    }));
  }

  async submit(userId: string, orgId: unknown) {
    return this.db.transaction(async db => {
      const org = await this.requireManager(db, userId, orgId, true);
      if (!EDITABLE.has(String(org.status))) {
        throw new DomainError("Only a draft or rejected business can be submitted", 409);
      }
      await db.query(
        `update organizations set status=$2,submitted_at=now(),rejection_reason=null,
         reviewed_by=null,reviewed_at=${this.demoAutoApprove ? "now()" : "null"},updated_at=now() where id=$1`,
        [org.id, this.demoAutoApprove ? "approved" : "submitted"],
      );
      const submitter = await this.profile(db, userId);
      await queueEmail(db, String(submitter.email), "organization_submitted",
        { organizationId: org.id, legalName: org.legal_name });
      return this.membership(db, userId, org.id);
    });
  }

  async listForReview(adminId: string, statusInput: unknown) {
    await this.requireAdmin(adminId);
    const status = statusInput ?? "submitted";
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) throw new DomainError("Invalid status");
    const result = await this.db.query<Row>(
      `select ${ORG_COLUMNS} from organizations o where o.status=$1
       order by o.submitted_at nulls last, o.created_at limit 100`, [status],
    );
    return result.rows;
  }

  async review(adminId: string, orgIdInput: unknown, decision: unknown, reasonInput: unknown) {
    await this.requireAdmin(adminId);
    const orgId = requiredUuid(orgIdInput, "organization ID");
    if (decision !== "approve" && decision !== "reject") throw new DomainError("Decision must be approve or reject");
    const reason = decision === "reject" ? requiredText(reasonInput, "Rejection reason", 10, 500) : null;
    return this.db.transaction(async db => {
      const result = await db.query<Row>(
        `update organizations set status=$2,rejection_reason=$3,reviewed_by=$4,reviewed_at=now(),updated_at=now()
         where id=$1 and status='submitted' returning id,legal_name,status,rejection_reason,reviewed_at`,
        [orgId, decision === "approve" ? "approved" : "rejected", reason, adminId],
      );
      const org = result.rows[0];
      if (!org) throw new DomainError("No business awaiting review with this ID", 409);
      // One email per owner, queued in a single statement.
      await db.query(
        `insert into email_outbox (id,to_email,template,payload)
         select gen_random_uuid(), p.email, $2, $3::jsonb from organization_members m
         join profiles p on p.id=m.user_id where m.organization_id=$1 and m.member_role='owner'`,
        [orgId, decision === "approve" ? "organization_approved" : "organization_rejected",
          JSON.stringify({ organizationId: orgId, legalName: org.legal_name, ...(reason ? { reason } : {}) })],
      );
      return org;
    });
  }

  async invite(userId: string, orgId: unknown, emailInput: unknown, roleInput: unknown) {
    const email = requiredEmail(emailInput);
    if (roleInput !== "admin" && roleInput !== "member") throw new DomainError("Member role must be admin or member");
    const token = randomBytes(32).toString("base64url");
    return this.db.transaction(async db => {
      const org = await this.requireManager(db, userId, orgId);
      const result = await db.query<Row>(
        `insert into invitations (id,organization_id,email,member_role,token_hash,invited_by,expires_at)
         values ($1,$2,$3,$4,$5,$6,now() + make_interval(days => $7))
         returning id,organization_id,email,member_role,expires_at,created_at`,
        [randomUUID(), org.id, email, roleInput, hashToken(token), userId, INVITE_DAYS],
      );
      const acceptUrl = new URL("/invite", this.publicOrigin);
      acceptUrl.searchParams.set("token", token);
      await queueEmail(db, email, "member_invited", {
        organizationId: org.id, legalName: org.legal_name, memberRole: roleInput,
        acceptUrl: acceptUrl.toString(),
      });
      return result.rows[0];
    });
  }

  async accept(userId: string, tokenInput: unknown) {
    if (typeof tokenInput !== "string" || tokenInput.length < 20 || tokenInput.length > 200) {
      throw new DomainError("Invitation token required");
    }
    return this.db.transaction(async db => {
      const invitation = (await db.query<Row>(
        "select * from invitations where token_hash=$1 for update", [hashToken(tokenInput)],
      )).rows[0];
      if (!invitation) throw new DomainError("Invitation not found", 404);
      const me = await this.profile(db, userId);
      if (String(me.email).toLowerCase() !== invitation.email) {
        throw new DomainError("This invitation was sent to a different email address", 403);
      }
      if (invitation.accepted_at) throw new DomainError("Invitation already used", 409);
      if (new Date(String(invitation.expires_at)).getTime() <= Date.now()) {
        throw new DomainError("Invitation expired", 409);
      }
      // An existing member keeps their current role; the invite never downgrades or replaces it.
      await db.query(
        `insert into organization_members (organization_id,user_id,member_role) values ($1,$2,$3)
         on conflict (organization_id,user_id) do nothing`,
        [invitation.organization_id, userId, invitation.member_role],
      );
      await db.query("update invitations set accepted_by=$2,accepted_at=now() where id=$1",
        [invitation.id, userId]);
      return this.membership(db, userId, invitation.organization_id);
    });
  }
}
