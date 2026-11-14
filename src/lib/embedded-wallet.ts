import {
  createWalletClient,
  custom,
  recoverTypedDataAddress,
  toHex,
  type Address,
  type Chain,
  type Hex,
  type TypedData,
  type TypedDataDefinition,
} from "viem";
import { ESCROW_ADDRESS, escrowAbi } from "@/lib/contracts";
import { NETWORK, createReadClient, ensureChain } from "@/lib/escrow-chain";

// Wallets that sign handoffs and send escrow calls, on the app's network (NETWORK in escrow-chain.ts).
// - Supplier and driver: MetaMask Embedded Wallets (Web3Auth v11), email passwordless login, EIP-7702
//   MetaMask smart account. The address stays the user's EOA, typed-data signatures are plain ECDSA
//   (so backend /wallet/link and the contract's SignatureChecker both accept them before any deploy),
//   and transactions go through the bundler + paymaster configured for the project in the dashboard.
// - Buyer: the MetaMask extension (window.ethereum), signing only.

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
};

export type EscrowWrite =
  | { functionName: "acceptOrder"; args: readonly [bigint, Hex] }
  | { functionName: "assignDriver"; args: readonly [bigint, Address] }
  | { functionName: "releaseHandoff"; args: readonly [bigint, number, Hex, bigint, Hex, Hex, Hex] };

export type WalletKind = "embedded" | "extension";

export type WalletSigner = {
  kind: WalletKind;
  address: Address;
  signTypedData<
    const T extends TypedData | Record<string, unknown>,
    P extends keyof T | "EIP712Domain",
  >(
    td: TypedDataDefinition<T, P>,
  ): Promise<Hex>;
  /** Sends an escrow call (sponsored for the embedded wallet) and returns the transaction hash. */
  writeEscrow(call: EscrowWrite): Promise<Hex>;
  /** Resolves once mined; throws if the transaction reverted. */
  waitForReceipt(hash: Hex): Promise<void>;
};

type ReceiptClient = {
  waitForTransactionReceipt(args: { hash: Hex }): Promise<{ status: "success" | "reverted" }>;
};

type Env = Partial<Record<"NEXT_PUBLIC_WEB3AUTH_CLIENT_ID" | "NEXT_PUBLIC_RPC_URL", string>>;

// Next only inlines NEXT_PUBLIC_* when referenced literally.
const publicEnv = (): Env => ({
  NEXT_PUBLIC_WEB3AUTH_CLIENT_ID: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
});

export function embeddedWalletOptions(env: Env = publicEnv(), chain: Chain = NETWORK.chain) {
  const clientId = env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
  if (!clientId) throw new Error("NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is not set");
  const chainId = toHex(chain.id);
  return {
    clientId,
    web3AuthNetwork: "sapphire_devnet" as const,
    defaultChainId: chainId,
    // Described in full: the dashboard pre-configures only some chains (Celo Sepolia may not be one).
    chains: [
      {
        chainNamespace: "eip155" as const,
        chainId,
        rpcTarget: env.NEXT_PUBLIC_RPC_URL || chain.rpcUrls.default.http[0],
        displayName: chain.name,
        blockExplorerUrl: chain.blockExplorers?.default.url ?? "",
        ticker: chain.nativeCurrency.symbol,
        tickerName: chain.nativeCurrency.name,
        logo: "https://images.toruswallet.io/eth.svg",
      },
    ],
    // Bundler and paymaster URLs come from the dashboard (Smart accounts > Bundler & Paymaster),
    // deep-merged with this by the SDK.
    accountAbstractionConfig: {
      smartAccountType: "metamask" as const,
      smartAccountEipStandard: "7702" as const,
    },
  };
}

export async function signerFromProvider(
  provider: Eip1193Provider,
  kind: WalletKind,
  opts: { escrow?: Address; chain?: Chain; publicClient?: ReceiptClient } = {},
): Promise<WalletSigner> {
  const escrow = opts.escrow ?? ESCROW_ADDRESS;
  const chain = opts.chain ?? NETWORK.chain;
  if (kind === "extension") await ensureChain(provider as Parameters<typeof ensureChain>[0], chain);

  const wallet = createWalletClient({ chain, transport: custom(provider) });
  const [address] =
    kind === "extension" ? await wallet.requestAddresses() : await wallet.getAddresses();
  if (!address) throw new Error("The wallet returned no account");
  let receipts = opts.publicClient;

  return {
    kind,
    address,
    async signTypedData(td) {
      const signature = await wallet.signTypedData({
        account: address,
        ...(td as TypedDataDefinition),
      });
      const signer = await recoverTypedDataAddress({ ...(td as TypedDataDefinition), signature });
      if (signer.toLowerCase() !== address.toLowerCase()) {
        throw new Error(
          "The wallet signed as a smart-contract account, not its EOA. Set the embedded wallet to an " +
            "EIP-7702 MetaMask smart account in the dashboard.",
        );
      }
      return signature;
    },
    writeEscrow(call) {
      // value is explicit: the SDK's smart-account path calls BigInt(value) on it.
      return wallet.writeContract({
        account: address,
        address: escrow,
        abi: escrowAbi,
        value: 0n,
        ...call,
      } as never);
    },
    async waitForReceipt(hash) {
      receipts ??= createReadClient();
      const receipt = await receipts.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`Transaction ${hash} reverted`);
    },
  };
}

/** Buyer's MetaMask extension. */
export async function connectExtensionWallet(): Promise<WalletSigner> {
  const ethereum = (globalThis as { ethereum?: Eip1193Provider }).ethereum;
  if (!ethereum) throw new Error("MetaMask extension not found in this browser");
  return signerFromProvider(ethereum, "extension");
}

type Web3AuthInstance = InstanceType<typeof import("@web3auth/modal").Web3Auth>;
let web3auth: Promise<Web3AuthInstance> | undefined;

function loadWeb3Auth() {
  // Loaded on demand so neither SSR nor tests pull in the SDK.
  web3auth ??= import("@web3auth/modal").then(async ({ Web3Auth }) => {
    const instance = new Web3Auth(embeddedWalletOptions());
    await instance.init();
    return instance;
  });
  return web3auth;
}

/**
 * Signs in with MetaMask Embedded Wallets by email code and returns the wallet. Reuses an existing
 * session only when it belongs to the same email.
 */
export async function connectEmbeddedWallet(email: string): Promise<WalletSigner> {
  const { WALLET_CONNECTORS, AUTH_CONNECTION } = await import("@web3auth/modal");
  const instance = await loadWeb3Auth();

  if (instance.connected) {
    const info = await instance.getUserInfo().catch(() => ({}) as { email?: string });
    if (info.email?.toLowerCase() !== email.toLowerCase()) await instance.logout();
  }
  const connection = instance.connected
    ? instance.connection
    : await instance.connectTo(WALLET_CONNECTORS.AUTH, {
        authConnection: AUTH_CONNECTION.EMAIL_PASSWORDLESS,
        loginHint: email,
      });
  const provider = connection?.ethereumProvider;
  if (!provider) throw new Error("Embedded wallet sign-in did not complete");
  return signerFromProvider(provider as Eip1193Provider, "embedded");
}

export async function disconnectEmbeddedWallet() {
  const instance = await web3auth;
  if (instance?.connected) await instance.logout();
}
