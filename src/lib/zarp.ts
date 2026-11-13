// Browser helpers for the real Mento ZARm ERC-20. No mint method is exposed:
// buyers acquire ZARm separately and approve only the exact escrow amount.

import {
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { TARGET_CHAIN_HEX, TARGET_CHAIN_NAME, type Eth } from "@/lib/chain";

const abi = [
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
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

type TokenArgs = { eth: Eth; account: string; token: string };

function requireAddresses(account: string, token: string, spender?: string) {
  if (!isAddress(account) || !isAddress(token) || (spender !== undefined && !isAddress(spender))) {
    throw new Error("Wallet, token, or escrow address is not configured.");
  }
}

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

export async function zarmBalanceWei({ eth, account, token }: TokenArgs) {
  requireAddresses(account, token);
  await requireTargetChain(eth);
  return balanceOf(eth, token, account);
}

export async function zarmAllowance({
  eth,
  account,
  token,
  spender,
}: TokenArgs & { spender: string }) {
  requireAddresses(account, token, spender);
  await requireTargetChain(eth);
  const data = await call(
    eth,
    token,
    encodeFunctionData({
      abi,
      functionName: "allowance",
      args: [account as Address, spender as Address],
    }),
  );
  return decodeFunctionResult({ abi, functionName: "allowance", data });
}

async function requireTargetChain(eth: Eth) {
  const chainId = (await eth.request({ method: "eth_chainId" })) as string;
  if (chainId.toLowerCase() !== TARGET_CHAIN_HEX) {
    throw new Error(`Switch your wallet to ${TARGET_CHAIN_NAME}.`);
  }
}

export async function approveZarm({
  eth,
  account,
  token,
  spender,
  amountWei,
}: TokenArgs & {
  spender: string;
  amountWei: bigint;
}) {
  if (amountWei <= 0n) throw new Error("Approval amount must be positive.");
  requireAddresses(account, token, spender);
  await requireTargetChain(eth);
  const data = encodeFunctionData({
    abi,
    functionName: "approve",
    args: [spender as Address, amountWei],
  });
  return (await eth.request({
    method: "eth_sendTransaction",
    params: [{ from: account, to: token, data }],
  })) as string;
}

export async function zarmBalance({ eth, account, token }: TokenArgs) {
  requireAddresses(account, token);
  await requireTargetChain(eth);
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
      throw new Error("The transaction failed on-chain.");
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
