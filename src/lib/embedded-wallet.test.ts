import { describe, expect, it, vi } from "vitest";
import { decodeFunctionData, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { escrowAbi } from "@/lib/contracts";
import { buildHandoffTypedData } from "@/lib/handoff";
import {
  BASE_SEPOLIA_HEX,
  embeddedWalletOptions,
  signerFromProvider,
  type Eip1193Provider,
} from "@/lib/embedded-wallet";

const ESCROW = "0x00000000000000000000000000000000000000e5" as Address;
const owner = privateKeyToAccount(`0x${"33".repeat(32)}`);
const stranger = privateKeyToAccount(`0x${"44".repeat(32)}`);

type Call = { method: string; params?: unknown };

/** EIP-1193 provider backed by a local key, like the embedded wallet's EOA / 7702 account. */
function fakeProvider(
  opts: { signWith?: typeof owner; chainId?: string; accounts?: Address[] } = {},
) {
  const calls: Call[] = [];
  let chainId = opts.chainId ?? BASE_SEPOLIA_HEX;
  const provider: Eip1193Provider = {
    async request({ method, params }: { method: string; params?: unknown }) {
      calls.push({ method, params });
      switch (method) {
        case "eth_accounts":
        case "eth_requestAccounts":
          return opts.accounts ?? [owner.address];
        case "eth_chainId":
          return chainId;
        case "wallet_switchEthereumChain":
          chainId = (params as [{ chainId: string }])[0].chainId;
          return null;
        case "eth_signTypedData_v4": {
          const [, json] = params as [Address, string];
          const td = JSON.parse(json);
          delete td.types.EIP712Domain;
          return (opts.signWith ?? owner).signTypedData(td);
        }
        case "eth_sendTransaction":
          return `0x${"aa".repeat(32)}`;
        default:
          throw new Error(`unexpected ${method}`);
      }
    },
  };
  return { provider, calls };
}

const typedData = (receiver: Address) =>
  buildHandoffTypedData({
    chainOrderId: 9n,
    stage: 1,
    giver: stranger.address,
    receiver,
    nonce: `0x${"01".repeat(32)}` as Hex,
    expiresAt: 1_700_000_120,
    evidenceHash: `0x${"02".repeat(32)}` as Hex,
    verifyingContract: ESCROW,
  });

describe("embeddedWalletOptions", () => {
  // Given the client ID env var, when options are built, then they use it, Sapphire Devnet and an EIP-7702 MetaMask account
  it("reads the client ID from the environment and asks for an EIP-7702 MetaMask smart account", () => {
    const opts = embeddedWalletOptions({ NEXT_PUBLIC_WEB3AUTH_CLIENT_ID: "client-123" });
    expect(opts.clientId).toBe("client-123");
    expect(opts.web3AuthNetwork).toBe("sapphire_devnet");
    expect(opts.defaultChainId).toBe("0x14a34");
    expect(opts.accountAbstractionConfig).toEqual({
      smartAccountType: "metamask",
      smartAccountEipStandard: "7702",
    });
  });

  it("adds a Base Sepolia chain entry only when an RPC URL is configured", () => {
    expect(embeddedWalletOptions({ NEXT_PUBLIC_WEB3AUTH_CLIENT_ID: "c" }).chains).toBeUndefined();
    const chains = embeddedWalletOptions({
      NEXT_PUBLIC_WEB3AUTH_CLIENT_ID: "c",
      NEXT_PUBLIC_RPC_URL: "https://rpc.test",
    }).chains;
    expect(chains?.[0]).toMatchObject({
      chainId: "0x14a34",
      rpcTarget: "https://rpc.test",
      chainNamespace: "eip155",
    });
  });

  it("refuses to start without a client ID", () => {
    expect(() => embeddedWalletOptions({})).toThrow(/NEXT_PUBLIC_WEB3AUTH_CLIENT_ID/);
  });
});

describe("signerFromProvider", () => {
  it("exposes the wallet address", async () => {
    const { provider } = fakeProvider();
    const signer = await signerFromProvider(provider, "embedded", { escrow: ESCROW });
    expect(signer.address).toBe(owner.address);
    expect(signer.kind).toBe("embedded");
  });

  // Given a wallet whose signature recovers to its own address, when it signs a handoff, then the signature is returned
  it("signs typed data and checks the signature recovers to the wallet address", async () => {
    const { provider } = fakeProvider();
    const signer = await signerFromProvider(provider, "embedded", { escrow: ESCROW });
    const sig = await signer.signTypedData(typedData(owner.address));
    expect(sig).toBe(await owner.signTypedData(typedData(owner.address)));
  });

  // Given a provider that signs as some other key (e.g. a 4337 smart account wrapper), when it signs,
  // then the app stops with a clear error instead of sending a signature the contract would reject
  it("throws when the signature does not recover to the wallet address", async () => {
    const { provider } = fakeProvider({ signWith: stranger });
    const signer = await signerFromProvider(provider, "embedded", { escrow: ESCROW });
    await expect(signer.signTypedData(typedData(owner.address))).rejects.toThrow(/EIP-7702|EOA/);
  });

  // Given an extension on another network, when the signer is created, then it asks to switch to Base Sepolia
  it("switches an extension wallet to Base Sepolia", async () => {
    const { provider, calls } = fakeProvider({ chainId: "0x1" });
    await signerFromProvider(provider, "extension", { escrow: ESCROW });
    expect(calls.find((c) => c.method === "wallet_switchEthereumChain")?.params).toEqual([
      { chainId: BASE_SEPOLIA_HEX },
    ]);
  });

  it("sends escrow calls to the escrow with value 0 and returns the tx hash", async () => {
    const { provider, calls } = fakeProvider();
    const signer = await signerFromProvider(provider, "embedded", { escrow: ESCROW });
    const hash = await signer.writeEscrow({
      functionName: "acceptOrder",
      args: [5n, `0x${"cd".repeat(32)}`],
    });
    expect(hash).toBe(`0x${"aa".repeat(32)}`);
    const tx = (
      calls.find((c) => c.method === "eth_sendTransaction")!.params as [Record<string, Hex>]
    )[0];
    expect(tx.to?.toLowerCase()).toBe(ESCROW);
    expect(tx.from?.toLowerCase()).toBe(owner.address.toLowerCase());
    expect(BigInt(tx.value)).toBe(0n);
    expect(decodeFunctionData({ abi: escrowAbi, data: tx.data })).toEqual({
      functionName: "acceptOrder",
      args: [5n, `0x${"cd".repeat(32)}`],
    });
  });

  it("waits for the receipt and throws the decoded error on revert", async () => {
    const { provider } = fakeProvider();
    const waitForTransactionReceipt = vi
      .fn()
      .mockResolvedValueOnce({ status: "success", transactionHash: "0x1" })
      .mockResolvedValueOnce({ status: "reverted", transactionHash: "0x2" });
    const signer = await signerFromProvider(provider, "embedded", {
      escrow: ESCROW,
      publicClient: { waitForTransactionReceipt },
    });
    await expect(signer.waitForReceipt("0x1")).resolves.toBeUndefined();
    await expect(signer.waitForReceipt("0x2")).rejects.toThrow(/reverted/);
  });

  it("fails clearly when the wallet has no account", async () => {
    const { provider } = fakeProvider({ accounts: [] });
    await expect(signerFromProvider(provider, "extension", { escrow: ESCROW })).rejects.toThrow(
      /account/i,
    );
  });
});
