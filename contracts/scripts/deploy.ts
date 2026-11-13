import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const RPC_URL = process.env.RPC_URL || "https://forno.celo-sepolia.celo-testnet.org";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

if (!PRIVATE_KEY || PRIVATE_KEY.includes("YOUR_PRIVATE_KEY")) {
  console.error("ERROR: DEPLOYER_PRIVATE_KEY is missing or invalid in contracts/.env");
  process.exit(1);
}

function loadArtifact(contractName: string) {
  const artifactPath = path.resolve(__dirname, `../artifacts/contracts/${contractName}.sol/${contractName}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}. Run 'npx hardhat compile' first!`);
  }
  return JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(PRIVATE_KEY, provider);

  const balance = await provider.getBalance(deployer.address);
  const network = await provider.getNetwork();

  console.log(`\n========================================`);
  console.log(`Deploying Patella Protocol to: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`Deployer Balance: ${ethers.formatEther(balance)} CELO`);
  console.log(`========================================\n`);

  if (balance === 0n) {
    console.error("ERROR: Deployer wallet balance is 0 CELO. Fund your wallet at: https://faucet.celo.org/celo-sepolia");
    process.exit(1);
  }

  let czarTokenAddress = process.env.CZAR_TOKEN_ADDRESS?.trim();
  const czarArtifact = loadArtifact("CZARToken");

  // 1. CZARToken
  if (!czarTokenAddress || czarTokenAddress === "" || czarTokenAddress === ethers.ZeroAddress) {
    console.log("No external CZAR_TOKEN_ADDRESS provided. Deploying CZARToken (CZAR) on Celo Sepolia...");
    const factory = new ethers.ContractFactory(czarArtifact.abi, czarArtifact.bytecode, deployer);
    const initialSupply = ethers.parseUnits("10000000", 18);
    const czarContract = await factory.deploy(initialSupply);
    await czarContract.waitForDeployment();
    czarTokenAddress = await czarContract.getAddress();
    console.log(`> CZARToken deployed at: ${czarTokenAddress}`);
    console.log(`> Minted 10,000,000 CZAR to deployer: ${deployer.address}`);
  } else {
    console.log(`Using existing CZAR Token at: ${czarTokenAddress}`);
  }

  // 2. PatellaRegistry
  console.log("\nDeploying PatellaRegistry...");
  const registryArtifact = loadArtifact("PatellaRegistry");
  const registryFactory = new ethers.ContractFactory(registryArtifact.abi, registryArtifact.bytecode, deployer);
  const registry = await registryFactory.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`> PatellaRegistry deployed at: ${registryAddress}`);

  // 3. PatellaTenderTrail
  console.log("\nDeploying PatellaTenderTrail...");
  const tenderArtifact = loadArtifact("PatellaTenderTrail");
  const tenderFactory = new ethers.ContractFactory(tenderArtifact.abi, tenderArtifact.bytecode, deployer);
  const tenderTrail = await tenderFactory.deploy(registryAddress);
  await tenderTrail.waitForDeployment();
  const tenderAddress = await tenderTrail.getAddress();
  console.log(`> PatellaTenderTrail deployed at: ${tenderAddress}`);

  // 4. PatellaEscrowAndLogistics
  console.log("\nDeploying PatellaEscrowAndLogistics...");
  const escrowArtifact = loadArtifact("PatellaEscrowAndLogistics");
  const escrowFactory = new ethers.ContractFactory(escrowArtifact.abi, escrowArtifact.bytecode, deployer);
  const escrow = await escrowFactory.deploy(czarTokenAddress, registryAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`> PatellaEscrowAndLogistics deployed at: ${escrowAddress}`);

  const deploymentData = {
    network: "celoSepolia",
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    tokens: {
      CZAR: czarTokenAddress,
    },
    contracts: {
      CZARToken: {
        address: czarTokenAddress,
        abi: czarArtifact.abi,
      },
      PatellaRegistry: {
        address: registryAddress,
        abi: registryArtifact.abi,
      },
      PatellaTenderTrail: {
        address: tenderAddress,
        abi: tenderArtifact.abi,
      },
      PatellaEscrowAndLogistics: {
        address: escrowAddress,
        abi: escrowArtifact.abi,
      },
    },
  };

  const outDir = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "latest.json"), JSON.stringify(deploymentData, null, 2));

  console.log("\n========================================");
  console.log("Deployment complete! Exported to contracts/deployments/latest.json");
  console.log("========================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
