import { parseAbi, type Address } from "viem";
import { TARGET_CHAIN_ID, TARGET_ZARM_ADDRESS } from "@/lib/chain";

// Frozen contract interface shared by the web branches. Source of truth: specs/INTERFACES.md §2.
// Change only together with that file and the contract.

export const CHAIN_ID = TARGET_CHAIN_ID;
export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS ?? "") as Address;
export const ZARM_ADDRESS = TARGET_ZARM_ADDRESS as Address;
export const ZARM_DECIMALS = 18;

export const PICKUP = 1;
export const DELIVERY = 2;

export const escrowAbi = parseAbi([
  "function createOrder(address supplier, uint256 total, uint256 driverAtPickup, uint256 supplierAtPickup, uint256 supplierAtDelivery, uint64 refundDeadline, bytes32 agreementHash) returns (uint256 orderId)",
  "function fundEscrow(uint256 orderId)",
  "function acceptOrder(uint256 orderId, bytes32 agreementHash)",
  "function assignDriver(uint256 orderId, address driver)",
  "function releaseHandoff(uint256 orderId, uint8 stage, bytes32 nonce, uint256 expiresAt, bytes32 evidenceHash, bytes giverSig, bytes receiverSig)",
  "function refund(uint256 orderId)",
  "function raiseDispute(uint256 orderId)",
  "function driverOf(uint256 orderId) view returns (address)",
  "function orderCounter() view returns (uint256)",
  "event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed supplier, uint256 total, bytes32 agreementHash)",
  "event EscrowFunded(uint256 indexed orderId, uint256 amount)",
  "event OrderAccepted(uint256 indexed orderId, address indexed supplier, bytes32 agreementHash)",
  "event DriverAssigned(uint256 indexed orderId, address indexed driver)",
  "event HandoffVerified(uint256 indexed orderId, uint8 stage, address indexed giver, address indexed receiver, bytes32 evidenceHash)",
  "event PaymentReleased(uint256 indexed orderId, uint8 stage, address indexed recipient, uint256 amount)",
  "event OrderRefunded(uint256 indexed orderId, address indexed buyer, uint256 amount)",
  "error SplitMismatch()",
  "error OrderTooLarge()",
  "error EnforcedPause()",
  "error InvalidAddress()",
  "error InvalidAmount()",
  "error NotBuyer()",
  "error NotSupplier()",
  "error NotAccepted()",
  "error AgreementMismatch()",
  "error DriverAlreadyAssigned()",
  "error DriverNotAssigned()",
  "error OrderNotFunded()",
  "error OrderInDispute()",
  "error InvalidState()",
  "error InvalidSignature()",
  "error HandoffExpired()",
  "error NonceUsed()",
  "error StageOutOfOrder()",
  "error RefundTooEarly()",
]);

export const zarmAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

export const handoffDomain = (verifyingContract: Address = ESCROW_ADDRESS) =>
  ({ name: "Patela Escrow", version: "1", chainId: CHAIN_ID, verifyingContract }) as const;

export const handoffTypes = {
  Handoff: [
    { name: "orderId", type: "uint256" },
    { name: "stage", type: "uint8" },
    { name: "giver", type: "address" },
    { name: "receiver", type: "address" },
    { name: "nonce", type: "bytes32" },
    { name: "expiresAt", type: "uint256" },
    { name: "evidenceHash", type: "bytes32" },
  ],
} as const;
