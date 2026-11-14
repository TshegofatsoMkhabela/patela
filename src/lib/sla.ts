import { getAddress, isAddress, keccak256, toBytes, verifyMessage } from "viem";
import type { OrderDetail } from "@/lib/api";
import { NETWORK } from "@/lib/chain";
import { ESCROW_ADDRESS } from "@/lib/contracts";
import { partyAddresses } from "@/app/orders/[id]/order-data";

export type SlaRecord = {
  version: 1;
  signedAt: string;
  orderId: string;
  chainOrderId: string;
  chainId: number;
  network: string;
  contractAddress: string;
  contractUrl: string;
  buyerEmail: string;
  buyerWallet: string;
  supplierEmail: string;
  supplierWallet: string;
  agreementText: string;
  agreementHash: string;
  totalWei: string;
  driverAtPickupWei: string;
  supplierAtPickupWei: string;
  supplierAtDeliveryWei: string;
  refundDeadline: string;
  supplierAccepted: boolean;
};

const value = (v: unknown) => (v === undefined || v === null ? "" : String(v));

export function createSlaRecord(order: OrderDetail): SlaRecord {
  const addresses = partyAddresses(order, ESCROW_ADDRESS);
  const contractAddress = value(order.escrowAddress || ESCROW_ADDRESS);
  if (
    !order.chainOrderId ||
    !isAddress(contractAddress) ||
    !addresses.buyer ||
    !isAddress(addresses.buyer)
  ) {
    throw new Error("The chain order and buyer wallet must be recorded before signing the SLA.");
  }
  if (!order.agreementText || keccak256(toBytes(order.agreementText)) !== order.agreementHash) {
    throw new Error("The agreement text does not match its on-chain fingerprint.");
  }
  if (order.chainId && Number(order.chainId) !== NETWORK.chain.id) {
    throw new Error("Switch to the order's blockchain network before signing its SLA.");
  }
  const supplierAccepted = (order.timeline ?? []).some((event) => event.event === "OrderAccepted");
  return {
    version: 1,
    signedAt: new Date().toISOString(),
    orderId: order.id,
    chainOrderId: value(order.chainOrderId),
    chainId: Number(order.chainId || NETWORK.chain.id),
    network: NETWORK.name,
    contractAddress: getAddress(contractAddress),
    contractUrl: NETWORK.explorer
      ? `${NETWORK.explorer}/address/${getAddress(contractAddress)}`
      : "",
    buyerEmail: value(order.parties?.buyer?.email),
    buyerWallet: getAddress(addresses.buyer),
    supplierEmail: value(order.parties?.supplier?.email || order.supplierEmail),
    supplierWallet:
      addresses.supplier && isAddress(addresses.supplier) ? getAddress(addresses.supplier) : "",
    agreementText: value(order.agreementText),
    agreementHash: value(order.agreementHash),
    totalWei: value(order.totalWei),
    driverAtPickupWei: value(order.driverAtPickupWei),
    supplierAtPickupWei: value(order.supplierAtPickupWei),
    supplierAtDeliveryWei: value(order.supplierAtDeliveryWei),
    refundDeadline: value(order.refundDeadline),
    supplierAccepted,
  };
}

export function slaApprovalMessage(record: SlaRecord): string {
  const recordHash = keccak256(toBytes(JSON.stringify(record)));
  return [
    "Patela service level agreement - buyer approval",
    "Version: 1",
    `Order: ${record.orderId}`,
    `Chain ID: ${record.chainId}`,
    `Escrow contract: ${record.contractAddress}`,
    `Buyer wallet: ${record.buyerWallet}`,
    `SLA record hash: ${recordHash}`,
    "I approve the SLA record identified by this hash as the buyer.",
  ].join("\n");
}

export async function verifySlaSignature(record: SlaRecord, signature: `0x${string}`) {
  return verifyMessage({
    address: record.buyerWallet as `0x${string}`,
    message: slaApprovalMessage(record),
    signature,
  });
}
