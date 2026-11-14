import { randomBytes, randomUUID } from "node:crypto";
import { isHex, keccak256, parseUnits, toBytes, zeroAddress, type Address, type Hex } from "viem";
import type { ChainEvent, ChainVerifier } from "./chain.js";
import type { Database, Queryable } from "./db.js";
import type { InvoiceDetails } from "./email-html.js";
import { queueEmail } from "./email.js";
import { demoApproves, ensureDemoCapability, missingCapability, requireAdmin, type DemoApproval } from "./onboarding.js";
import {
  DomainError, isUniqueViolation, requiredAddress, requiredBytes32, requiredEmail, requiredText, requiredTx,
  requiredUuid, sameAddress, sha256Hex,
} from "./validation.js";

// Two-handoff demo orders (specs/INTERFACES.md §1, §4). The chain is the source of truth for money:
// every status change past `awaiting_chain` happens only when a confirmed escrow event matches the order.

type Row = Record<string, unknown>;
type Party = "buyer" | "supplier" | "driver";
/** Order lifecycle, in order. Must match the orders_status_check list in migrations/004. */
export type OrderStatus = "awaiting_supplier" | "awaiting_chain" | "awaiting_funding" | "funded" | "accepted"
  | "driver_assigned" | "in_progress" | "delivered" | "refunded";
type EventCheck = (event: ChainEvent, order: Row) => boolean;
export type Evidence = { lat: number; lng: number; accuracyM: number; capturedAt: number; role: "giver" | "receiver" };

const INVITE_DAYS = 7;
const MAX_QR_SECONDS = 300;
const MAX_EVIDENCE_AGE_SECONDS = MAX_QR_SECONDS;
const MAX_EVIDENCE_FUTURE_SKEW_SECONDS = 30;
const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;
const UINT256 = /^[1-9]\d{0,77}$/;
const DISPUTABLE: readonly OrderStatus[] = ["funded", "accepted", "driver_assigned", "in_progress"];
/** Who may see an order: platform admins and the order's participants. $1 is the order alias's user ID. */
const VISIBLE = (userParam: string) => `((select role from profiles where id=${userParam})='admin'
  or exists (select 1 from order_participants p where p.order_id=o.id and p.user_id=${userParam}))`;
/** Who gives and receives at each stage, and the order status the stage starts from and moves to. */
const STAGES = {
  1: { giver: "supplier", receiver: "driver", from: "driver_assigned", to: "in_progress" },
  2: { giver: "driver", receiver: "buyer", from: "in_progress", to: "delivered" },
} as const satisfies Record<number, { giver: Party; receiver: Party; from: OrderStatus; to: OrderStatus }>;

const hashToken = sha256Hex;
const wei = (value: unknown) => BigInt(String(value ?? 0));
const walletOf = (order: Row, party: Party) => order[`${party}_wallet_address`] as string | null;
const idOf = (order: Row, party: Party) => order[`${party}_id`] as string | null;

function requiredStage(value: unknown): 1 | 2 {
  const stage = Number(value);
  if (stage !== 1 && stage !== 2) throw new DomainError("Stage must be 1 (pickup) or 2 (delivery)");
  return stage;
}

function requiredEvidence(value: unknown, role: Evidence["role"], requireFresh = false): Evidence {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const [lat, lng, accuracyM, capturedAt] = [raw.lat, raw.lng, raw.accuracyM, raw.capturedAt].map(Number);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180
    || !Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 100_000
    || !Number.isInteger(capturedAt) || capturedAt < 1_600_000_000 || raw.role !== role) {
    throw new DomainError(`Valid ${role} location evidence required`);
  }
  const now = Math.floor(Date.now() / 1000);
  if (requireFresh && (capturedAt < now - MAX_EVIDENCE_AGE_SECONDS
    || capturedAt > now + MAX_EVIDENCE_FUTURE_SKEW_SECONDS)) {
    throw new DomainError(`${role} location evidence must be freshly captured`);
  }
  return { lat, lng, accuracyM, capturedAt, role };
}

/**
 * INTERFACES.md §3: keccak256 of the JSON array [giverEvidence, receiverEvidence]. Each object is rebuilt
 * in the frozen key order, so the hash never depends on how JSON or jsonb ordered the keys.
 */
