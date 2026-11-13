// Small wallet/chain helpers with no dependencies, so pages that only need
// these (SiteNav, wallet-link, zarp) do not pull viem into their bundle.

export type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

/** Base Sepolia (chain ID 84532) as MetaMask reports it. */
export const BASE_SEPOLIA_HEX = "0x14a34";

/** True when MetaMask says the user rejected the request (EIP-1193 code 4001). */
export const isUserRejection = (error: unknown) => (error as { code?: number })?.code === 4001;

/** The configured MockZARP address, or null when minting is unavailable. */
export function testZarpAddress(value: string | undefined): `0x${string}` | null {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/.test(value)) return null;
  return value as `0x${string}`;
}
