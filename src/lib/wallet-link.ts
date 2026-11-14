// Proves to the backend that the signed-in user controls a MetaMask wallet:
// /wallet/challenge -> eth_signTypedData_v4 -> /wallet/link.

import { isUserRejection, signTypedData, type Eth } from "@/lib/chain";
import { ApiError, type WalletChallenge } from "@/lib/patela-api";

export type LinkApi = {
  walletChallenge(wallet: string): Promise<WalletChallenge>;
  walletLink(challengeId: string, signature: string): Promise<{ wallet_address: string | null }>;
};

export async function linkWallet(api: LinkApi, eth: Eth, address: string) {
  const { challengeId, typedData } = await api.walletChallenge(address);
  const signature = await signTypedData(eth, address, typedData);
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
    if (isUserRejection(error)) return { status: "declined" };
    return { status: "failed", message: (error as Error).message || "Wallet link failed." };
  }
}