export function evidenceHash(giver: Evidence, receiver: Evidence): Hex {
  const canonical = ({ lat, lng, accuracyM, capturedAt, role }: Evidence) => ({ lat, lng, accuracyM, capturedAt, role });
  return keccak256(toBytes(JSON.stringify([canonical(giver), canonical(receiver)])));
}

export type OrderServiceOptions = {
  db: Database; chain?: ChainVerifier; escrowAddress: Address; chainId: number; tokenAddress: Address;
  tokenDecimals: number; publicOrigin: string;
  /** DEMO: also return one-time accept links in responses. */
  demoMode?: boolean;
  /** DEMO: users without an approved business get an approved demo business at the trading gates. */
  demoAutoApprove?: DemoApproval;
};

/** Queued emails are sent by the app's onSend hook (app.ts), not here. */
export class OrderService {
  private readonly db: Database;
  private readonly chain?: ChainVerifier;
  private readonly escrowAddress: Address;
  private readonly chainId: number;
  private readonly tokenAddress: Address;
  private readonly tokenDecimals: number;
  private readonly publicOrigin: string;
  private readonly demoMode: boolean;
  private readonly demoAutoApprove: DemoApproval;

  constructor(options: OrderServiceOptions) {
    ({ db: this.db, chain: this.chain, escrowAddress: this.escrowAddress, chainId: this.chainId,
      tokenAddress: this.tokenAddress, tokenDecimals: this.tokenDecimals, publicOrigin: this.publicOrigin } = options);
    this.demoMode = options.demoMode ?? false;
    this.demoAutoApprove = options.demoAutoApprove ?? false;
  }

  private zarp(value: unknown, label: string): bigint {
    if (typeof value !== "string" || !AMOUNT.test(value)) {
      throw new DomainError(`${label} must be a ZARP amount with at most two decimals`);
    }
    return parseUnits(value, this.tokenDecimals);
  }

  private demoLink(acceptUrl: string) {
    return this.demoMode ? { acceptUrl, demo: true } : {};
  }

  private async invite(db: Queryable, orderId: string, role: "supplier" | "driver", email: string,
    invitedBy: string, agreementText?: string) {
    const token = randomBytes(32).toString("base64url");
    await db.query(
      `insert into order_invitations (id,order_id,role,email,token_hash,invited_by,expires_at)
       values ($1,$2,$3,$4,$5,$6,now() + make_interval(days => $7))`,
      [randomUUID(), orderId, role, email, hashToken(token), invitedBy, INVITE_DAYS],
    );
    const acceptUrl = new URL("/accept", this.publicOrigin);
    acceptUrl.searchParams.set("token", token);
    await queueEmail(db, email, role === "supplier" ? "order_supplier_invited" : "order_driver_invited",
      { orderId, acceptUrl: acceptUrl.toString(), invoice: await this.invoiceFor(db, orderId),
        ...(agreementText ? { agreementText } : {}) });
    return acceptUrl.toString();
  }

  /** The invoice an invite email shows, read from the stored order so it always matches it. */
  private async invoiceFor(db: Queryable, orderId: string): Promise<InvoiceDetails> {
    const row = (await db.query<Row>(
      `select o.amount_wei,o.driver_at_pickup_wei,o.supplier_at_pickup_wei,o.supplier_at_delivery_wei,
        o.chain_id,o.token_address,o.agreement_hash,o.refund_deadline,p.email buyer_email
       from orders o join profiles p on p.id=o.buyer_id where o.id=$1`, [orderId])).rows[0];
    return {
      orderId, buyerEmail: String(row.buyer_email), totalWei: String(row.amount_wei),
      driverAtPickupWei: String(row.driver_at_pickup_wei), supplierAtPickupWei: String(row.supplier_at_pickup_wei),
      supplierAtDeliveryWei: String(row.supplier_at_delivery_wei), chainId: Number(row.chain_id),
      tokenAddress: String(row.token_address), escrowAddress: this.escrowAddress.toLowerCase(),
      agreementHash: String(row.agreement_hash), refundDeadline: new Date(String(row.refund_deadline)).toISOString(),
    };
  }

