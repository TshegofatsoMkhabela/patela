import { ethers, artifacts, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const MockZARP = await ethers.getContractFactory("MockZARP");
  const zarp = await MockZARP.deploy();
  await zarp.waitForDeployment();
  const zarpAddress = await zarp.getAddress();

  const Registry = await ethers.getContractFactory("PatellaRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();

  const TenderTrail = await ethers.getContractFactory("PatellaTenderTrail");
  const tenderTrail = await TenderTrail.deploy(registryAddress);
  await tenderTrail.waitForDeployment();
  const tenderAddress = await tenderTrail.getAddress();

  const Escrow = await ethers.getContractFactory("PatellaEscrowAndLogistics");
  const escrow = await Escrow.deploy(zarpAddress, registryAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();

  const deploymentData = {
    network: network.name,
    deployedAt: new Date().toISOString(),
    contracts: {
      MockZARP: {
        address: zarpAddress,
        abi: (await artifacts.readArtifact("MockZARP")).abi,
      },
      PatellaRegistry: {
        address: registryAddress,
        abi: (await artifacts.readArtifact("PatellaRegistry")).abi,
      },
      PatellaTenderTrail: {
        address: tenderAddress,
        abi: (await artifacts.readArtifact("PatellaTenderTrail")).abi,
      },
      PatellaEscrowAndLogistics: {
        address: escrowAddress,
        abi: (await artifacts.readArtifact("PatellaEscrowAndLogistics")).abi,
      },
    },
  };

  const outDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "latest.json"), JSON.stringify(deploymentData, null, 2));

  console.log("Deployed successfully to", network.name);
  console.log({ zarpAddress, registryAddress, tenderAddress, escrowAddress });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

