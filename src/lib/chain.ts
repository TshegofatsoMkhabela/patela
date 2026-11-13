// Small wallet/chain helpers with no dependencies, so pages that only need
// these do not pull viem into their bundle.

export type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

export const CELO_CHAIN_ID = 42220;
export const CELO_SEPOLIA_CHAIN_ID = 11142220;
export const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? CELO_SEPOLIA_CHAIN_ID);
export const TARGET_CHAIN_HEX = `0x${TARGET_CHAIN_ID.toString(16)}`;
export const TARGET_CHAIN_NAME = TARGET_CHAIN_ID === CELO_CHAIN_ID ? "Celo" : "Celo Sepolia";
export const TARGET_ZARM_ADDRESS =
  process.env.NEXT_PUBLIC_ZARM_ADDRESS ??
  (TARGET_CHAIN_ID === CELO_CHAIN_ID
    ? "0x4c35853A3B4e647fD266f4de678dCc8fEC410BF6"
    : "0x10CCfB235b0E1Ed394bACE4560C3ed016697687e");

/** True when MetaMask says the user rejected the request (EIP-1193 code 4001). */
export const isUserRejection = (error: unknown) => (error as { code?: number })?.code === 4001;

/** A configured non-zero ERC-20 address, or null when token actions are unavailable. */
export function tokenAddress(value: string | undefined): `0x${string}` | null {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/.test(value)) return null;
  return value as `0x${string}`;
}
