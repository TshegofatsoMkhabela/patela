import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeAbiParameters,
  encodeEventTopics,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { decodeEscrowLogs, escrowEventsAbi } from "../src/chain.js";

const escrow = "0x1111111111111111111111111111111111111111" as Address;
const buyer = "0x00000000000000000000000000000000000000b1" as Address;
const supplier = "0x00000000000000000000000000000000000000a1" as Address;
const meta = {
  chainId: 84532,
  txHash: `0x${"ab".repeat(32)}` as Hex,
  blockNumber: 9n,
  blockHash: `0x${"cd".repeat(32)}` as Hex,
};
const agreementHash = keccak256(toBytes("agreement"));

function log(
  eventName: "OrderCreated" | "HandoffVerified",
  args: Record<string, unknown>,
  data: Hex,
  address: Address = escrow,
  logIndex = 0,
) {
  const topics = encodeEventTopics({ abi: escrowEventsAbi, eventName, args } as never) as [
    Hex,
    ...Hex[],
  ];
  return { address, topics, data, logIndex };
}

test("decodes the frozen escrow events with uint256 order IDs and bytes32 hashes", () => {
  const created = log(
    "OrderCreated",
    { orderId: 2n ** 200n, buyer, supplier },
    encodeAbiParameters([{ type: "uint256" }, { type: "bytes32" }], [10n ** 21n, agreementHash]),
  );
  const verified = log(
    "HandoffVerified",
    { orderId: 7n, giver: supplier, receiver: buyer },
    encodeAbiParameters([{ type: "uint8" }, { type: "bytes32" }], [1, agreementHash]),
    escrow,
    1,
  );
  const [orderCreated, handoff] = decodeEscrowLogs([created, verified], escrow, meta);
  assert.equal(orderCreated.name, "OrderCreated");
  assert.equal(orderCreated.orderId, 2n ** 200n);
  assert.equal(orderCreated.amountWei, 10n ** 21n);
  assert.equal(orderCreated.buyer?.toLowerCase(), buyer);
  assert.equal(orderCreated.supplier?.toLowerCase(), supplier);
  assert.equal(orderCreated.agreementHash, agreementHash);
  assert.equal(orderCreated.chainId, 84532);
  assert.equal(handoff.name, "HandoffVerified");
  assert.equal(handoff.stage, 1);
  assert.equal(handoff.giver?.toLowerCase(), supplier);
  assert.equal(handoff.evidenceHash, agreementHash);
  assert.equal(handoff.logIndex, 1);
});

test("ignores logs from other contracts and events it does not index", () => {
  const foreign = log(
    "OrderCreated",
    { orderId: 1n, buyer, supplier },
    encodeAbiParameters([{ type: "uint256" }, { type: "bytes32" }], [1n, agreementHash]),
    "0x9999999999999999999999999999999999999999",
  );
  const unrelated = {
    address: escrow,
    topics: [keccak256(toBytes("Other(uint256)"))] as [Hex],
    data: "0x" as Hex,
    logIndex: 3,
  };
  assert.deepEqual(decodeEscrowLogs([foreign, unrelated], escrow, meta), []);
});
