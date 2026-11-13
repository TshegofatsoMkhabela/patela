import { randomBytes, randomUUID } from "node:crypto";
import {
  isAddress, isHex, keccak256, parseUnits, toBytes, verifyTypedData,
  zeroAddress, type Address, type Hex,
} from "viem";
import type { Identity } from "./auth.js";
import type { ChainEvent, ChainVerifier } from "./chain.js";
import type { Database, Queryable } from "./db.js";
import { missingCapability } from "./onboarding.js";
import { DomainError, isUniqueViolation, requiredUuid } from "./validation.js";

export { DomainError };

export const BASE_CHAIN_ID = 8453;
export const ZARP_BASE = "0xb755506531786C8aC63B756BaB1ac387bACB0C04" as Address;
export const ZARP_DECIMALS = 18;
export const DEMO_SHARES_BPS = [0, 1000, 4000, 5000] as const;
const TX_HASH = /^0x[0-9a-f]{64}$/i;

type Row = Record<string, unknown>;
type HandoffInput = {
  fromUserId: string;
  toUserId: string;
  payeeUserId?: string | null;
};

function requiredTx(value: unknown): Hex {
  if (typeof value !== "string" || !TX_HASH.test(value)) throw new DomainError("Invalid transaction hash");
  return value as Hex;
}

function nonce(): Hex { return `0x${randomBytes(32).toString("hex")}`; }
function address(value: unknown): Address {
  if (typeof value !== "string" || !isAddress(value)) throw new DomainError("Invalid wallet address");
  return value as Address;
}
function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
function utcSeconds(value: unknown): number {
  return Math.floor(new Date(String(value)).getTime() / 1000);
}

export class PatelaService {
  constructor(
    private readonly db: Database,
    private readonly chain: ChainVerifier | undefined,
    private readonly escrowAddress: Address,
    private readonly chainId = BASE_CHAIN_ID,
    private readonly tokenAddress: Address = ZARP_BASE,
    private readonly tokenDecimals = ZARP_DECIMALS,
  ) {}

  async ensureProfile(identity: Identity): Promise<Row> {
    const id = requiredUuid(identity.id, "user ID");
    if (!identity.email || !identity.email.includes("@")) throw new DomainError("Authenticated email required", 401);
    const result = await this.db.query<Row>(
      `insert into profiles (id, email) values ($1,$2)
       on conflict (id) do update set email=excluded.email, updated_at=now()
       returning id,email,full_name,role,wallet_address,created_at`,
      [id, identity.email.toLowerCase()],
    );
    return result.rows[0];
  }

  async profile(userId: string): Promise<Row> {
    const result = await this.db.query<Row>(
      "select id,email,full_name,role,wallet_address,created_at from profiles where id=$1",
      [requiredUuid(userId, "user ID")],
    );
    if (!result.rows[0]) throw new DomainError("Profile not found", 404);
    return result.rows[0];
  }

  async updateProfile(userId: string, fullName: unknown): Promise<Row> {
    if (typeof fullName !== "string" || fullName.trim().length < 2 || fullName.length > 120) {
      throw new DomainError("Full name must be 2 to 120 characters");
    }
    const result = await this.db.query<Row>(
      `update profiles set full_name=$2, updated_at=now() where id=$1
       returning id,email,full_name,role,wallet_address,created_at`,
      [requiredUuid(userId, "user ID"), fullName.trim()],
    );
    if (!result.rows[0]) throw new DomainError("Profile not found", 404);
    return result.rows[0];
  }

  walletLinkTypedData(userId: string, wallet: Address, challengeNonce: Hex, expiresAt: number) {
    return {
      domain: { name: "Patela Wallet Link", version: "1", chainId: this.chainId },
      types: { WalletLink: [
        { name: "userId", type: "string" },
        { name: "wallet", type: "address" },
        { name: "nonce", type: "bytes32" },
        { name: "expiresAt", type: "uint256" },
      ] },
      primaryType: "WalletLink" as const,
      message: { userId, wallet, nonce: challengeNonce, expiresAt: BigInt(expiresAt) },
    };
  }