  async createOrder(userId: string, body: Record<string, unknown>) {
    const supplierEmail = requiredEmail(body.supplierEmail);
    const total = this.zarp(body.totalZarp, "Total");
    const driverAtPickup = this.zarp(body.driverAtPickupZarp, "Driver pickup payment");
    const supplierAtPickup = this.zarp(body.supplierAtPickupZarp, "Supplier pickup payment");
    const supplierAtDelivery = this.zarp(body.supplierAtDeliveryZarp, "Supplier delivery payment");
    if (total <= 0n) throw new DomainError("Total must be positive");
    if (driverAtPickup + supplierAtPickup + supplierAtDelivery !== total) {
      throw new DomainError("The three payments must add up to the total");
    }
    const refundHours = Number(body.refundAfterHours ?? 48);
    if (!Number.isInteger(refundHours) || refundHours < 1 || refundHours > 24 * 30) {
      throw new DomainError("Refund deadline must be 1 to 720 hours");
    }
    const agreementText = requiredText(body.agreementText, "Agreement text", 10, 5000);
    const agreementHash = keccak256(toBytes(agreementText));
    const buyer = (await this.db.query<Row>("select email,wallet_address from profiles where id=$1", [userId])).rows[0];
    if (!buyer?.wallet_address) throw new DomainError("Link your wallet before ordering", 409);
    if (supplierEmail === buyer.email) throw new DomainError("The supplier must be someone else");
    if (demoApproves(this.demoAutoApprove, buyer.email)) await ensureDemoCapability(this.db, userId, "buyer");
    if (await missingCapability(this.db, [[userId, "buyer"]])) {
      throw new DomainError("Your business must be approved as a buyer before ordering", 403);
    }
    const id = randomUUID();
    const refundDeadline = new Date(Date.now() + refundHours * 3_600_000).toISOString();
    const acceptUrl = await this.db.transaction(async db => {
      await db.query(
        `insert into orders (id,buyer_id,buyer_wallet_address,amount_wei,token_address,chain_id,status,
          refund_deadline,supplier_email,driver_at_pickup_wei,supplier_at_pickup_wei,supplier_at_delivery_wei,
          agreement_text,agreement_hash)
         values ($1,$2,$3,$4,$5,$6,'awaiting_supplier',$7,$8,$9,$10,$11,$12,$13)`,
        [id, userId, buyer.wallet_address, total.toString(), this.tokenAddress.toLowerCase(), this.chainId,
          refundDeadline, supplierEmail, driverAtPickup.toString(), supplierAtPickup.toString(),
          supplierAtDelivery.toString(), agreementText, agreementHash],
      );
      await db.query("insert into order_participants (order_id,user_id) values ($1,$2)", [id, userId]);
      return this.invite(db, id, "supplier", supplierEmail, userId, agreementText);
    });
    return { id, agreementHash, refundDeadline, ...this.demoLink(acceptUrl) };
  }

  private async invitationByToken(db: Queryable, token: unknown, lock = false) {
    if (typeof token !== "string" || token.length < 20 || token.length > 200) {
      throw new DomainError("Invitation token required");
    }
    const invitation = (await db.query<Row>(
      `select i.*, o.agreement_text, o.agreement_hash from order_invitations i
       join orders o on o.id=i.order_id where i.token_hash=$1${lock ? " for update of i" : ""}`,
      [hashToken(token)],
    )).rows[0];
    if (!invitation) throw new DomainError("Invitation not found", 404);
    if (invitation.accepted_at) throw new DomainError("This invitation was already used", 409);
    if (new Date(String(invitation.expires_at)).getTime() <= Date.now()) {
      throw new DomainError("This invitation has expired", 409);
    }
    return invitation;
  }

  /** Public: the accept page shows the agreement before the invitee signs in. */
  async invitation(token: unknown) {
    const i = await this.invitationByToken(this.db, token);
    return { orderId: i.order_id, role: i.role, email: i.email,
      agreementText: i.agreement_text, agreementHash: i.agreement_hash };
  }

