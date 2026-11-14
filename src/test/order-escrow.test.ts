import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, encodeFunctionData, type Address } from "viem";
import { TARGET_CHAIN_HEX } from "@/lib/chain";
import { escrowAbi } from "@/lib/contracts";
import { buildHandoffTypedData } from "@/lib/handoff";
import {
  createdOrderId,
  fundOrderTransaction,
  releaseHandoffTransaction,
  signTypedDataV4,
} from "@/lib/order-escrow";

const BUYER = "0x1111111111111111111111111111111111111111" as Address;
const TOKEN = "0x2222222222222222222222222222222222222222" as Address;
const ESCROW = "0x3333333333333333333333333333333333333333" as Address;
const word = (n: bigint) => `0x${n.toString(16).padStart(64, "0")}`;

function wallet(balance: bigint, allowance: bigint) {
  const sent: Array<{ to: string; data: string }> = [];
  let receiptReady = false;
  return {
    sent,
    eth: {
      async request(args: { method: string; params?: unknown[] }) {
        if (args.method === "eth_chainId") return TARGET_CHAIN_HEX;
        if (args.method === "eth_call") {
          const tx = args.params?.[0] as { data: string };
          if (tx.data.startsWith("0x70a08231")) return word(balance);
          if (tx.data.startsWith("0xdd62ed3e")) return word(allowance);
        }
        if (args.method === "eth_sendTransaction") {
          const tx = args.params?.[0] as { to: string; data: string };
          sent.push(tx);
          receiptReady = true;
          return `0x${sent.length.toString(16).padStart(64, "0")}`;
        }
        if (args.method === "eth_getTransactionReceipt") {
          return receiptReady ? { status: "0x1" } : null;
        }
        throw new Error(`Unexpected ${args.method}`);
      },
    },
  };
}

describe("fundOrderTransaction", () => {
  it("approves the exact total before funding when allowance is short", async () => {
    const { eth, sent } = wallet(100n, 0n);
    const result = await fundOrderTransaction(
      { eth, account: BUYER, escrow: ESCROW },
      7n,
      100n,
      TOKEN,
    );
    expect(result.approvalHash).toBeTruthy();
    expect(sent).toHaveLength(2);
    expect(sent[0].to).toBe(TOKEN);
    expect(sent[0].data).toBe(
      "0x095ea7b3" + ESCROW.slice(2).padStart(64, "0") + word(100n).slice(2),
    );
    expect(sent[1].to).toBe(ESCROW);
    expect(sent[1].data).toBe(
      encodeFunctionData({ abi: escrowAbi, functionName: "fundEscrow", args: [7n] }),
    );
  });

  it("skips approval when the existing allowance covers the order", async () => {
    const { eth, sent } = wallet(100n, 100n);
    const result = await fundOrderTransaction(
      { eth, account: BUYER, escrow: ESCROW },
      7n,
      100n,
      TOKEN,
    );
    expect(result.approvalHash).toBeUndefined();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(ESCROW);
  });

  it("does not send a transaction when the buyer lacks ZARm", async () => {
    const { eth, sent } = wallet(99n, 0n);
    await expect(
      fundOrderTransaction({ eth, account: BUYER, escrow: ESCROW }, 7n, 100n, TOKEN),
    ).rejects.toThrow(/Insufficient ZARm/);
    expect(sent).toHaveLength(0);
  });
});

describe("releaseHandoffTransaction", () => {
  it("sends releaseHandoff with both signatures to the escrow", async () => {
    const { eth, sent } = wallet(0n, 0n);
    const fields = {
      chainOrderId: 7n,
      stage: 1 as const,
      nonce: `0x${"01".repeat(32)}` as const,
      expiresAt: 1_800_000_000,
      evidenceHash: `0x${"02".repeat(32)}` as const,
      giverSig: "0xaaaa" as const,
      receiverSig: "0xbbbb" as const,
    };
    await releaseHandoffTransaction({ eth, account: BUYER, escrow: ESCROW }, fields);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(ESCROW);
    expect(sent[0].data).toBe(
      encodeFunctionData({
        abi: escrowAbi,
        functionName: "releaseHandoff",
        args: [7n, 1, fields.nonce, 1_800_000_000n, fields.evidenceHash, "0xaaaa", "0xbbbb"],
      }),
    );
  });
});