  async issueWalletChallenge(userId: string, walletInput: unknown) {
    const wallet = address(walletInput);
    const challengeNonce = nonce();
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const id = randomUUID();
    await this.db.query(
      `insert into wallet_challenges (id,user_id,wallet_address,nonce,expires_at)
       values ($1,$2,$3,$4,$5)`,
      [id, requiredUuid(userId, "user ID"), wallet.toLowerCase(), challengeNonce, expiresAt.toISOString()],
    );
    const typedData = this.walletLinkTypedData(userId, wallet, challengeNonce, Math.floor(expiresAt.getTime() / 1000));
    return { challengeId: id, expiresAt: expiresAt.toISOString(), typedData: {
      ...typedData, message: { ...typedData.message, expiresAt: typedData.message.expiresAt.toString() },
    } };
  }

  async linkWallet(userId: string, challengeIdInput: unknown, signatureInput: unknown): Promise<Row> {
    const challengeId = requiredUuid(challengeIdInput, "challenge ID");
    if (typeof signatureInput !== "string" || !isHex(signatureInput)) throw new DomainError("Invalid signature");
    return this.db.transaction(async (db) => {
      const result = await db.query<Row>(
        "select * from wallet_challenges where id=$1 and user_id=$2 for update",
        [challengeId, userId],
      );
      const challenge = result.rows[0];
      if (!challenge || challenge.used_at || Date.now() >= new Date(String(challenge.expires_at)).getTime()) {
        throw new DomainError("Wallet challenge expired or used", 409);
      }
      const wallet = address(challenge.wallet_address);
      const typedData = this.walletLinkTypedData(
        userId, wallet, challenge.nonce as Hex, utcSeconds(challenge.expires_at),
      );
      const valid = await verifyTypedData({ ...typedData, address: wallet, signature: signatureInput as Hex });
      if (!valid) throw new DomainError("Wallet signature did not match", 403);
      await db.query("update wallet_challenges set used_at=now() where id=$1", [challengeId]);
      const updated = await db.query<Row>(
        `update profiles set wallet_address=$2, updated_at=now() where id=$1
         returning id,email,full_name,role,wallet_address,created_at`,
        [userId, wallet.toLowerCase()],
      );
      return updated.rows[0];
    });
  }

