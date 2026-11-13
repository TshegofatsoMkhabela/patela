import type { Database } from "./db.js";

export type MailMessage = { to: string; subject: string; text: string };

export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

type Payload = Record<string, unknown>;
const MAX_ATTEMPTS = 3;
const BATCH = 20;

const str = (value: unknown) => (typeof value === "string" ? value : "");

/** Plain-text bodies for every template the backend queues. */
export function renderEmail(template: string, payload: Payload): { subject: string; text: string } {
  const link = str(payload.acceptUrl);
  switch (template) {
    case "order_supplier_invited":
    case "order_driver_invited": {
      const role = template === "order_supplier_invited" ? "supplier" : "driver";
      return {
        subject: `Patela: you're invited as the ${role} on an order`,
        text: [`You've been invited to a Patela order as the ${role}.`, "",
          payload.agreementText ? `Agreement: ${str(payload.agreementText)}` : "",
          "", `Open this link to review and accept (it works once):`, link, "",
          "Patela demo on Base Sepolia test tokens — no real money moves."].join("\n"),
      };
    }
    case "login_otp":
      return { subject: "Your Patela sign-in code",
        text: `Your Patela sign-in code is ${str(payload.code)}. It expires in 10 minutes.\n\n`
          + "If you didn't ask for it, ignore this email." };
    case "member_invited":
      return { subject: `Patela: join ${str(payload.legalName)}`,
        text: `You've been invited to join ${str(payload.legalName)} on Patela.\n\n${link}` };
    case "organization_approved":
      return { subject: "Patela: your business is approved",
        text: `${str(payload.legalName)} is approved on Patela and can now trade.` };
    case "organization_rejected":
      return { subject: "Patela: your business needs changes",
        text: `${str(payload.legalName)} was not approved: ${str(payload.reason)}` };
    default:
      return { subject: "Patela notification", text: JSON.stringify(payload) };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Mail send timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Delivers queued email_outbox rows. Routes await `flush` before responding because a Lambda
 * freezes once it has replied; a failed send leaves the row pending for the next flush, and a
 * row that fails MAX_ATTEMPTS times is marked failed and left for an admin to look at.
 */
export class OutboxMailer {
  constructor(
    private readonly db: Database,
    private readonly transport: MailTransport | undefined,
    private readonly timeoutMs = 5_000,
  ) {}

  get enabled() { return Boolean(this.transport); }

  async flush(): Promise<void> {
    if (!this.transport) return;
    const rows = (await this.db.query<{ id: string; to_email: string; template: string; payload: Payload }>(
      `select id,to_email,template,payload from email_outbox where status='pending'
       order by created_at, id limit ${BATCH}`,
    )).rows;
    for (const row of rows) {
      // Counts the attempt before sending. Two flushes running at the same moment can still both
      // send one row (a duplicate email, never a lost one); acceptable for the demo's traffic.
      const claimed = await this.db.query(
        "update email_outbox set attempts=attempts+1 where id=$1 and status='pending' returning attempts", [row.id]);
      const attempts = Number(claimed.rows[0]?.attempts);
      if (!attempts) continue;
      try {
        await withTimeout(this.transport.send({ to: row.to_email, ...renderEmail(row.template, row.payload) }),
          this.timeoutMs);
        await this.db.query("update email_outbox set status='sent',sent_at=now(),last_error=null where id=$1",
          [row.id]);
      } catch (error) {
        await this.db.query("update email_outbox set status=$2,last_error=$3 where id=$1", [row.id,
          attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          (error instanceof Error ? error.message : String(error)).slice(0, 500)]);
      }
    }
  }
}
