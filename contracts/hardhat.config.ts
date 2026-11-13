import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const RPC_URL = process.env.RPC_URL || "https://forno.celo-sepolia.celo-testnet.org";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
    },
    celoSepolia: {
      type: "http",
      url: "https://forno.celo-sepolia.celo-testnet.org",
      accounts: [PRIVATE_KEY],
      chainId: 11142220,
    },
    celoMainnet: {
      type: "http",
      url: "https://forno.celo.org",
      accounts: [PRIVATE_KEY],
      chainId: 42220,
    },
    testnet: {
      type: "http",
      url: RPC_URL,
      accounts: [PRIVATE_KEY],
    },
  },
};

export default config;
