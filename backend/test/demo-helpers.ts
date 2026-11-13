import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import type { Address, Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import type { ChainEvent, ChainVerifier } from "../src/chain.js";
import type { MailMessage, MailTransport } from "../src/email.js";
import type { ExternalIntegrations } from "../src/integrations.js";
import { walletLinkTypedData } from "../src/service.js";

export const DEMO_CHAIN_ID = 11142220;
export const ESCROW = "0x1111111111111111111111111111111111111111" as Address;
export const TOKEN = "0x2222222222222222222222222222222222222222" as Address;
export const zarp = (rand: number) => BigInt(rand) * 10n ** 18n;

type EventInput = Omit<ChainEvent, "chainId" | "txHash" | "logIndex" | "blockNumber" | "blockHash">;

/** Stands in for Celo Sepolia: each `add` is one confirmed transaction holding the given escrow events. */
export class TestChain implements ChainVerifier {
  readonly receipts = new Map<string, ChainEvent[]>();
  readonly balances = new Map<string, bigint>();
  async events(txHash: Hex) {
    return this.receipts.get(txHash.toLowerCase()) ?? [];
  }
  async balanceOf(wallet: Address) {
    return this.balances.get(wallet.toLowerCase()) ?? 0n;
  }
  add(...events: EventInput[]): Hex {
    const txHash = `0x${(this.receipts.size + 1).toString(16).padStart(64, "0")}` as Hex;
    this.receipts.set(
      txHash,
      events.map((event, logIndex) => ({
        ...event,
        chainId: DEMO_CHAIN_ID,
        txHash,
        logIndex,
        blockNumber: 100n,
        blockHash: `0x${"a".repeat(64)}` as Hex,
      })),
    );
    return txHash;
  }
}

export class TestIntegrations implements ExternalIntegrations {
  async route() {
    return { distanceMeters: 250000, duration: "10800s", encodedPolyline: "test" };
  }
  async transcribe() {
    return "Box received";
  }
  async speak() {
    return Buffer.from("test mp3");
  }
}

export class TestMail implements MailTransport {
  readonly sent: MailMessage[] = [];
  failing = false;
  async send(message: MailMessage) {
    if (this.failing) throw new Error("SMTP unavailable");
    this.sent.push(message);
  }
}

export const bearer = (user: number) => ({ authorization: `Bearer user-${user}` });

/** Signs in `user` (creating the profile) and links `wallet` through the real challenge/link routes. */
export async function linkWallet(
  app: FastifyInstance,
  user: number,
  userId: string,
  wallet: PrivateKeyAccount,
  chainId = DEMO_CHAIN_ID,
) {
  const challenge = await app.inject({
    method: "POST",
    url: "/wallet/challenge",
    headers: bearer(user),
    payload: { wallet: wallet.address },
  });
  assert.equal(challenge.statusCode, 200, challenge.body);
  const { challengeId, typedData } = challenge.json();
  const signature = await wallet.signTypedData(
    walletLinkTypedData(
      chainId,
      userId,
      wallet.address,
      typedData.message.nonce,
      Number(typedData.message.expiresAt),
    ),
  );
  const linked = await app.inject({
    method: "POST",
    url: "/wallet/link",
    headers: bearer(user),
    payload: { challengeId, signature },
  });
  assert.equal(linked.statusCode, 200, linked.body);
}

/** A platform admin (temporarily `admin`) approves one trading capability for `user`. */
export async function approveCapability(
  app: FastifyInstance,
  setRole: (role: string) => Promise<unknown>,
  user: number,
  adminUser: number,
  cipc: string,
  capability: "buyer" | "supplier" | "carrier",
) {
  const org = await app.inject({
    method: "POST",
    url: "/organizations",
    headers: bearer(user),
    payload: {
      legalName: `Demo ${capability} (Pty) Ltd`,
      registrationNumber: cipc,
      capabilities: [capability],
    },
  });
  assert.equal(org.statusCode, 200, org.body);
  await app.inject({
    method: "POST",
    url: `/organizations/${org.json().id}/submit`,
    headers: bearer(user),
  });
  await setRole("admin");
  const approved = await app.inject({
    method: "POST",
    url: `/admin/organizations/${org.json().id}/review`,
    headers: bearer(adminUser),
    payload: { decision: "approve" },
  });
  await setRole("member");
  assert.equal(approved.json().status, "approved", approved.body);
}

export const approveBuyer = (
  app: FastifyInstance,
  setRole: (role: string) => Promise<unknown>,
  user: number,
  adminUser: number,
  cipc: string,
) => approveCapability(app, setRole, user, adminUser, cipc, "buyer");

export const tokenFrom = (acceptUrl: string) => new URL(acceptUrl).searchParams.get("token") ?? "";
