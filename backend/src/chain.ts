import {
  createPublicClient, decodeEventLog, http, parseAbi, type Address, type Hex,
} from "viem";
import { base, baseSepolia, hardhat } from "viem/chains";

/** Frozen escrow events (specs/INTERFACES.md §2; the web app's copy is src/lib/contracts.ts). */
export const escrowEventsAbi = parseAbi([
  "event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed supplier, uint256 total, bytes32 agreementHash)",
  "event EscrowFunded(uint256 indexed orderId, uint256 amount)",
  "event OrderAccepted(uint256 indexed orderId, address indexed supplier, bytes32 agreementHash)",
  "event DriverAssigned(uint256 indexed orderId, address indexed driver)",
  "event HandoffVerified(uint256 indexed orderId, uint8 stage, address indexed giver, address indexed receiver, bytes32 evidenceHash)",
  "event PaymentReleased(uint256 indexed orderId, uint8 stage, address indexed recipient, uint256 amount)",
  "event OrderRefunded(uint256 indexed orderId, address indexed buyer, uint256 amount)",
]);
const balanceAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

type EscrowEventName = (typeof escrowEventsAbi)[number]["name"];

/** One decoded escrow log. Fields not carried by an event are undefined. */
export type ChainEvent = {
  name: EscrowEventName;
  orderId: bigint;
  /** OrderCreated total, EscrowFunded/PaymentReleased/OrderRefunded amount. */
  amountWei?: bigint;
  stage?: number;
  buyer?: Address;
  supplier?: Address;
  driver?: Address;
  giver?: Address;
  receiver?: Address;
  recipient?: Address;
  agreementHash?: Hex;
  evidenceHash?: Hex;
  chainId: number;
  txHash: Hex;
  logIndex: number;
  blockNumber: bigint;
  blockHash: Hex;
};

export interface ChainVerifier {
  /** Escrow events in a confirmed, successful transaction. Throws if it is not confirmed yet. */
  events(txHash: Hex): Promise<ChainEvent[]>;
  /** Token balance for the four-wallet panel. Optional: the order view shows null without it. */
  balanceOf?(wallet: Address): Promise<bigint>;
}

type RawLog = { address: Address; data: Hex; topics: Hex[]; logIndex: number | null };
type ReceiptMeta = { chainId: number; txHash: Hex; blockNumber: bigint; blockHash: Hex };

/** Decodes the escrow's frozen events from a receipt's logs, skipping other contracts and unknown events. */
export function decodeEscrowLogs(logs: readonly RawLog[], escrowAddress: Address, meta: ReceiptMeta): ChainEvent[] {
  const found: ChainEvent[] = [];
  for (const log of logs) {
    if (log.address.toLowerCase() !== escrowAddress.toLowerCase()) continue;
    let decoded;
    try {
      decoded = decodeEventLog({ abi: escrowEventsAbi, data: log.data, topics: log.topics as [Hex, ...Hex[]] });
    } catch { continue; }
    const args = decoded.args as Record<string, unknown>;
    found.push({
      name: decoded.eventName,
      orderId: args.orderId as bigint,
      amountWei: (args.total ?? args.amount) as bigint | undefined,
      stage: args.stage === undefined ? undefined : Number(args.stage),
      buyer: args.buyer as Address | undefined,
      supplier: args.supplier as Address | undefined,
      driver: args.driver as Address | undefined,
      giver: args.giver as Address | undefined,
      receiver: args.receiver as Address | undefined,
      recipient: args.recipient as Address | undefined,
      agreementHash: args.agreementHash as Hex | undefined,
      evidenceHash: args.evidenceHash as Hex | undefined,
      ...meta, logIndex: log.logIndex ?? 0,
    });
  }
  return found;
}

export class BaseChainVerifier implements ChainVerifier {
  private readonly client;
  /** The RPC's chain never changes for a container, so it is checked once. */
  private chainChecked?: Promise<void>;

  constructor(
    rpcUrl: string,
    private readonly escrowAddress: Address,
    private readonly confirmations: number,
    private readonly chainId: 8453 | 84532 | 31337 = 8453,
    private readonly tokenAddress?: Address,
  ) {
    const chain = chainId === 8453 ? base : chainId === 84532 ? baseSepolia : hardhat;
    this.client = createPublicClient({ chain, transport: http(rpcUrl) });
  }

  async events(txHash: Hex): Promise<ChainEvent[]> {
    this.chainChecked ??= this.client.getChainId().then(id => {
      if (id !== this.chainId) throw new Error("RPC is connected to the wrong chain");
    }).catch(error => { this.chainChecked = undefined; throw error; });
    const [, receipt, currentBlock] = await Promise.all([this.chainChecked,
      this.client.getTransactionReceipt({ hash: txHash }), this.client.getBlockNumber()]);
    if (receipt.status !== "success") throw new Error("Transaction reverted");
    if (currentBlock - receipt.blockNumber + 1n < BigInt(this.confirmations)) {
      throw new Error("Transaction is not sufficiently confirmed");
    }
    return decodeEscrowLogs(receipt.logs, this.escrowAddress, {
      chainId: this.chainId, txHash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash,
    });
  }

  async balanceOf(wallet: Address): Promise<bigint> {
    if (!this.tokenAddress) throw new Error("Token address is not configured");
    return this.client.readContract({ address: this.tokenAddress, abi: balanceAbi, functionName: "balanceOf",
      args: [wallet] });
  }
}