  async acceptInvitation(userId: string, token: unknown, walletInput: unknown) {
    const wallet = requiredAddress(walletInput).toLowerCase();
    const orderId = await this.db.transaction(async db => {
      const invitation = await this.invitationByToken(db, token, true);
      const me = (await db.query<Row>("select email,wallet_address from profiles where id=$1", [userId])).rows[0];
      if (String(me?.email).toLowerCase() !== invitation.email) {
        throw new DomainError("This invitation was sent to a different email address", 403);
      }
      if (!sameAddress(me.wallet_address, wallet)) throw new DomainError("Link this wallet to your account first", 409);
      const order = (await db.query<Row>("select * from orders where id=$1 for update", [invitation.order_id])).rows[0];
      const role = invitation.role as "supplier" | "driver";
      const capability = role === "supplier" ? "supplier" : "carrier";
      if (demoApproves(this.demoAutoApprove, me?.email)) await ensureDemoCapability(db, userId, capability);
      if (await missingCapability(db, [[userId, capability]])) {
        throw new DomainError(`Your business must be approved as a ${capability} before accepting this order`, 403);
      }
      const taken = [order.buyer_wallet_address, order.supplier_wallet_address].some(w => sameAddress(w, wallet));
      if (taken) throw new DomainError(`The ${role} needs a wallet of their own`, 409);
      const ready = role === "supplier" ? order.status === "awaiting_supplier"
        : order.status === "accepted" && !order.driver_id;
      if (!ready) throw new DomainError(`This order is not waiting for a ${role}`, 409);
      await db.query(
        `update orders set ${role}_id=$2, ${role}_wallet_address=$3,
         status=case when $4 then 'awaiting_chain' else status end, updated_at=now() where id=$1`,
        [order.id, userId, wallet, role === "supplier"],
      );
      await db.query("insert into order_participants (order_id,user_id) values ($1,$2) on conflict do nothing",
        [order.id, userId]);
      await db.query("update order_invitations set accepted_by=$2, accepted_at=now() where id=$1",
        [invitation.id, userId]);
      return String(order.id);
    });
    return this.render((await this.db.query<Row>("select * from orders where id=$1", [orderId])).rows[0]);
  }

  async inviteDriver(userId: string, orderIdInput: unknown, emailInput: unknown) {
    const email = requiredEmail(emailInput);
    const order = await this.participantOrder(userId, orderIdInput);
    this.requireParty(order, userId, ["supplier"]);
    if (order.status !== "accepted" || order.driver_id) {
      throw new DomainError("Invite a driver after accepting the order on chain, and only once", 409);
    }
    const acceptUrl = await this.db.transaction(db => this.invite(db, String(order.id), "driver", email, userId));
    return { invited: true, ...this.demoLink(acceptUrl) };
  }

  private async participantOrder(userId: string, orderIdInput: unknown): Promise<Row> {
    const orderId = requiredUuid(orderIdInput, "order ID");
    const order = (await this.db.query<Row>(
      `select o.* from orders o where o.id=$1 and ${VISIBLE("$2")}`, [orderId, userId],
    )).rows[0];
    if (!order) throw new DomainError("Order not found", 404);
    return order;
  }

  /** Checks access only (used by the route and voice tools). */
  async requireParticipant(userId: string, orderId: unknown) { await this.participantOrder(userId, orderId); }

  private requireParty(order: Row, userId: string, parties: readonly Party[]) {
    if (!parties.some(p => idOf(order, p) === userId)) {
      throw new DomainError(`Only the ${parties.join(" or ")} can do this`, 403);
    }
  }

  private async receipt(txHashInput: unknown): Promise<ChainEvent[]> {
    const txHash = requiredTx(txHashInput);
    if (!this.chain || sameAddress(this.escrowAddress, zeroAddress)) {
      throw new DomainError("Escrow contract is not configured", 503);
    }
    try { return await this.chain.events(txHash); }
    catch (error) { throw new DomainError(error instanceof Error ? error.message : "Chain verification failed", 409); }
  }

