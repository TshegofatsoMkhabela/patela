import hre, { network } from "hardhat";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Deploys MockZARP, the registry, the tender trail and the escrow, then writes
// deployments/<network>.json with addresses and ABIs for the web app and backend.
// Usage: npx hardhat run scripts/deploy.ts --network baseSepolia

const connection = await network.connect();
const { viem, networkName } = connection;
const publicClient = await viem.getPublicClient();
const chainId = await publicClient.getChainId();

const zarp = await viem.deployContract("MockZARP");
const registry = await viem.deployContract("PatellaRegistry");
const tenderTrail = await viem.deployContract("PatellaTenderTrail", [registry.address]);
const escrow = await viem.deployContract("PatellaEscrowAndLogistics", [zarp.address, registry.address]);

const entry = async (name: string, address: string) => ({
  address,
  abi: (await hre.artifacts.readArtifact(name)).abi,
});

const deployment = {
  network: networkName,
  chainId,
  deployedAt: new Date().toISOString(),
  contracts: {
    MockZARP: await entry("MockZARP", zarp.address),
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
