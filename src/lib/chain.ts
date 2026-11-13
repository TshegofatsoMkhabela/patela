// Buyer-side chain helpers: MetaMask (extension) on Celo Sepolia, Mento ZARm and the escrow.
// Every write is simulated on the public RPC first: that is where custom errors decode reliably
// (MetaMask's own gas estimate often drops the revert data), and nothing is sent if it would revert.
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEventLogs,
  parseUnits,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { baseSepolia, celo, celoSepolia, hardhat, type Chain } from "viem/chains";
import {
  CHAIN_ID,
  ESCROW_ADDRESS,
  ZARP_ADDRESS,
  ZARP_DECIMALS,
  escrowAbi,
  zarpAbi,
} from "./contracts";

export type ChainClients = {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Address;
  escrow: Address;
  zarp: Address;
};

export type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

// The token is Mento ZARm (South African rand, 18 decimals). Default network: Celo Sepolia
// (11142220, ZARm 0x10CCfB235b0E1Ed394bACE4560C3ed016697687e). contracts.ts still falls back to
// 84532 when NEXT_PUBLIC_CHAIN_ID is unset, so the env var must be set for EIP-712 domains to match.
const CHAINS: Record<number, Chain> = {
  [celoSepolia.id]: celoSepolia,
  [celo.id]: celo,
  [hardhat.id]: hardhat,
  [baseSepolia.id]: baseSepolia,
};
const chain: Chain =
  CHAINS[process.env.NEXT_PUBLIC_CHAIN_ID ? CHAIN_ID : celoSepolia.id] ?? celoSepolia;

export const NETWORK = {
  chain,
  name: chain.name,
  tokenSymbol: chain.id === hardhat.id ? "MockZARP" : "ZARm",
  explorer: chain.blockExplorers?.default.url.replace(/\/+$/, "") ?? "",
};

export const explorerTxUrl = (hash: string) =>
  NETWORK.explorer ? `${NETWORK.explorer}/tx/${hash}` : "";

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || chain.rpcUrls.default.http[0];
export const TEST_ZARP_AMOUNT = parseUnits("1000", ZARP_DECIMALS);
/** Real ZARm can't be minted; minting is only offered for MockZARP on a local Hardhat node. */
export const canMintTestToken = () => chain.id === hardhat.id;
export const contractsConfigured = () => Boolean(ESCROW_ADDRESS && ZARP_ADDRESS);

const activeChain = () => chain;

// ---------------------------------------------------------------------------------------------
// Error messages: one per custom error in the escrow ABI (a test guards against drift).

export const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  SplitMismatch: "SplitMismatch: the stage payments don't add up to the order total.",
  NotBuyer: "NotBuyer: only the buyer of this order can do that.",
  NotSupplier: "NotSupplier: only the supplier of this order can do that.",
  NotAccepted: "NotAccepted: the supplier hasn't accepted this order yet.",
  AgreementMismatch: "AgreementMismatch: the agreement doesn't match the one stored on-chain.",
  DriverAlreadyAssigned: "DriverAlreadyAssigned: a driver is already assigned to this order.",
  DriverNotAssigned: "DriverNotAssigned: no driver is assigned to this order yet.",
  OrderNotFunded: "OrderNotFunded: the escrow for this order isn't funded.",
  OrderInDispute: "OrderInDispute: this order is in dispute; payments are paused.",
  InvalidState: "InvalidState: the order isn't in the right state for this step (already funded?).",
  InvalidSignature: "InvalidSignature: a handoff signature didn't match the expected wallet.",
  HandoffExpired: "HandoffExpired: the handoff QR expired. Show a new one.",
  NonceUsed: "NonceUsed: this handoff was already used.",
  StageOutOfOrder: "StageOutOfOrder: stages must run in order (pickup before delivery).",
  RefundTooEarly: "RefundTooEarly: the refund deadline hasn't passed yet.",
};

