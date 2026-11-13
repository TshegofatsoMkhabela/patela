import { encodeFunctionData, isAddress, type Address, type Hex } from "viem";
import { ESCROW_ADDRESS, ZARM_ADDRESS, escrowAbi } from "@/lib/contracts";
import { TARGET_CHAIN_HEX, TARGET_CHAIN_NAME, type Eth } from "@/lib/chain";
import { approveZarm, waitForReceipt, zarmAllowance, zarmBalanceWei } from "@/lib/zarp";

type SendArgs = { eth: Eth; account: Address; escrow?: Address };

async function requireChain(eth: Eth) {
  const chainId = String(await eth.request({ method: "eth_chainId" })).toLowerCase();
  if (chainId !== TARGET_CHAIN_HEX) throw new Error(`Switch your wallet to ${TARGET_CHAIN_NAME}.`);
}

async function send(eth: Eth, account: Address, to: Address, data: Hex) {
  if (!isAddress(account) || !isAddress(to))
    throw new Error("Wallet or escrow address is not configured.");
  await requireChain(eth);
  return eth.request({
    method: "eth_sendTransaction",
    params: [{ from: account, to, data }],
  }) as Promise<Hex>;
}

export type OnchainOrder = {
  supplier: Address;
  totalWei: bigint;
  driverAtPickupWei: bigint;
  supplierAtPickupWei: bigint;
  supplierAtDeliveryWei: bigint;
  refundDeadline: bigint;
  agreementHash: Hex;
};

/** Creates the on-chain order after the supplier has accepted their email invitation. */
export function createOrderTransaction(
  { eth, account, escrow = ESCROW_ADDRESS }: SendArgs,
  order: OnchainOrder,
) {
  if (
    order.totalWei <= 0n ||
    order.driverAtPickupWei + order.supplierAtPickupWei + order.supplierAtDeliveryWei !==
      order.totalWei
  )
    throw new Error("Order payments must add up to the total.");
  return send(
    eth,
    account,
    escrow,
    encodeFunctionData({
      abi: escrowAbi,
      functionName: "createOrder",
      args: [
        order.supplier,
        order.totalWei,
        order.driverAtPickupWei,
        order.supplierAtPickupWei,
        order.supplierAtDeliveryWei,
        order.refundDeadline,
        order.agreementHash,
      ],
    }),
  );
}

/** Sets an exact total allowance when needed, then funds escrow after that approval confirms. */
export async function fundOrderTransaction(
  { eth, account, escrow = ESCROW_ADDRESS }: SendArgs,
  orderId: bigint,
  totalWei: bigint,
  token: Address = ZARM_ADDRESS,
) {
  if (totalWei <= 0n) throw new Error("Funding amount must be positive.");
  const balance = await zarmBalanceWei({ eth, account, token });
  if (balance < totalWei) throw new Error("Insufficient ZARm balance.");
  const allowance = await zarmAllowance({ eth, account, token, spender: escrow });
  let approvalHash: Hex | undefined;
  if (allowance < totalWei) {
    approvalHash = (await approveZarm({
      eth,
      account,
      token,
      spender: escrow,
      amountWei: totalWei,
    })) as Hex;
    if (!(await waitForReceipt(eth, approvalHash)))
      throw new Error("ZARm approval is still pending.");
  }
  const fundingHash = await send(
    eth,
    account,
    escrow,
    encodeFunctionData({ abi: escrowAbi, functionName: "fundEscrow", args: [orderId] }),
  );
  return { approvalHash, fundingHash };
}

export function acceptOrderTransaction(
  { eth, account, escrow = ESCROW_ADDRESS }: SendArgs,
  orderId: bigint,
  agreementHash: Hex,
) {
  return send(
    eth,
    account,
    escrow,
    encodeFunctionData({
      abi: escrowAbi,
      functionName: "acceptOrder",
      args: [orderId, agreementHash],
    }),
  );
}

export function assignDriverTransaction(
  { eth, account, escrow = ESCROW_ADDRESS }: SendArgs,
  orderId: bigint,
  driver: Address,
) {
  return send(
    eth,
    account,
    escrow,
    encodeFunctionData({ abi: escrowAbi, functionName: "assignDriver", args: [orderId, driver] }),
  );
}
