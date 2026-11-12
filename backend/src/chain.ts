import {
  createPublicClient,
  decodeEventLog,
  http,
  type Address,
  type Hex,
} from "viem";
import { base, baseSepolia } from "viem/chains";

const escrowEvents = [
  {
    type: "event",
    name: "OrderFunded",
    inputs: [
      { name: "orderId", type: "bytes32", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "HandoffCompleted",
    inputs: [
      { name: "orderId", type: "bytes32", indexed: true },
      { name: "stage", type: "uint8", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OrderRefunded",
    inputs: [
      { name: "orderId", type: "bytes32", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export type ChainEvent = {
  name: "OrderFunded" | "HandoffCompleted" | "OrderRefunded";
  orderId: Hex;
  amountWei: bigint;
  actor: Address;
  token?: Address;
  stage?: number;
  chainId: number;
  txHash: Hex;
  logIndex: number;
  blockNumber: bigint;
  blockHash: Hex;
};

export interface ChainVerifier {
  events(txHash: Hex): Promise<ChainEvent[]>;
}

export class BaseChainVerifier implements ChainVerifier {
  private readonly client;

  constructor(
    rpcUrl: string,
    private readonly escrowAddress: Address,
    private readonly confirmations: number,
    private readonly chainId: 8453 | 84532 = 8453,
  ) {
    this.client = createPublicClient({ chain: chainId === 8453 ? base : baseSepolia, transport: http(rpcUrl) });
  }

  async events(txHash: Hex): Promise<ChainEvent[]> {
    if (await this.client.getChainId() !== this.chainId) throw new Error("RPC is connected to the wrong chain");
    const receipt = await this.client.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") throw new Error("Transaction reverted");
    const currentBlock = await this.client.getBlockNumber();
    if (currentBlock - receipt.blockNumber + 1n < BigInt(this.confirmations)) {
      throw new Error("Transaction is not sufficiently confirmed");
    }
    const found: ChainEvent[] = [];
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== this.escrowAddress.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: escrowEvents, data: log.data, topics: log.topics });
        const args = decoded.args as Record<string, unknown>;
        if (decoded.eventName === "OrderFunded") {
          found.push({
            name: decoded.eventName, orderId: args.orderId as Hex, amountWei: args.amount as bigint,
            actor: args.buyer as Address, token: args.token as Address, chainId: this.chainId,
            txHash, logIndex: log.logIndex, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash,
          });
        } else if (decoded.eventName === "HandoffCompleted") {
          found.push({
            name: decoded.eventName, orderId: args.orderId as Hex, amountWei: args.amount as bigint,
            actor: args.payee as Address, stage: Number(args.stage), chainId: this.chainId,
            txHash, logIndex: log.logIndex, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash,
          });
        } else if (decoded.eventName === "OrderRefunded") {
          found.push({
            name: decoded.eventName, orderId: args.orderId as Hex, amountWei: args.amount as bigint,
            actor: args.buyer as Address, chainId: this.chainId,
            txHash, logIndex: log.logIndex, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash,
          });
        }
      } catch {
        // Logs for unrelated events emitted by the same escrow are ignored.
      }
    }
    return found;
  }
}