export function contractErrorMessage(err: unknown): string {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError))
      return "Transaction cancelled in MetaMask.";
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name && CONTRACT_ERROR_MESSAGES[name]) return CONTRACT_ERROR_MESSAGES[name];
      if (name) return `${name}: the contract rejected this transaction.`;
      return reverted.reason
        ? `Reverted: ${reverted.reason}`
        : "The contract rejected this transaction.";
    }
    return err.shortMessage;
  }
  if (err && typeof err === "object" && (err as { code?: unknown }).code === 4001) {
    return "Transaction cancelled in MetaMask.";
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

// ---------------------------------------------------------------------------------------------
// MetaMask connection

/** Switch MetaMask to the app network, adding it first if MetaMask doesn't know it (4902). */
export async function ensureChain(eth: Eip1193, target: Chain = chain): Promise<void> {
  const hexId = `0x${target.id.toString(16)}`;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch (err) {
    const e = err as { code?: number; data?: { originalError?: { code?: number } } };
    const unknownChain = e.code === 4902 || e.data?.originalError?.code === 4902;
    if (!unknownChain) throw err;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexId,
          chainName: target.name,
          nativeCurrency: target.nativeCurrency,
          rpcUrls: [target.id === chain.id ? RPC_URL : target.rpcUrls.default.http[0]],
          ...(target.blockExplorers
            ? { blockExplorerUrls: [target.blockExplorers.default.url] }
            : {}),
        },
      ],
    });
  }
}

export function injectedProvider(): Eip1193 | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: Eip1193 }).ethereum;
}

export function createReadClient(): PublicClient {
  return createPublicClient({ chain: activeChain(), transport: http(RPC_URL) }) as PublicClient;
}

