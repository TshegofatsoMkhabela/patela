import { describe, expect, it } from "vitest";
import { TARGET_CHAIN_HEX, tokenAddress } from "@/lib/chain";
import { approveZarm, waitForReceipt, zarmBalance } from "@/lib/zarp";

function receiptEth(receipts: Array<{ status: string } | null>) {
  let polls = 0;
  return {
    get polls() {
      return polls;
    },
    async request(args: { method: string }) {
      if (args.method !== "eth_getTransactionReceipt") throw new Error(args.method);
      polls += 1;
      return receipts.shift() ?? null;
    },
  };
}

describe("waitForReceipt", () => {
  it("resolves after a pending transaction confirms", async () => {
    const eth = receiptEth([null, null, { status: "0x1" }]);
    expect(await waitForReceipt(eth, "0xhash", { intervalMs: 0, attempts: 5 })).toBe(true);
    expect(eth.polls).toBe(3);
  });

  it("rejects a reverted transaction", async () => {
    await expect(
      waitForReceipt(receiptEth([{ status: "0x0" }]), "0xhash", { intervalMs: 0, attempts: 2 }),
    ).rejects.toThrow(/failed/i);
  });
});

const BUYER = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x2222222222222222222222222222222222222222";
const ESCROW = "0x3333333333333333333333333333333333333333";
const word = (n: bigint) => "0x" + n.toString(16).padStart(64, "0");

function fakeEth({ chainId = TARGET_CHAIN_HEX, decimals = 18n, balance = 0n } = {}) {
  const requests: Array<{ method: string; params?: unknown[] }> = [];
  const eth = {
    async request(args: { method: string; params?: unknown[] }) {
      requests.push(args);
      if (args.method === "eth_chainId") return chainId;
      if (args.method === "eth_call") {
        const data = (args.params?.[0] as { data: string }).data;
        if (data.startsWith("0x313ce567")) return word(decimals);
        if (data.startsWith("0x70a08231")) return word(balance);
        throw new Error(`unexpected call ${data}`);
      }
      if (args.method === "eth_sendTransaction") return "0xtxhash";
      throw new Error(`unexpected ${args.method}`);
    },
  };
  return { eth, requests };
}

describe("tokenAddress", () => {
  it("accepts a configured non-zero token address", () => expect(tokenAddress(TOKEN)).toBe(TOKEN));
  it("rejects absent, zero, and malformed addresses", () => {
    expect(tokenAddress(undefined)).toBeNull();
    expect(tokenAddress("0x0000000000000000000000000000000000000000")).toBeNull();
    expect(tokenAddress("not-an-address")).toBeNull();
  });
});

describe("approveZarm", () => {
  it("approves only the supplied exact escrow amount", async () => {
    const { eth, requests } = fakeEth();
    expect(
      await approveZarm({ eth, account: BUYER, token: TOKEN, spender: ESCROW, amountWei: 25n }),
    ).toBe("0xtxhash");
    const tx = (
      requests.find((r) => r.method === "eth_sendTransaction")?.params as [{ data: string }]
    )[0];
    expect(tx.data).toBe("0x095ea7b3" + ESCROW.slice(2).padStart(64, "0") + word(25n).slice(2));
  });

  it("rejects the wrong chain before sending", async () => {
    const { eth, requests } = fakeEth({ chainId: "0x2105" });
    await expect(
      approveZarm({ eth, account: BUYER, token: TOKEN, spender: ESCROW, amountWei: 25n }),
    ).rejects.toThrow(/Celo/);
    expect(requests.some((r) => r.method === "eth_sendTransaction")).toBe(false);
  });
});

describe("zarmBalance", () => {
  it("formats the wallet balance using token decimals", async () => {
    const { eth } = fakeEth({ balance: 15005n * 10n ** 17n });
    expect(await zarmBalance({ eth, account: BUYER, token: TOKEN })).toBe("1500.5");
  });
});
