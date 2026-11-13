// Proves to the backend that the signed-in user controls a MetaMask wallet:
// /wallet/challenge -> eth_signTypedData_v4 -> /wallet/link.

import { ApiError, type WalletChallenge } from "@/lib/patela-api";

export type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

export type LinkApi = {
  walletChallenge(wallet: string): Promise<WalletChallenge>;
  walletLink(challengeId: string, signature: string): Promise<{ wallet_address: string | null }>;
};

// MetaMask's v4 signer needs the domain's own type listed; the backend
// (viem) derives it implicitly, so it is added here from the domain's fields.
const DOMAIN_FIELDS = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
] as const;

export async function linkWallet(api: LinkApi, eth: Eth, address: string) {
  const { challengeId, typedData } = await api.walletChallenge(address);
  const typed = {
    ...typedData,
    types: {
      EIP712Domain: DOMAIN_FIELDS.filter((f) => f.name in typedData.domain),
      ...typedData.types,
    },
  };
  const signature = (await eth.request({
    method: "eth_signTypedData_v4",
    params: [address, JSON.stringify(typed)],
  })) as string;
  return api.walletLink(challengeId, signature);
}

export type LinkOutcome =
  | { status: "demo" | "signed-out" | "already-linked" | "linked" | "declined" }
  | { status: "failed"; message: string };

/** Links a freshly connected wallet when that makes sense; never throws. */
export async function linkConnectedWallet(
  api: LinkApi & { me(): Promise<{ wallet_address: string | null }> },
  eth: Eth | undefined,
  wallet: { address: string; demo: boolean },
): Promise<LinkOutcome> {
  if (wallet.demo || !eth) return { status: "demo" };
  try {
    const profile = await api.me();
    if (profile.wallet_address?.toLowerCase() === wallet.address.toLowerCase()) {
      return { status: "already-linked" };
    }
    await linkWallet(api, eth, wallet.address);
    return { status: "linked" };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { status: "signed-out" };
    if ((error as { code?: number }).code === 4001) return { status: "declined" };
    return { status: "failed", message: (error as Error).message || "Wallet link failed." };
  }
}