  async createOrder(userId: string, amountInput: unknown, handoffsInput: unknown, refundHoursInput: unknown = 24) {
    if (sameAddress(this.escrowAddress, zeroAddress)) throw new DomainError("Escrow contract is not configured", 503);
    const buyer = await this.profile(userId);
    if (!buyer.wallet_address) throw new DomainError("Link buyer wallet first", 409);
    if (typeof amountInput !== "string" || !/^\d{1,12}(\.\d{1,2})?$/.test(amountInput)) {
      throw new DomainError("Amount must be a rand value with at most two decimals");
    }
    const amountWei = parseUnits(amountInput, this.tokenDecimals);
    if (amountWei <= 0n) throw new DomainError("Amount must be positive");
    if (!Array.isArray(handoffsInput) || handoffsInput.length !== 4) {
      throw new DomainError("Exactly four handoffs are required");
    }
    const handoffs = handoffsInput as HandoffInput[];
    const normalized = handoffs.map((handoff, index) => {
      if (!handoff || typeof handoff !== "object") throw new DomainError("Invalid handoff");
      const fromUserId = requiredUuid(handoff.fromUserId, "from user ID");
      const toUserId = requiredUuid(handoff.toUserId, "to user ID");
      if (fromUserId === toUserId) throw new DomainError("Both handoff signers must differ");
      const payeeUserId = index === 0 ? null : requiredUuid(handoff.payeeUserId, "payee user ID");
      if (index === 0 && handoff.payeeUserId) throw new DomainError("First handoff has no payout");
      return { fromUserId, toUserId, payeeUserId };
    });
    for (let index = 1; index < 4; index++) {
      if (normalized[index - 1].toUserId !== normalized[index].fromUserId) {
        throw new DomainError("Handoffs must form a continuous custody chain");
      }
    }
    if (normalized[3].toUserId !== userId
      || normalized[1].payeeUserId !== normalized[1].toUserId
      || normalized[2].payeeUserId !== normalized[0].fromUserId
      || normalized[3].payeeUserId !== normalized[0].fromUserId) {
      throw new DomainError("Demo payout recipients must be carrier 10%, supplier 40%, supplier 50%");
    }
    const participantIds = [...new Set([userId, ...normalized.flatMap(h => [
      h.fromUserId, h.toUserId, ...(h.payeeUserId ? [h.payeeUserId] : []),
    ])])];
    const people = await this.db.query<Row>(
      "select id,wallet_address from profiles where id = any($1::uuid[])",
      [participantIds],
    );
    if (people.rows.length !== participantIds.length || people.rows.some(p => !p.wallet_address)) {
      throw new DomainError("Every order participant needs an account and linked wallet", 409);
    }
    const missing = await missingCapability(this.db, [
      [userId, "buyer"], [normalized[0].fromUserId, "supplier"],
      [normalized[0].toUserId, "warehouse"], [normalized[1].toUserId, "carrier"],
    ]);
    if (missing === "buyer") throw new DomainError("Your business must be approved as a buyer before ordering", 403);
    if (missing) throw new DomainError(`Handoffs need an approved ${missing} business at that step`, 403);
    const walletsById = new Map(people.rows.map(p => [String(p.id), String(p.wallet_address)]));
    const id = randomUUID();
    const chainOrderId = keccak256(toBytes(id));
    const fundingDeadline = new Date(Date.now() + 60_000);
    const refundHours = Number(refundHoursInput);
    if (!Number.isInteger(refundHours) || refundHours < 1 || refundHours > 24 * 30) {
      throw new DomainError("Refund deadline must be 1 to 720 hours");
    }
    const refundDeadline = new Date(Date.now() + refundHours * 3_600_000);
    const payouts = normalized.map((_, index) => index === 3
      ? amountWei - amountWei * 10n / 100n - amountWei * 40n / 100n
      : amountWei * BigInt(DEMO_SHARES_BPS[index]) / 10_000n);
    await this.db.transaction(async (db) => {
      await db.query(
        `insert into orders
         (id,chain_order_id,buyer_id,buyer_wallet_address,amount_wei,token_address,chain_id,funding_deadline,refund_deadline)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, chainOrderId, userId, buyer.wallet_address, amountWei.toString(), this.tokenAddress.toLowerCase(),
          this.chainId, fundingDeadline.toISOString(), refundDeadline.toISOString()],
      );
      for (const personId of participantIds) {
        await db.query("insert into order_participants (order_id,user_id) values ($1,$2)", [id, personId]);
      }
      for (let index = 0; index < 4; index++) {
        const handoff = normalized[index];
        await db.query(
          `insert into handoffs
           (id,order_id,stage_index,from_user_id,to_user_id,payee_user_id,
            from_wallet_address,to_wallet_address,payee_wallet_address,payout_wei)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [randomUUID(), id, index + 1, handoff.fromUserId, handoff.toUserId,
            handoff.payeeUserId, walletsById.get(handoff.fromUserId), walletsById.get(handoff.toUserId),
            handoff.payeeUserId ? walletsById.get(handoff.payeeUserId) : null, payouts[index].toString()],
        );
      }
    });
    return this.orderFor(userId, id);
  }

  async orderFor(userId: string, orderIdInput: unknown): Promise<Row & { stages: Row[]; events: Row[] }> {
    const orderId = requiredUuid(orderIdInput, "order ID");
    const profile = await this.profile(userId);
    const orderResult = await this.db.query<Row>(
      `select o.* from orders o where o.id=$1 and
       ($2='admin' or exists (
         select 1 from order_participants p where p.order_id=o.id and p.user_id=$3
       ))`,
      [orderId, profile.role, userId],
    );
    const order = orderResult.rows[0];
    if (!order) throw new DomainError("Order not found", 404);
    const stages = await this.db.query<Row>(
      `select id,stage_index,from_user_id,to_user_id,payee_user_id,
       from_wallet_address,to_wallet_address,payee_wallet_address,payout_wei,
       status,challenge_expires_at,tx_hash,confirmed_at from handoffs
       where order_id=$1 order by stage_index`, [orderId],
    );
    const events = await this.db.query<Row>(
      `select event_name,stage_index,amount_wei,tx_hash,block_number,observed_at
       from chain_events where order_id=$1 order by block_number,log_index`, [orderId],
    );
    const disputes = await this.db.query<Row>(
      `select id,raised_by,reason,status,decision,reviewer_id,review_note,created_at,reviewed_at
       from disputes where order_id=$1 order by created_at desc`, [orderId],
    );
    return { ...order, escrow_address: this.escrowAddress,
      amount_wei: String(order.amount_wei), stages: stages.rows.map(s => ({
      ...s, payout_wei: String(s.payout_wei),
    })), events: events.rows.map(e => ({ ...e, amount_wei: String(e.amount_wei),
      block_number: String(e.block_number) })), disputes: disputes.rows };
  }

  async listOrders(userId: string) {
    const profile = await this.profile(userId);
    const result = await this.db.query<Row>(
      `select o.id,o.chain_order_id,o.amount_wei,o.status,o.funding_deadline,
       o.refund_deadline,o.created_at from orders o
       where $2='admin' or exists (
         select 1 from order_participants p where p.order_id=o.id and p.user_id=$1
       ) order by o.created_at desc limit 100`, [userId, profile.role],
    );
    return result.rows.map(row => ({ ...row, amount_wei: String(row.amount_wei) }));
  }

  handoffTypedData(order: Row, handoff: Row, fromWallet: Address, toWallet: Address) {
    return {
      domain: {
        name: "Patela Handoff", version: "1", chainId: this.chainId,
        verifyingContract: this.escrowAddress,
      },
      types: { Handoff: [
        { name: "orderId", type: "bytes32" },
        { name: "stage", type: "uint8" },
        { name: "nonce", type: "bytes32" },
        { name: "expiresAt", type: "uint256" },
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "payout", type: "uint256" },
      ] },
      primaryType: "Handoff" as const,
      message: {
        orderId: order.chain_order_id as Hex,
        stage: Number(handoff.stage_index),
        nonce: handoff.nonce as Hex,
        expiresAt: BigInt(utcSeconds(handoff.challenge_expires_at)),
        from: fromWallet, to: toWallet, payout: BigInt(String(handoff.payout_wei)),
      },
    };
  }

  private async handoffContext(db: Queryable, orderId: string, stage: number) {
    const order = (await db.query<Row>("select * from orders where id=$1", [orderId])).rows[0];
    const handoff = (await db.query<Row>(
      "select * from handoffs where order_id=$1 and stage_index=$2", [orderId, stage],
    )).rows[0];
    if (!order || !handoff) throw new DomainError("Order or handoff not found", 404);
    const fromWallet = handoff.from_wallet_address;
    const toWallet = handoff.to_wallet_address;
    if (!fromWallet || !toWallet) throw new DomainError("Both handoff wallets must be linked", 409);
    return { order, handoff, fromWallet: address(fromWallet), toWallet: address(toWallet) };
  }

  async issueHandoff(userId: string, orderIdInput: unknown, stageInput: unknown) {
    if (sameAddress(this.escrowAddress, zeroAddress)) throw new DomainError("Escrow contract is not configured", 503);
    const orderId = requiredUuid(orderIdInput, "order ID");
    const stage = Number(stageInput);
    if (!Number.isInteger(stage) || stage < 1 || stage > 4) throw new DomainError("Invalid stage");
    return this.db.transaction(async (db) => {
      await db.query("select id from orders where id=$1 for update", [orderId]);
      const context = await this.handoffContext(db, orderId, stage);
      const { order, handoff } = context;
      if (userId !== handoff.from_user_id && userId !== handoff.to_user_id) throw new DomainError("Handoff signer required", 403);
      if (!["funded","in_progress"].includes(String(order.status))) throw new DomainError("Order is not funded", 409);
      const openDispute = await db.query<Row>(
        `select id from disputes where order_id=$1 and
         (status='open' or (status='reviewed' and decision='refund')) limit 1`, [orderId],
      );
      if (openDispute.rows[0]) throw new DomainError("Order has an unresolved dispute or refund decision", 409);
      if (stage > 1) {
        const prior = await db.query<Row>(
          "select status from handoffs where order_id=$1 and stage_index=$2", [orderId, stage - 1],
        );
        if (prior.rows[0]?.status !== "confirmed") throw new DomainError("Previous handoff is not confirmed", 409);
      }
      if (handoff.status === "confirmed" || handoff.status === "awaiting_chain") {
        throw new DomainError("Handoff already submitted", 409);
      }
      const challengeNonce = nonce();
      const expiresAt = new Date(Date.now() + 2 * 60_000);
      await db.query(
        `update handoffs set status='issued',nonce=$3,challenge_expires_at=$4,
         from_signature=null,to_signature=null where order_id=$1 and stage_index=$2`,
        [orderId, stage, challengeNonce, expiresAt.toISOString()],
      );
      const typedData = this.handoffTypedData(order, {
        ...handoff, nonce: challengeNonce, challenge_expires_at: expiresAt.toISOString(),
      }, context.fromWallet, context.toWallet);
      return { expiresAt: expiresAt.toISOString(), typedData: {
        ...typedData, message: {
          ...typedData.message,
          expiresAt: typedData.message.expiresAt.toString(),
          payout: typedData.message.payout.toString(),
        },
      } };
    });
  }

  async submitHandoff(
    userId: string, orderIdInput: unknown, stageInput: unknown,
    nonceInput: unknown, fromSignatureInput: unknown, toSignatureInput: unknown,
  ) {
    const orderId = requiredUuid(orderIdInput, "order ID");
    const stage = Number(stageInput);
    if (!Number.isInteger(stage) || stage < 1 || stage > 4) throw new DomainError("Invalid stage");
    if (typeof nonceInput !== "string" || !/^0x[0-9a-f]{64}$/i.test(nonceInput)) throw new DomainError("Invalid nonce");
    if (typeof fromSignatureInput !== "string" || !isHex(fromSignatureInput)
      || typeof toSignatureInput !== "string" || !isHex(toSignatureInput)) {
      throw new DomainError("Both signatures are required");
    }
    const context = await this.handoffContext(this.db, orderId, stage);
    const { order, handoff, fromWallet, toWallet } = context;
    if (userId !== handoff.from_user_id && userId !== handoff.to_user_id) throw new DomainError("Handoff signer required", 403);
    if (handoff.status !== "issued" || handoff.nonce !== nonceInput
      || Date.now() >= new Date(String(handoff.challenge_expires_at)).getTime()) {
      throw new DomainError("QR challenge expired, replaced, or already used", 409);
    }
    const typedData = this.handoffTypedData(order, handoff, fromWallet, toWallet);
    const [fromValid, toValid] = await Promise.all([
      verifyTypedData({ ...typedData, address: fromWallet, signature: fromSignatureInput as Hex }),
      verifyTypedData({ ...typedData, address: toWallet, signature: toSignatureInput as Hex }),
    ]);
    if (!fromValid || !toValid) throw new DomainError("Both wallet signatures must match the handoff", 403);
    await this.db.transaction(async db => {
      const locked = (await db.query<Row>("select status from orders where id=$1 for update", [orderId])).rows[0];
      if (!["funded", "in_progress"].includes(String(locked?.status))) {
        throw new DomainError("Order is not active", 409);
      }
      const dispute = await db.query<Row>(
        `select id from disputes where order_id=$1 and
         (status='open' or (status='reviewed' and decision='refund')) limit 1`, [orderId],
      );
      if (dispute.rows[0]) throw new DomainError("Order has an unresolved dispute or refund decision", 409);
      const result = await db.query<Row>(
        `update handoffs set status='awaiting_chain',from_signature=$4,to_signature=$5
         where order_id=$1 and stage_index=$2 and status='issued' and nonce=$3
         and challenge_expires_at > now() returning id`,
        [orderId, stage, nonceInput, fromSignatureInput, toSignatureInput],
      );
      if (!result.rows[0]) throw new DomainError("QR challenge already used or expired", 409);
    });
    return { status: "awaiting_chain", orderId, stage, typedData: {
      ...typedData, message: { ...typedData.message,
        expiresAt: typedData.message.expiresAt.toString(), payout: typedData.message.payout.toString() },
    }, fromSignature: fromSignatureInput, toSignature: toSignatureInput };
  }

  private async matchingEvent(txHashInput: unknown, name: ChainEvent["name"], order: Row, stage?: number) {
    if (!this.chain || sameAddress(this.escrowAddress, zeroAddress)) {
      throw new DomainError("Escrow contract is not configured", 503);
    }
    const txHash = requiredTx(txHashInput);
    let events: ChainEvent[];
    try { events = await this.chain.events(txHash); }
    catch (error) { throw new DomainError(error instanceof Error ? error.message : "Chain verification failed", 409); }
    const event = events.find(e => e.name === name
      && e.chainId === this.chainId
      && e.orderId.toLowerCase() === String(order.chain_order_id).toLowerCase()
      && (stage === undefined || e.stage === stage));
    if (!event) throw new DomainError("Expected escrow event not found in confirmed receipt", 409);
    return event;
  }

  private async persistEvent(db: Queryable, event: ChainEvent, orderId: string) {
    const inserted = await db.query<Row>(
      `insert into chain_events
       (chain_id,tx_hash,log_index,order_id,event_name,stage_index,amount_wei,block_number,block_hash)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict do nothing returning tx_hash`,
      [event.chainId, event.txHash.toLowerCase(), event.logIndex, orderId, event.name,
        event.stage ?? null, event.amountWei.toString(), event.blockNumber.toString(), event.blockHash],
    );
    return Boolean(inserted.rows[0]);
  }

  async verifyFunding(userId: string, orderIdInput: unknown, txHash: unknown) {
    const orderId = requiredUuid(orderIdInput, "order ID");
    const order = await this.orderFor(userId, orderId);
    if (userId !== order.buyer_id) throw new DomainError("Buyer required", 403);
    const event = await this.matchingEvent(txHash, "OrderFunded", order);
    if (event.amountWei !== BigInt(String(order.amount_wei))
      || !event.token || !sameAddress(event.token, String(order.token_address))
      || !sameAddress(event.actor, String(order.buyer_wallet_address))) {
      throw new DomainError("Funding event amount, token, or buyer did not match", 409);
    }
    await this.db.transaction(async (db) => {
      await db.query("select id from orders where id=$1 for update", [orderId]);
      const existing = (await db.query<Row>("select status from orders where id=$1", [orderId])).rows[0];
      if (existing.status !== "awaiting_funding") return;
      if (await this.persistEvent(db, event, orderId)) {
        await db.query(
          "update orders set status='funded',funding_tx_hash=$2,updated_at=now() where id=$1",
          [orderId, event.txHash.toLowerCase()],
        );
      }
    });
    return this.orderFor(userId, orderId);
  }

  async verifyHandoff(userId: string, orderIdInput: unknown, stageInput: unknown, txHash: unknown) {
    const orderId = requiredUuid(orderIdInput, "order ID");
    const stage = Number(stageInput);
    if (!Number.isInteger(stage) || stage < 1 || stage > 4) throw new DomainError("Invalid stage");
    const order = await this.orderFor(userId, orderId);
    const handoff = order.stages.find(s => s.stage_index === stage);
    if (!handoff) throw new DomainError("Handoff not found", 404);
    if (handoff.status !== "awaiting_chain") throw new DomainError("Both handoff signatures must be submitted first", 409);
    const event = await this.matchingEvent(txHash, "HandoffCompleted", order, stage);
    if (event.amountWei !== BigInt(String(handoff.payout_wei))
      || !sameAddress(event.actor, handoff.payee_wallet_address ? String(handoff.payee_wallet_address) : zeroAddress)) {
      throw new DomainError("Handoff payout did not match", 409);
    }
    await this.db.transaction(async (db) => {
      await db.query("select id from orders where id=$1 for update", [orderId]);
      const current = (await db.query<Row>(
        "select status from handoffs where order_id=$1 and stage_index=$2", [orderId, stage],
      )).rows[0];
      const activeOrder = (await db.query<Row>("select status from orders where id=$1", [orderId])).rows[0];
      if (!["funded", "in_progress"].includes(String(activeOrder?.status))) {
        throw new DomainError("Order is not active", 409);
      }
      if (current.status === "confirmed") return;
      if (current.status !== "awaiting_chain") throw new DomainError("Handoff is not awaiting chain", 409);
      if (await this.persistEvent(db, event, orderId)) {
        await db.query(
          `update handoffs set status='confirmed',tx_hash=$3,confirmed_at=now()
           where order_id=$1 and stage_index=$2`, [orderId, stage, event.txHash.toLowerCase()],
        );
        await db.query(
          "update orders set status=$2,updated_at=now() where id=$1",
          [orderId, stage === 4 ? "delivered" : "in_progress"],
        );
      }
    });
    return this.orderFor(userId, orderId);
  }

  async verifyRefund(userId: string, orderIdInput: unknown, txHash: unknown) {
    const orderId = requiredUuid(orderIdInput, "order ID");
    const order = await this.orderFor(userId, orderId);
    if (userId !== order.buyer_id) throw new DomainError("Buyer required", 403);
    if (!["funded","in_progress","refunded"].includes(String(order.status))) {
      throw new DomainError("Order cannot be refunded in this state", 409);
    }
    const paid = order.stages.filter(s => s.status === "confirmed")
      .reduce((sum, s) => sum + BigInt(String(s.payout_wei)), 0n);
    const event = await this.matchingEvent(txHash, "OrderRefunded", order);
    if (event.amountWei !== BigInt(String(order.amount_wei)) - paid
      || !sameAddress(event.actor, String(order.buyer_wallet_address))) {
      throw new DomainError("Refund event amount or buyer did not match", 409);
    }
    await this.db.transaction(async (db) => {
      await db.query("select id from orders where id=$1 for update", [orderId]);
      const current = (await db.query<Row>("select status from orders where id=$1", [orderId])).rows[0];
      if (current.status === "refunded") return;
      if (await this.persistEvent(db, event, orderId)) {
        await db.query("update orders set status='refunded',updated_at=now() where id=$1", [orderId]);
      }
    });
    return this.orderFor(userId, orderId);
  }

  async raiseDispute(userId: string, orderIdInput: unknown, reasonInput: unknown) {
    const order = await this.orderFor(userId, orderIdInput);
    if (!["funded","in_progress"].includes(String(order.status))) {
      throw new DomainError("Only an active funded order can be disputed", 409);
    }
    if (typeof reasonInput !== "string" || reasonInput.trim().length < 10 || reasonInput.length > 2000) {
      throw new DomainError("Dispute reason must be 10 to 2000 characters");
    }
    try {
      return await this.db.transaction(async db => {
        const activeOrder = (await db.query<Row>(
          "select status from orders where id=$1 for update", [order.id],
        )).rows[0];
        if (!["funded", "in_progress"].includes(String(activeOrder?.status))) {
          throw new DomainError("Only an active funded order can be disputed", 409);
        }
        const result = await db.query<Row>(
          `insert into disputes (id,order_id,raised_by,reason) values ($1,$2,$3,$4)
           returning id,order_id,raised_by,reason,status,created_at`,
          [randomUUID(), order.id, userId, reasonInput.trim()],
        );
        return result.rows[0];
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError("This order already has an open dispute", 409);
      }
      throw error;
    }
  }

  async listOpenDisputes(adminUserId: string) {
    const admin = await this.profile(adminUserId);
    if (admin.role !== "admin") throw new DomainError("Admin role required", 403);
    const result = await this.db.query<Row>(
      `select d.id,d.order_id,d.raised_by,d.reason,d.created_at
       from disputes d where d.status='open' order by d.created_at limit 100`,
    );
    return result.rows;
  }

  async reviewDispute(adminUserId: string, disputeIdInput: unknown,
    decisionInput: unknown, noteInput: unknown) {
    const admin = await this.profile(adminUserId);
    if (admin.role !== "admin") throw new DomainError("Admin role required", 403);
    const disputeId = requiredUuid(disputeIdInput, "dispute ID");
    if (!["release","refund","reject"].includes(String(decisionInput))) throw new DomainError("Invalid decision");
    if (typeof noteInput !== "string" || noteInput.trim().length < 10 || noteInput.length > 2000) {
      throw new DomainError("Review note must be 10 to 2000 characters");
    }
    const result = await this.db.query<Row>(
      `update disputes set status='reviewed',decision=$2,review_note=$3,
       reviewer_id=$4,reviewed_at=now() where id=$1 and status='open'
       returning id,order_id,status,decision,review_note,reviewer_id,reviewed_at`,
      [disputeId, decisionInput, noteInput.trim(), adminUserId],
    );
    if (!result.rows[0]) throw new DomainError("Open dispute not found", 404);
    return result.rows[0];
  }
}