/** Ask MetaMask for an account, move it to the demo chain, and build the clients. Browser only. */
export async function connectMetaMask(): Promise<ChainClients> {
  const eth = injectedProvider();
  if (!eth)
    throw new Error("MetaMask not found. Install the MetaMask extension in Chrome and reload.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
  const account = accounts[0];
  if (!account) throw new Error("MetaMask returned no account.");
  if (chain.id !== hardhat.id) await ensureChain(eth);
  const walletClient = createWalletClient({
    account,
    chain: activeChain(),
    transport: custom(eth),
  });
  return {
    publicClient: createReadClient(),
    walletClient,
    account,
    escrow: ESCROW_ADDRESS,
    zarp: ZARP_ADDRESS,
  };
}

/** Sign the backend's /wallet/challenge typed data (uint fields arrive as strings). */
export async function signWalletLink(
  walletClient: Pick<WalletClient, "signTypedData">,
  account: Address,
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, readonly { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  },
): Promise<Hex> {
  const fields = typedData.types[typedData.primaryType] ?? [];
  const message: Record<string, unknown> = { ...typedData.message };
  for (const { name, type } of fields) {
    if (/^u?int\d*$/.test(type) && typeof message[name] === "string")
      message[name] = BigInt(message[name] as string);
  }
  return walletClient.signTypedData({
    account,
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message,
  } as Parameters<WalletClient["signTypedData"]>[0]);
}

// ---------------------------------------------------------------------------------------------
// Writes

type WriteArgs = {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
};

async function send(c: ChainClients, call: WriteArgs) {
  const { request } = await c.publicClient.simulateContract({
    ...call,
    account: c.account,
  } as never);
  const hash = await c.walletClient.writeContract(request as never);
  const receipt = await c.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted")
    throw new Error(`Transaction reverted: ${call.functionName} (${hash})`);
  return { hash, receipt };
}

export async function getTestZarp(
  c: ChainClients,
  amount: bigint = TEST_ZARP_AMOUNT,
): Promise<Hex> {
  const { hash } = await send(c, {
    address: c.zarp,
    abi: zarpAbi,
    functionName: "mint",
    args: [c.account, amount],
  });
  return hash;
}

/** 10% driver at pickup, 40% supplier at pickup, the remainder (≈50%) to the supplier at delivery. */
export function splitTotal(total: bigint) {
  const driverAtPickup = (total * 10n) / 100n;
  const supplierAtPickup = (total * 40n) / 100n;
  return {
    driverAtPickup,
    supplierAtPickup,
    supplierAtDelivery: total - driverAtPickup - supplierAtPickup,
  };
}

export type OrderParams = {
  supplier: Address;
  total: bigint;
  driverAtPickup: bigint;
  supplierAtPickup: bigint;
  supplierAtDelivery: bigint;
  refundDeadline: bigint;
  agreementHash: Hex;
  /** Set when createOrder already succeeded earlier: only approve + fund are retried. */
  existingOrderId?: bigint;
};

export type FundStep =
  | { step: "created"; orderId: bigint; txHash: Hex }
  | { step: "approved"; txHash: Hex }
  | { step: "funded"; txHash: Hex };

export type FundResult = {
  orderId: bigint;
  createTxHash?: Hex;
  approveTxHash: Hex;
  fundTxHash: Hex;
};

export async function createAndFundOrder(
  c: ChainClients,
  p: OrderParams,
  onStep: (s: FundStep) => void | Promise<void> = () => {},
): Promise<FundResult> {
  let orderId = p.existingOrderId;
  let createTxHash: Hex | undefined;
  if (orderId === undefined) {
    const created = await send(c, {
      address: c.escrow,
      abi: escrowAbi,
      functionName: "createOrder",
      args: [
        p.supplier,
        p.total,
        p.driverAtPickup,
        p.supplierAtPickup,
        p.supplierAtDelivery,
        p.refundDeadline,
        p.agreementHash,
      ],
    });
    const escrowLogs = created.receipt.logs.filter(
      (l) => l.address.toLowerCase() === c.escrow.toLowerCase(),
    );
    const [event] = parseEventLogs({ abi: escrowAbi, eventName: "OrderCreated", logs: escrowLogs });
    if (!event) throw new Error(`No OrderCreated event in ${created.hash}`);
    orderId = event.args.orderId;
    createTxHash = created.hash;
    await onStep({ step: "created", orderId, txHash: created.hash });
  }
  // Wait for the approve receipt before simulating fundEscrow, or the simulation sees no allowance.
  const approved = await send(c, {
    address: c.zarp,
    abi: zarpAbi,
    functionName: "approve",
    args: [c.escrow, p.total],
  });
  await onStep({ step: "approved", txHash: approved.hash });
  const funded = await send(c, {
    address: c.escrow,
    abi: escrowAbi,
    functionName: "fundEscrow",
    args: [orderId],
  });
  await onStep({ step: "funded", txHash: funded.hash });
  return {
    orderId,
    ...(createTxHash ? { createTxHash } : {}),
    approveTxHash: approved.hash,
    fundTxHash: funded.hash,
  } as FundResult;
}

// ---------------------------------------------------------------------------------------------
// Reads

export async function readBalances<K extends string>(
  publicClient: Pick<PublicClient, "readContract">,
  addresses: Record<K, string | null | undefined>,
  zarp: Address = ZARP_ADDRESS,
): Promise<Record<K, bigint | null>> {
  const keys = Object.keys(addresses) as K[];
  const values = await Promise.all(
    keys.map((k) => {
      const a = addresses[k];
      if (!a) return Promise.resolve(null);
      return publicClient.readContract({
        address: zarp,
        abi: zarpAbi,
        functionName: "balanceOf",
        args: [a as Address],
      }) as Promise<bigint>;
    }),
  );
  return Object.fromEntries(keys.map((k, i) => [k, values[i]])) as Record<K, bigint | null>;
}

/** Badge text for every buyer screen: real Mento ZARm on Celo, or a local MockZARP demo. */
export const NETWORK_LABEL =
  NETWORK.chain.id === hardhat.id
    ? "Local demo · MockZARP on Hardhat"
    : `Real ${NETWORK.tokenSymbol} on Celo · ${NETWORK.name}`;