describe("signTypedDataV4", () => {
  it("asks the wallet to sign with bigints sent as decimal strings", async () => {
    const requests: Array<{ method: string; params?: unknown[] }> = [];
    const eth = {
      async request(args: { method: string; params?: unknown[] }) {
        requests.push(args);
        if (args.method === "eth_chainId") return TARGET_CHAIN_HEX;
        return "0xsig";
      },
    };
    const typed = buildHandoffTypedData({
      chainOrderId: 7n,
      stage: 2,
      giver: BUYER,
      receiver: ESCROW,
      nonce: `0x${"01".repeat(32)}`,
      expiresAt: 1_800_000_000,
      evidenceHash: `0x${"02".repeat(32)}`,
      verifyingContract: ESCROW,
    });
    expect(await signTypedDataV4(eth, BUYER, typed)).toBe("0xsig");
    const sign = requests.find((r) => r.method === "eth_signTypedData_v4")!;
    expect(sign.params?.[0]).toBe(BUYER);
    const json = JSON.parse(String(sign.params?.[1]));
    expect(json.primaryType).toBe("Handoff");
    expect(json.message.orderId).toBe("7");
    expect(json.message.expiresAt).toBe("1800000000");
    expect(json.domain.verifyingContract).toBe(ESCROW);
    expect(json.types.EIP712Domain.map((f: { name: string }) => f.name)).toEqual([
      "name",
      "version",
      "chainId",
      "verifyingContract",
    ]);
  });

  it("refuses to sign on the wrong chain", async () => {
    const eth = { request: async () => "0x1" };
    const typed = buildHandoffTypedData({
      chainOrderId: 1n,
      stage: 1,
      giver: BUYER,
      receiver: ESCROW,
      nonce: `0x${"01".repeat(32)}`,
      expiresAt: 1,
      evidenceHash: `0x${"02".repeat(32)}`,
    });
    await expect(signTypedDataV4(eth, BUYER, typed)).rejects.toThrow(/Switch your wallet/);
  });
});

describe("createdOrderId", () => {
  const created = encodeEventTopics({
    abi: escrowAbi,
    eventName: "OrderCreated",
    args: { orderId: 42n, buyer: BUYER, supplier: TOKEN },
  });
  const data = encodeAbiParameters(
    [{ type: "uint256" }, { type: "bytes32" }],
    [1000n, `0x${"ab".repeat(32)}`],
  );
  const receiptEth = (receipts: unknown[]) => ({
    async request(args: { method: string }) {
      if (args.method !== "eth_getTransactionReceipt") throw new Error(args.method);
      return receipts.shift() ?? null;
    },
  });

  it("reads the new order's ID from the escrow's OrderCreated event once the receipt exists", async () => {
    const eth = receiptEth([
      null,
      { status: "0x1", logs: [{ address: ESCROW.toUpperCase(), topics: created, data }] },
    ]);
    expect(await createdOrderId(eth, "0xhash", ESCROW, { intervalMs: 0 })).toBe(42n);
  });

  it("ignores the same event from another contract", async () => {
    const other = "0x9999999999999999999999999999999999999999";
    const eth = receiptEth([{ status: "0x1", logs: [{ address: other, topics: created, data }] }]);
    await expect(createdOrderId(eth, "0xhash", ESCROW, { intervalMs: 0 })).rejects.toThrow(
      /No OrderCreated/,
    );
  });

  it("reports a reverted transaction", async () => {
    const eth = receiptEth([{ status: "0x0", logs: [] }]);
    await expect(createdOrderId(eth, "0xhash", ESCROW, { intervalMs: 0 })).rejects.toThrow(
      /failed on-chain/,
    );
  });
});
