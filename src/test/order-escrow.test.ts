import { describe, expect, it } from "vitest";
import { encodeFunctionData, type Address } from "viem";
import { TARGET_CHAIN_HEX } from "@/lib/chain";
import { escrowAbi } from "@/lib/contracts";
import { fundOrderTransaction } from "@/lib/order-escrow";

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
