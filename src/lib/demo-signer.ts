// LOCAL DEMO ONLY: the buyer, supplier and driver personas sign with Hardhat's well-known dev
// accounts (#1-#3; #0 deploys the contracts) when the app targets the local chain 31337, so the
// one-command demo needs no MetaMask and no Web3Auth project. These keys are public knowledge
// and hold value only on a throwaway local node; every function refuses any other chain.
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type TypedDataDefinition,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import type { ChainClients } from "./chain";
import { CHAIN_ID, ESCROW_ADDRESS, ZARP_ADDRESS, escrowAbi } from "./contracts";
import type { WalletSigner } from "./embedded-wallet";

export const LOCAL_CHAIN_ID = hardhat.id; // 31337

export type DemoPersona = "buyer" | "supplier" | "driver";

/** Hardhat's default mnemonic accounts #1, #2, #3 ("test test ... junk"). */
const DEMO_KEYS: Record<DemoPersona, Hex> = {
  buyer: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  supplier: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  driver: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
};

export const DEMO_EMAILS: Record<DemoPersona, string> = {
  buyer: "buyer@demo.patela.local",
  supplier: "supplier@demo.patela.local",
  driver: "driver@demo.patela.local",
};

/** True only on the local Hardhat chain. */
export const demoSignerAvailable = (chainId: number = CHAIN_ID) => chainId === LOCAL_CHAIN_ID;

function assertLocal(chainId: number) {
  if (!demoSignerAvailable(chainId)) {
    throw new Error(
      `Demo signers only work on the local chain ${LOCAL_CHAIN_ID}; this app targets ${chainId}. ` +
        "Connect a real wallet instead.",
    );
  }
}

export function demoAccount(persona: DemoPersona, chainId: number = CHAIN_ID) {
  assertLocal(chainId);
  return privateKeyToAccount(DEMO_KEYS[persona]);
}

const localRpc = () => process.env.NEXT_PUBLIC_RPC_URL || hardhat.rpcUrls.default.http[0];

/** Buyer-side clients (same shape as connectMetaMask) backed by a demo account. */
export function demoChainClients(
  persona: DemoPersona = "buyer",
  chainId: number = CHAIN_ID,
): ChainClients {
  const account = demoAccount(persona, chainId);
  const transport = http(localRpc());
  return {
    publicClient: createPublicClient({ chain: hardhat, transport }) as PublicClient,
    walletClient: createWalletClient({ account, chain: hardhat, transport }),
    account: account.address,
    escrow: ESCROW_ADDRESS,
    zarp: ZARP_ADDRESS,
  };
}

/** Handoff/acceptance signer (same shape as the embedded wallet) backed by a demo account. */
export function demoWalletSigner(
  persona: DemoPersona,
  opts: { chainId?: number; escrow?: Address } = {},
): WalletSigner {
  const chainId = opts.chainId ?? CHAIN_ID;
  const account = demoAccount(persona, chainId);
  const escrow = opts.escrow ?? ESCROW_ADDRESS;
  const transport = http(localRpc());
  const wallet = createWalletClient({ account, chain: hardhat, transport });
  const reader = createPublicClient({ chain: hardhat, transport });
  return {
    kind: "demo",
    address: account.address,
    signTypedData: (td) => account.signTypedData(td as TypedDataDefinition),
    writeEscrow: (call) =>
      wallet.writeContract({ address: escrow, abi: escrowAbi, ...call } as never) as Promise<Hex>,
    async waitForReceipt(hash) {
      const receipt = await reader.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`Transaction ${hash} reverted`);
    },
  };
}
