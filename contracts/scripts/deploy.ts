import hre, { network } from "hardhat";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAbi, parseUnits, type Address } from "viem";

// Uses the canonical Mento ZARm token on Celo, or deploys MockZARP locally, then writes
// deployments/<network>.json with addresses and ABIs for the web app and backend.
// Usage: npx hardhat run scripts/deploy.ts --network celoSepolia

const ZARM = {
  42220: "0x4c35853A3B4e647fD266f4de678dCc8fEC410BF6",
  11142220: "0x10CCfB235b0E1Ed394bACE4560C3ed016697687e",
} as const satisfies Record<number, Address>;
const tokenAbi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);

const connection = await network.connect();
const { viem, networkName } = connection;
const publicClient = await viem.getPublicClient();
const chainId = await publicClient.getChainId();
const maxOrderInput = process.env.MAX_ORDER_ZARM;
if (chainId !== 31337 && (!maxOrderInput || !/^\d+(\.\d{1,2})?$/.test(maxOrderInput))) {
  throw new Error("MAX_ORDER_ZARM is required for Celo deployments and must have at most two decimals");
}
const maxOrderAmount = parseUnits(chainId === 31337 ? "1000000000" : maxOrderInput!, 18);

let tokenAddress = ZARM[chainId as keyof typeof ZARM] as Address | undefined;
let mockZarpAddress: Address | undefined;
if (!tokenAddress) {
  const mockZarp = await viem.deployContract("MockZARP");
  mockZarpAddress = mockZarp.address;
  tokenAddress = mockZarpAddress;
} else {
  const code = await publicClient.getCode({ address: tokenAddress });
  if (!code) throw new Error(`No ZARm contract found at ${tokenAddress}`);
  const [symbol, decimals] = await Promise.all([
    publicClient.readContract({ address: tokenAddress, abi: tokenAbi, functionName: "symbol" }),
    publicClient.readContract({ address: tokenAddress, abi: tokenAbi, functionName: "decimals" }),
  ]);
  if (symbol !== "ZARm" || decimals !== 18) throw new Error(`Unexpected payment token ${symbol}/${decimals}`);
}
const registry = await viem.deployContract("PatellaRegistry");
const tenderTrail = await viem.deployContract("PatellaTenderTrail", [registry.address]);
const escrow = await viem.deployContract("PatellaEscrowAndLogistics", [
  tokenAddress,
  registry.address,
  maxOrderAmount,
]);

const entry = async (name: string, address: string) => ({
  address,
  abi: (await hre.artifacts.readArtifact(name)).abi,
});

const deployment = {
  network: networkName,
  chainId,
  deployedAt: new Date().toISOString(),
  paymentToken: {
    symbol: mockZarpAddress ? "MockZARP" : "ZARm",
    address: tokenAddress,
    decimals: 18,
  },
  maxOrderAmount: maxOrderAmount.toString(),
  contracts: {
    ...(mockZarpAddress
      ? { MockZARP: await entry("MockZARP", mockZarpAddress) }
      : { ZARm: { address: tokenAddress, abi: tokenAbi } }),
    PatellaRegistry: await entry("PatellaRegistry", registry.address),
    PatellaTenderTrail: await entry("PatellaTenderTrail", tenderTrail.address),
    PatellaEscrowAndLogistics: await entry("PatellaEscrowAndLogistics", escrow.address),
  },
};

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "deployments");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${networkName}.json`);
writeFileSync(outFile, JSON.stringify(deployment, null, 2));

console.log(`Deployed to ${networkName} (chain ${chainId}):`);
for (const [name, c] of Object.entries(deployment.contracts)) console.log(`  ${name}: ${c.address}`);
console.log(`Wrote ${outFile}`);
