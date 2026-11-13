// Local fork of Celo Sepolia for rehearsals against the real ZARm contract, at no cost:
//   npx hardhat --config hardhat.fork.config.ts node --fork https://forno.celo-sepolia.celo-testnet.org --chain-id 11142220 --chain-type op
// Hardhat needs a hardfork history to execute calls on a fork of a chain it doesn't know.
import base from "./hardhat.config.js";

export default {
  ...base,
  chainDescriptors: {
    11142220: {
      name: "Celo Sepolia (local fork)",
      chainType: "op",
      hardforkHistory: { isthmus: { blockNumber: 0 } },
    },
  },
};
