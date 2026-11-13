// Testnet-only helpers for MockZARP (contracts/contracts/MockZARP.sol), whose
// mint(to, amount) is open to anyone. The buyer's own wallet sends the mint,
// so no Patela key is involved. Never point this at real ZARP.

import {
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  isAddress,
  parseAbi,
  parseUnits,
  zeroAddress,
  type Address,
} from "viem";
import type { Eth } from "@/lib/wallet-link";

export const BASE_SEPOLIA_HEX = "0x14a34";

const abi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
]);

/** The configured MockZARP address, or null when minting is unavailable. */
export function testZarpAddress(value: string | undefined): Address | null {
  if (!value || !isAddress(value) || value.toLowerCase() === zeroAddress) return null;
  return value as Address;
}

type TokenArgs = { eth: Eth; account: string; token: string };

async function read<F extends "decimals" | "balanceOf">(
  eth: Eth,
  token: string,
  functionName: F,
  args: readonly unknown[] = [],
) {
  const data = encodeFunctionData({ abi, functionName, args } as never);
  const result = (await eth.request({
    method: "eth_call",
    params: [{ to: token, data }, "latest"],
  })) as `0x${string}`;
  return decodeFunctionResult({ abi, functionName, data: result } as never) as unknown as bigint;
}

export async function mintTestZarp({
  eth,
  account,
  token,
  amount,
}: TokenArgs & { amount: string }) {
  if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
    throw new Error("Enter a positive ZARP amount.");
  }
  const chainId = (await eth.request({ method: "eth_chainId" })) as string;
  if (chainId.toLowerCase() !== BASE_SEPOLIA_HEX) {
    throw new Error("Switch MetaMask to Base Sepolia to get test ZARP.");
  }
  const decimals = Number(await read(eth, token, "decimals"));
  const data = encodeFunctionData({
    abi,
    functionName: "mint",
    args: [account as Address, parseUnits(amount, decimals)],
  });
  return (await eth.request({
    method: "eth_sendTransaction",
    params: [{ from: account, to: token, data }],
  })) as string;
}

export async function zarpBalance({ eth, account, token }: TokenArgs) {
  const [decimals, balance] = await Promise.all([
    read(eth, token, "decimals"),
    read(eth, token, "balanceOf", [account]),
  ]);
  return formatUnits(balance, Number(decimals));
}

/** Polls for the transaction receipt: true once mined, false if it never shows up. */
export async function waitForReceipt(
  eth: Eth,
  hash: string,
  { intervalMs = 2000, attempts = 30 } = {},
): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    const receipt = (await eth.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    })) as { status?: string } | null;
    if (receipt) {
      if (receipt.status === "0x1") return true;
      throw new Error("The test ZARP mint failed on-chain.");
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
