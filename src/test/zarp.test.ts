import { describe, expect, it } from "vitest";
import { mintTestZarp, testZarpAddress, zarpBalance } from "@/lib/zarp";

const BUYER = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x2222222222222222222222222222222222222222";
const BASE_SEPOLIA = "0x14a34";
const word = (n: bigint) => "0x" + n.toString(16).padStart(64, "0");

function fakeEth({ chainId = BASE_SEPOLIA, decimals = 18n, balance = 0n } = {}) {
  const requests: Array<{ method: string; params?: unknown[] }> = [];
  const eth = {
    async request(args: { method: string; params?: unknown[] }) {
      requests.push(args);
      if (args.method === "eth_chainId") return chainId;
      if (args.method === "eth_call") {
        const data = (args.params?.[0] as { data: string }).data;
        if (data.startsWith("0x313ce567")) return word(decimals); // decimals()
        if (data.startsWith("0x70a08231")) return word(balance); // balanceOf(address)
        throw new Error(`unexpected call ${data}`);
      }
      if (args.method === "eth_sendTransaction") return "0xtxhash";
      throw new Error(`unexpected ${args.method}`);
    },
  };
  return { eth, requests };
}

describe("testZarpAddress", () => {
  it("given a configured token address, when read, then it is returned", () => {
    expect(testZarpAddress(TOKEN)).toBe(TOKEN);
  });

  it("given no address, the zero address, or junk, when read, then minting is unavailable", () => {
    expect(testZarpAddress(undefined)).toBeNull();
    expect(testZarpAddress("0x0000000000000000000000000000000000000000")).toBeNull();
    expect(testZarpAddress("not-an-address")).toBeNull();
  });
});

describe("mintTestZarp", () => {
  it("given a buyer on Base Sepolia, when they mint 1000 test ZARP, then their wallet sends mint(buyer, 1000e18) to the token", async () => {
    const { eth, requests } = fakeEth();

    const hash = await mintTestZarp({ eth, account: BUYER, token: TOKEN, amount: "1000" });

    expect(hash).toBe("0xtxhash");
    const sent = requests.find((r) => r.method === "eth_sendTransaction");
    const tx = (sent?.params as [{ from: string; to: string; data: string }])[0];
    expect(tx.from).toBe(BUYER);
    expect(tx.to).toBe(TOKEN);
    expect(tx.data).toBe(
      "0x40c10f19" + BUYER.slice(2).padStart(64, "0") + word(1000n * 10n ** 18n).slice(2),
    );
  });

  it("given a token with 6 decimals, when minting, then the amount is scaled by the token's own decimals", async () => {
    const { eth, requests } = fakeEth({ decimals: 6n });

    await mintTestZarp({ eth, account: BUYER, token: TOKEN, amount: "1000" });

    const tx = (
      requests.find((r) => r.method === "eth_sendTransaction")?.params as [{ data: string }]
    )[0];
    expect(tx.data.endsWith(word(1000n * 10n ** 6n).slice(2))).toBe(true);
  });

  it("given MetaMask is on another chain, when minting, then it refuses before sending anything", async () => {
    const { eth, requests } = fakeEth({ chainId: "0x2105" });

    await expect(
      mintTestZarp({ eth, account: BUYER, token: TOKEN, amount: "1000" }),
    ).rejects.toThrow(/Base Sepolia/);
    expect(requests.some((r) => r.method === "eth_sendTransaction")).toBe(false);
  });

  it("given an amount that is not a positive number, when minting, then it refuses", async () => {
    const { eth } = fakeEth();

    await expect(mintTestZarp({ eth, account: BUYER, token: TOKEN, amount: "0" })).rejects.toThrow(
      /amount/i,
    );
    await expect(
      mintTestZarp({ eth, account: BUYER, token: TOKEN, amount: "abc" }),
    ).rejects.toThrow(/amount/i);
  });
});

describe("zarpBalance", () => {
  it("given a balance of 1500.5 ZARP, when read, then it is formatted with the token's decimals", async () => {
    const { eth } = fakeEth({ balance: 15005n * 10n ** 17n });

    expect(await zarpBalance({ eth, account: BUYER, token: TOKEN })).toBe("1500.5");
  });
});
