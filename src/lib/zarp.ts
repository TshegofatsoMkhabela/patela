// Testnet-only helpers for MockZARP (contracts/contracts/MockZARP.sol), whose
// mint(to, amount) is open to anyone. The buyer's own wallet sends the mint,
// so no Patela key is involved. Never point this at real ZARP.
// Load this module lazily: it brings in viem.

import {
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { BASE_SEPOLIA_HEX, type Eth } from "@/lib/chain-basics";

const abi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

type TokenArgs = { eth: Eth; account: string; token: string };

const call = (eth: Eth, token: string, data: Hex) =>
  eth.request({ method: "eth_call", params: [{ to: token, data }, "latest"] }) as Promise<Hex>;

async function decimals(eth: Eth, token: string) {
  const data = await call(eth, token, encodeFunctionData({ abi, functionName: "decimals" }));
  return decodeFunctionResult({ abi, functionName: "decimals", data });
}

async function balanceOf(eth: Eth, token: string, account: string) {
  const data = await call(
    eth,
    token,
    encodeFunctionData({ abi, functionName: "balanceOf", args: [account as Address] }),
  );
  return decodeFunctionResult({ abi, functionName: "balanceOf", data });
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
  const data = encodeFunctionData({
    abi,
    functionName: "mint",
    args: [account as Address, parseUnits(amount, await decimals(eth, token))],
  });
  return (await eth.request({
    method: "eth_sendTransaction",
    params: [{ from: account, to: token, data }],
  })) as string;
}

export async function zarpBalance({ eth, account, token }: TokenArgs) {
  const [places, balance] = await Promise.all([
    decimals(eth, token),
    balanceOf(eth, token, account),
  ]);
  return formatUnits(balance, places);
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
