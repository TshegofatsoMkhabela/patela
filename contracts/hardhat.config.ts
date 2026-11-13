import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, type HardhatUserConfig } from "hardhat/config";

// Secrets are read with configVariable, from the Hardhat keystore or an
// environment variable of the same name, only when a network command needs them.
// Nothing secret is stored in this file.
const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    celoSepolia: {
      type: "http",
      chainType: "op",
      chainId: 11142220,
      url: configVariable("CELO_SEPOLIA_RPC_URL"),
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
    celo: {
      type: "http",
      chainType: "op",
      chainId: 42220,
      url: configVariable("CELO_RPC_URL"),
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
  },
};

export default config;
