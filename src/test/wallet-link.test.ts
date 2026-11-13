import { describe, expect, it } from "vitest";
import { verifyTypedData } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ApiError } from "@/lib/patela-api";
import { linkConnectedWallet, linkWallet, type LinkApi } from "@/lib/wallet-link";

const WALLET = "0x1111111111111111111111111111111111111111";

const challenge = {
  challengeId: "5b0c2d7e-0000-4000-8000-000000000001",
  expiresAt: "2026-11-13T05:05:00.000Z",
  typedData: {
    domain: { name: "Patela Wallet Link", version: "1", chainId: 11142220 },
    types: {
      WalletLink: [
        { name: "userId", type: "string" },
        { name: "wallet", type: "address" },
        { name: "nonce", type: "bytes32" },
        { name: "expiresAt", type: "uint256" },
      ],
    },
    primaryType: "WalletLink",
    message: { userId: "u-1", wallet: WALLET, nonce: "0x01", expiresAt: "1789000000" },
  },
};

function fakeApi() {
  const calls: string[] = [];
  const api: LinkApi = {
    async walletChallenge(wallet) {
      calls.push(`challenge:${wallet}`);
      return challenge;
    },
    async walletLink(challengeId, signature) {
      calls.push(`link:${challengeId}:${signature}`);
      return { wallet_address: WALLET.toLowerCase() };
    },
  };
  return { api, calls };
}

function fakeEth(sign: (params: unknown[]) => Promise<unknown>) {
  const requests: Array<{ method: string; params?: unknown[] }> = [];
  return {
    requests,
    eth: {
      async request(args: { method: string; params?: unknown[] }) {
        requests.push(args);
        if (args.method === "eth_signTypedData_v4") return sign(args.params ?? []);
        throw new Error(`unexpected ${args.method}`);
      },
    },
  };
}

describe("linkWallet", () => {
  it("given a signed-in user with MetaMask, when they link, then it signs the backend challenge and sends the signature back", async () => {
    const { api, calls } = fakeApi();
    const { eth, requests } = fakeEth(async () => "0xsignature");

    const result = await linkWallet(api, eth, WALLET);

    expect(calls).toEqual([`challenge:${WALLET}`, `link:${challenge.challengeId}:0xsignature`]);
    expect(requests).toHaveLength(1);
    const [signer, json] = requests[0].params as [string, string];
    expect(signer).toBe(WALLET);
    const typed = JSON.parse(json);
    expect(typed.primaryType).toBe("WalletLink");
    expect(typed.message).toEqual(challenge.typedData.message);
    expect(typed.domain).toEqual(challenge.typedData.domain);
    expect(result.wallet_address).toBe(WALLET.toLowerCase());
  });

  it("given the challenge's typed data, when MetaMask is asked to sign, then EIP712Domain matches the domain's fields", async () => {
    const { api } = fakeApi();
    const { eth, requests } = fakeEth(async () => "0xsignature");

    await linkWallet(api, eth, WALLET);

    const typed = JSON.parse((requests[0].params as [string, string])[1]);
    expect(typed.types.EIP712Domain).toEqual([
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
    ]);
    expect(typed.types.WalletLink).toEqual(challenge.typedData.types.WalletLink);
  });

  it("given a real key signs exactly what MetaMask is given, when the backend verifies it its own way, then it matches", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const backendTyped = {
      domain: { name: "Patela Wallet Link", version: "1", chainId: 11142220 },
      types: challenge.typedData.types,
      primaryType: "WalletLink" as const,
      message: {
        userId: "8f4c9a3e-1111-4222-8333-444455556666",
        wallet: account.address,
        nonce: `0x${"ab".repeat(32)}` as `0x${string}`,
        expiresAt: 1789000000n,
      },
    };
    // What GET /wallet/challenge sends: expiresAt as a string, no EIP712Domain.
    const sent = {
      ...challenge,
      typedData: {
        ...backendTyped,
        message: { ...backendTyped.message, expiresAt: "1789000000" },
      },
    };
    let signature = "";
    const api: LinkApi = {
      walletChallenge: async () => sent,
      walletLink: async (_id, sig) => {
        signature = sig;
        return { wallet_address: account.address };
      },
    };
    // Stand-in for MetaMask: sign the JSON string it receives.
    const eth = {
      async request(args: { method: string; params?: unknown[] }) {
        const parsed = JSON.parse((args.params as [string, string])[1]);
        return account.signTypedData(parsed);
      },
    };

    await linkWallet(api, eth, account.address);

    const valid = await verifyTypedData({
      ...backendTyped,
      address: account.address,
      signature: signature as `0x${string}`,
    });
    expect(valid).toBe(true);
  });

  it("given the user declines the signature, when linking, then nothing is sent to /wallet/link and the error is passed on", async () => {
    const { api, calls } = fakeApi();
    const { eth } = fakeEth(async () => {
      throw Object.assign(new Error("User rejected the request."), { code: 4001 });
    });

    await expect(linkWallet(api, eth, WALLET)).rejects.toThrow(/rejected/i);
    expect(calls).toEqual([`challenge:${WALLET}`]);
  });
});

describe("linkConnectedWallet", () => {
  function sessionApi(me: () => Promise<{ wallet_address: string | null }>) {
    const { api, calls } = fakeApi();
    return { api: { ...api, me }, calls };
  }
  const signing = () => fakeEth(async () => "0xsignature").eth;

  it("given the simulated demo wallet, when it connects, then it is never linked to the account", async () => {
    const { api, calls } = sessionApi(async () => ({ wallet_address: null }));

    const result = await linkConnectedWallet(api, signing(), { address: WALLET, demo: true });

    expect(result.status).toBe("demo");
    expect(calls).toEqual([]);
  });

  it("given nobody is signed in, when a real wallet connects, then linking is skipped", async () => {
    const { api, calls } = sessionApi(async () => {
      throw new ApiError("Session required", 401);
    });

    const result = await linkConnectedWallet(api, signing(), { address: WALLET, demo: false });

    expect(result.status).toBe("signed-out");
    expect(calls).toEqual([]);
  });

  it("given the wallet is already linked to this account, when it connects again, then no new signature is asked for", async () => {
    const { api, calls } = sessionApi(async () => ({ wallet_address: WALLET.toLowerCase() }));

    const result = await linkConnectedWallet(api, signing(), { address: WALLET, demo: false });

    expect(result.status).toBe("already-linked");
    expect(calls).toEqual([]);
  });

  it("given a signed-in user with a new wallet, when it connects, then it is linked", async () => {
    const { api, calls } = sessionApi(async () => ({ wallet_address: null }));

    const result = await linkConnectedWallet(api, signing(), { address: WALLET, demo: false });

    expect(result.status).toBe("linked");
    expect(calls).toHaveLength(2);
  });

  it("given the user declines in MetaMask, when linking, then it reports declined rather than linked", async () => {
    const { api } = sessionApi(async () => ({ wallet_address: null }));
    const { eth } = fakeEth(async () => {
      throw Object.assign(new Error("User rejected the request."), { code: 4001 });
    });

    const result = await linkConnectedWallet(api, eth, { address: WALLET, demo: false });

    expect(result.status).toBe("declined");
  });

  it("given the backend refuses the signature, when linking, then it reports the backend's message", async () => {
    const { api } = sessionApi(async () => ({ wallet_address: null }));
    api.walletLink = async () => {
      throw new ApiError("Wallet signature did not match", 403);
    };

    const result = await linkConnectedWallet(api, signing(), { address: WALLET, demo: false });

    expect(result).toEqual({ status: "failed", message: "Wallet signature did not match" });
  });
});