  /**
   * Moves an order from one status to the next when a confirmed transaction holds every expected
   * escrow event (`expect` builds the checks from the loaded order; each check needs its own event).
   * Re-sending an already-recorded transaction returns the order unchanged, so a retry is harmless.
   */
  private async advance(userId: string, orderIdInput: unknown, txHashInput: unknown, step: {
    who: readonly Party[]; from: readonly OrderStatus[]; to: OrderStatus;
    expect: (order: Row) => EventCheck[] | Promise<EventCheck[]>;
    chainOrderId?: bigint; stagesDone?: 1 | 2;
  }) {
    const order = await this.participantOrder(userId, orderIdInput);
    this.requireParty(order, userId, step.who);
    const txHash = requiredTx(txHashInput).toLowerCase();
    const recorded = async (db: Queryable) => Boolean((await db.query(
      "select 1 from chain_events where order_id=$1 and tx_hash=$2 limit 1", [order.id, txHash])).rows[0]);
    if (!step.from.includes(order.status as OrderStatus)) {
      if (await recorded(this.db)) return this.render(order);
      throw new DomainError(`Order is ${order.status}, not ${step.from.join(" or ")}`, 409);
    }
    const chainOrderId = step.chainOrderId ?? (order.chain_order_id ? BigInt(String(order.chain_order_id)) : null);
    if (chainOrderId === null) throw new DomainError("Order is not on chain yet", 409);
    const events = (await this.receipt(txHash))
      .filter(e => e.chainId === this.chainId && e.orderId === chainOrderId);
    const used = new Set<number>();
    for (const matches of await step.expect(order)) {
      const index = events.findIndex((e, i) => !used.has(i) && matches(e, order));
      if (index < 0) throw new DomainError("The transaction does not contain the expected escrow event for this order", 409);
      used.add(index);
    }
    try {
      await this.db.transaction(async db => {
        const locked = (await db.query<Row>("select status from orders where id=$1 for update", [order.id])).rows[0];
        if (!step.from.includes(locked.status as OrderStatus)) {
          if (await recorded(db)) return;
          throw new DomainError(`Order is ${locked.status}, not ${step.from.join(" or ")}`, 409);
        }
        for (const e of events) {
          await db.query(
            `insert into chain_events (chain_id,tx_hash,log_index,order_id,event_name,stage_index,amount_wei,
              block_number,block_hash) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing`,
            [e.chainId, e.txHash.toLowerCase(), e.logIndex, order.id, e.name, e.stage ?? null,
              (e.amountWei ?? 0n).toString(), e.blockNumber.toString(), e.blockHash],
          );
        }
        await db.query(`update orders set status=$2, chain_order_id=coalesce(chain_order_id,$3),
          stages_done=coalesce($4,stages_done), updated_at=now() where id=$1`,
        [order.id, step.to, chainOrderId.toString(), step.stagesDone ?? null]);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new DomainError("That on-chain order is already linked to another order", 409);
      throw error;
    }
    // Access was checked above, so the fresh row is rendered without repeating it.
    return this.render((await this.db.query<Row>("select * from orders where id=$1", [order.id])).rows[0]);
  }

  linkChain(userId: string, orderId: unknown, chainOrderIdInput: unknown, createTxHash: unknown) {
    if (typeof chainOrderIdInput !== "string" || !UINT256.test(chainOrderIdInput)) {
      throw new DomainError("On-chain order ID must be a positive integer string");
    }
    return this.advance(userId, orderId, createTxHash, {
      who: ["buyer"], from: ["awaiting_chain"], to: "awaiting_funding", chainOrderId: BigInt(chainOrderIdInput),
      expect: () => [(e, o) => e.name === "OrderCreated" && e.amountWei === wei(o.amount_wei)
        && sameAddress(e.buyer, o.buyer_wallet_address) && sameAddress(e.supplier, o.supplier_wallet_address)
        && e.agreementHash?.toLowerCase() === String(o.agreement_hash).toLowerCase()],
    });
  }

  verifyFunding(userId: string, orderId: unknown, txHash: unknown) {
    return this.advance(userId, orderId, txHash, {
      who: ["buyer"], from: ["awaiting_funding"], to: "funded",
      expect: () => [(e, o) => e.name === "EscrowFunded" && e.amountWei === wei(o.amount_wei)],
    });
  }

  verifyAcceptance(userId: string, orderId: unknown, txHash: unknown) {
    return this.advance(userId, orderId, txHash, {
      who: ["supplier", "buyer"], from: ["funded"], to: "accepted",
      expect: () => [(e, o) => e.name === "OrderAccepted" && sameAddress(e.supplier, o.supplier_wallet_address)
        && e.agreementHash?.toLowerCase() === String(o.agreement_hash).toLowerCase()],
    });
  }

  verifyDriver(userId: string, orderId: unknown, txHash: unknown) {
    return this.advance(userId, orderId, txHash, {
      who: ["supplier"], from: ["accepted"], to: "driver_assigned",
      expect: () => [(e, o) => e.name === "DriverAssigned" && Boolean(o.driver_wallet_address)
        && sameAddress(e.driver, o.driver_wallet_address)],
    });
  }

  verifyHandoff(userId: string, orderId: unknown, stageInput: unknown, txHash: unknown) {
    const stage = requiredStage(stageInput);
    const { giver, receiver, from, to } = STAGES[stage];
    const payments: ReadonlyArray<readonly [Party, string]> = stage === 1
      ? [["driver", "driver_at_pickup_wei"], ["supplier", "supplier_at_pickup_wei"]]
      : [["supplier", "supplier_at_delivery_wei"]];
    return this.advance(userId, orderId, txHash, {
      who: [giver, receiver], from: [from], to, stagesDone: stage,
      expect: async order => {
        const hashes = new Set((await this.db.query<Row>(
          `select lower(evidence_hash) as h from handoff_sessions
           where order_id=$1 and stage=$2 and evidence_hash is not null`, [order.id, stage],
        )).rows.map(r => String(r.h)));
        return [
          (e, o) => e.name === "HandoffVerified" && e.stage === stage && sameAddress(e.giver, walletOf(o, giver))
            && sameAddress(e.receiver, walletOf(o, receiver)) && hashes.has(String(e.evidenceHash).toLowerCase()),
          // A zero split moves no tokens, so the contract need not log a payment for it.
          ...payments.filter(([, column]) => wei(order[column]) > 0n).map(([party, column]): EventCheck =>
            (e, o) => e.name === "PaymentReleased" && e.stage === stage
              && sameAddress(e.recipient, walletOf(o, party)) && e.amountWei === wei(o[column])),
        ];
      },
    });
  }

  verifyRefund(userId: string, orderId: unknown, txHash: unknown) {
    return this.advance(userId, orderId, txHash, {
      who: ["buyer"], from: DISPUTABLE, to: "refunded",
      expect: async order => {
        const released = (await this.db.query<Row>(
          "select coalesce(sum(amount_wei),0) as paid from chain_events where order_id=$1 and event_name='PaymentReleased'",
          [order.id],
        )).rows[0].paid;
        return [(e, o) => e.name === "OrderRefunded" && sameAddress(e.buyer, o.buyer_wallet_address)
          && e.amountWei === wei(o.amount_wei) - wei(released)];
      },
    });
  }

  private async openDispute(db: Queryable, orderId: unknown) {
    return Boolean((await db.query(
      `select 1 from disputes where order_id=$1 and
       (status='open' or (status='reviewed' and decision='refund')) limit 1`, [orderId],
    )).rows[0]);
  }

  /** Giver's screen: records the nonce and the giver's location; the QR carries the returned session ID. */
  async openSession(userId: string, orderId: unknown, stageInput: unknown, body: Record<string, unknown>) {
    const stage = requiredStage(stageInput);
    const order = await this.participantOrder(userId, orderId);
    this.requireParty(order, userId, [STAGES[stage].giver]);
    if (order.status !== STAGES[stage].from) {
      throw new DomainError(stage === 1 ? "Pickup needs a funded order with an assigned driver"
        : "Delivery can only start after pickup", 409);
    }
    if (await this.openDispute(this.db, order.id)) throw new DomainError("Handoffs are paused by an open dispute", 409);
    const nonce = requiredBytes32(body.nonce, "nonce (32 bytes hex)");
    const expiresAt = Number(body.expiresAt);
    const now = Date.now() / 1000;
    if (!Number.isInteger(expiresAt) || expiresAt <= now || expiresAt > now + MAX_QR_SECONDS) {
      throw new DomainError(`QR expiry must be within the next ${MAX_QR_SECONDS} seconds`);
    }
    const giverEvidence = requiredEvidence(body.giverEvidence, "giver", true);
    const id = randomUUID();
    try {
      await this.db.query(
        `insert into handoff_sessions (id,order_id,stage,nonce,expires_at,giver_evidence)
         values ($1,$2,$3,$4,to_timestamp($5),$6)`,
        [id, order.id, stage, nonce.toLowerCase(), expiresAt, JSON.stringify(giverEvidence)],
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new DomainError("This QR nonce was already used", 409);
      throw error;
    }
    return { sessionId: id };
  }

  private async session(userId: string, orderId: unknown, stage: 1 | 2, sessionId: unknown, parties: readonly Party[]) {
    const order = await this.participantOrder(userId, orderId);
    this.requireParty(order, userId, parties);
    const session = (await this.db.query<Row>(
      "select * from handoff_sessions where id=$1 and order_id=$2 and stage=$3",
      [requiredUuid(sessionId, "session ID"), order.id, stage],
    )).rows[0];
    if (!session) throw new DomainError("Handoff session not found", 404);
    return { order, session };
  }

  /** Giver's screen polls this until the receiver has scanned and countersigned. */
  async sessionState(userId: string, orderId: unknown, stageInput: unknown, sessionId: unknown) {
    const stage = requiredStage(stageInput);
    const { session } = await this.session(userId, orderId, stage, sessionId,
      [STAGES[stage].giver, STAGES[stage].receiver]);
    if (!session.receiver_evidence) return {};
    return { receiverEvidence: requiredEvidence(session.receiver_evidence, "receiver"),
      evidenceHash: session.evidence_hash, receiverSig: session.receiver_sig };
  }

  /** Receiver's phone after scanning: its own location, the evidence hash, and its signature. */
  async submitReceiver(userId: string, orderId: unknown, stageInput: unknown, sessionId: unknown,
    body: Record<string, unknown>) {
    const stage = requiredStage(stageInput);
    const { order, session } = await this.session(userId, orderId, stage, sessionId, [STAGES[stage].receiver]);
    if (session.receiver_evidence) throw new DomainError("This QR code was already used", 409);
    if (new Date(String(session.expires_at)).getTime() <= Date.now()) {
      throw new DomainError("This QR code has expired; ask for a new one", 409);
    }
    if (order.status !== STAGES[stage].from || await this.openDispute(this.db, order.id)) {
      throw new DomainError("This handoff can't be completed right now", 409);
    }
    const receiverEvidence = requiredEvidence(body.receiverEvidence, "receiver", true);
    const expected = evidenceHash(requiredEvidence(session.giver_evidence, "giver", true), receiverEvidence);
    if (typeof body.evidenceHash !== "string" || body.evidenceHash.toLowerCase() !== expected) {
      throw new DomainError("Evidence hash does not match the two locations");
    }
    if (typeof body.receiverSig !== "string" || !isHex(body.receiverSig) || body.receiverSig.length > 4096
      || body.receiverSig.length < 4) {
      throw new DomainError("Receiver signature required");
    }
    // The contract checks both signatures (EOA or ERC-1271 smart wallet); the backend stores and relays them.
    const updated = await this.db.query(
      `update handoff_sessions set receiver_evidence=$2, evidence_hash=$3, receiver_sig=$4
       where id=$1 and receiver_evidence is null and expires_at > now() returning id`,
      [session.id, JSON.stringify(receiverEvidence), expected, body.receiverSig],
    );
    if (!updated.rows[0]) throw new DomainError("This QR code was already used or has expired", 409);
    return { ok: true };
  }

  private async balances(order: Row) {
    if (!this.chain?.balanceOf) return null;
    const read = async (wallet: unknown) => {
      if (typeof wallet !== "string") return null;
      try { return (await this.chain!.balanceOf!(wallet as Address)).toString(); } catch { return null; }
    };
    const [buyer, supplier, driver, escrow] = await Promise.all([order.buyer_wallet_address,
      order.supplier_wallet_address, order.driver_wallet_address, this.escrowAddress].map(read));
    return { buyer, supplier, driver, escrow };
  }

  /** GET /orders/:id — the order, its parties, on-chain timeline and four-wallet balances. */
  async view(userId: string, orderIdInput: unknown) {
    return this.render(await this.participantOrder(userId, orderIdInput));
  }

  private async render(order: Row) {
    const balances = this.balances(order);
    const people = new Map((await this.db.query<Row>(
      "select id,email from profiles where id = any($1::uuid[])",
      [[order.buyer_id, order.supplier_id, order.driver_id].filter(Boolean)],
    )).rows.map(p => [String(p.id), String(p.email)]));
    const party = (who: Party, fallbackEmail?: unknown) => {
      const id = idOf(order, who);
      if (!id && !fallbackEmail) return null;
      return { userId: id, email: id ? people.get(id) : fallbackEmail, wallet: walletOf(order, who) };
    };
    const timeline = (await this.db.query<Row>(
      `select event_name,stage_index,amount_wei,tx_hash,block_number,observed_at from chain_events
       where order_id=$1 order by block_number, observed_at, log_index`, [order.id],
    )).rows.map(e => ({ event: e.event_name, stage: e.stage_index, amountWei: String(e.amount_wei),
      txHash: e.tx_hash, blockNumber: String(e.block_number), observedAt: e.observed_at }));
    const disputes = (await this.db.query<Row>(
      `select id,raised_by,reason,status,decision,review_note,created_at,reviewed_at
       from disputes where order_id=$1 order by created_at desc`, [order.id],
    )).rows;
    return {
      id: order.id, status: order.status, chainOrderId: order.chain_order_id, chainId: order.chain_id,
      tokenAddress: order.token_address, escrowAddress: this.escrowAddress.toLowerCase(),
      totalWei: String(order.amount_wei), driverAtPickupWei: String(order.driver_at_pickup_wei),
      supplierAtPickupWei: String(order.supplier_at_pickup_wei),
      supplierAtDeliveryWei: String(order.supplier_at_delivery_wei),
      agreementText: order.agreement_text, agreementHash: order.agreement_hash,
      refundDeadline: order.refund_deadline, stagesDone: order.stages_done, createdAt: order.created_at,
      parties: { buyer: party("buyer"), supplier: party("supplier", order.supplier_email), driver: party("driver") },
      timeline, balances: await balances, disputes,
    };
  }

  async list(userId: string) {
    const result = await this.db.query<Row>(
      `select o.id,o.chain_order_id,o.amount_wei,o.status,o.refund_deadline,o.created_at from orders o
       where ${VISIBLE("$1")} order by o.created_at desc limit 100`, [userId],
    );
    return result.rows.map(o => ({ id: o.id, chainOrderId: o.chain_order_id, totalWei: String(o.amount_wei),
      status: o.status, refundDeadline: o.refund_deadline, createdAt: o.created_at }));
  }

  async raiseDispute(userId: string, orderIdInput: unknown, reasonInput: unknown) {
    const order = await this.participantOrder(userId, orderIdInput);
    const reason = requiredText(reasonInput, "Dispute reason", 10, 2000);
    try {
      return await this.db.transaction(async db => {
        const locked = (await db.query<Row>("select status from orders where id=$1 for update", [order.id])).rows[0];
        if (!DISPUTABLE.includes(locked.status as OrderStatus)) {
          throw new DomainError("Only a funded order that is not finished can be disputed", 409);
        }
        return (await db.query<Row>(
          `insert into disputes (id,order_id,raised_by,reason) values ($1,$2,$3,$4)
           returning id,order_id,raised_by,reason,status,created_at`,
          [randomUUID(), order.id, userId, reason],
        )).rows[0];
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new DomainError("This order already has an open dispute", 409);
      throw error;
    }
  }

  async listOpenDisputes(adminId: string) {
    await requireAdmin(this.db, adminId);
    return (await this.db.query<Row>(
      "select id,order_id,raised_by,reason,created_at from disputes where status='open' order by created_at limit 100",
    )).rows;
  }

  async reviewDispute(adminId: string, disputeIdInput: unknown, decisionInput: unknown, noteInput: unknown) {
    await requireAdmin(this.db, adminId);
    const disputeId = requiredUuid(disputeIdInput, "dispute ID");
    if (!["release", "refund", "reject"].includes(String(decisionInput))) throw new DomainError("Invalid decision");
    const note = requiredText(noteInput, "Review note", 10, 2000);
    const result = await this.db.query<Row>(
      `update disputes set status='reviewed',decision=$2,review_note=$3,reviewer_id=$4,reviewed_at=now()
       where id=$1 and status='open'
       returning id,order_id,status,decision,review_note,reviewer_id,reviewed_at`,
      [disputeId, decisionInput, note, adminId],
    );
    if (!result.rows[0]) throw new DomainError("Open dispute not found", 404);
    return result.rows[0];
  }
}
