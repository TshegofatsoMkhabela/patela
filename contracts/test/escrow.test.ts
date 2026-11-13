import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, parseUnits, toHex, type Address } from "viem";

// Spec: specs/SPEC-demo-order-flow.md, contract cycle 1 (scenarios 1-5).
// Flow: buyer funds; supplier hands the box to the driver (pickup, stage 1);
// driver hands it to the buyer (delivery, stage 2).

const { viem, networkHelpers } = await network.connect();

const ZARP = (n: string) => parseUnits(n, 18);
const TOTAL = ZARP("1000");
const DRIVER_AT_PICKUP = ZARP("100"); // 10%
const SUPPLIER_AT_PICKUP = ZARP("400"); // 40%
const SUPPLIER_AT_DELIVERY = ZARP("500"); // 50%
const PICKUP = 1;
const ONE_DAY = 24n * 60n * 60n;

async function deployFixture() {
  const [deployer, buyer, supplier, driver, stranger, stranger2] = await viem.getWalletClients();
  const zarp = await viem.deployContract("MockZARP");
  const registry = await viem.deployContract("PatellaRegistry");
  const escrow = await viem.deployContract("PatellaEscrowAndLogistics", [zarp.address, registry.address]);
  await zarp.write.mint([buyer.account.address, TOTAL]);
  await zarp.write.approve([escrow.address, TOTAL], { account: buyer.account });
  const now = BigInt(await networkHelpers.time.latest());
  return { deployer, buyer, supplier, driver, stranger, stranger2, zarp, escrow, refundDeadline: now + ONE_DAY };
}

type Fixture = Awaited<ReturnType<typeof deployFixture>>;

async function createOrder(f: Fixture, supplierAtDelivery = SUPPLIER_AT_DELIVERY) {
  await f.escrow.write.createOrder(
    [f.supplier.account.address, TOTAL, DRIVER_AT_PICKUP, SUPPLIER_AT_PICKUP, supplierAtDelivery, f.refundDeadline],
    { account: f.buyer.account },
  );
  return f.escrow.read.orderCounter();
}

async function fundedOrderWithDriver(f: Fixture) {
  const orderId = await createOrder(f);
  await f.escrow.write.fundEscrow([orderId], { account: f.buyer.account });
  await f.escrow.write.assignDriver([orderId, f.driver.account.address], { account: f.supplier.account });
  return orderId;
}

async function signHandoff(
  f: Fixture,
  signer: Fixture["buyer"],
  message: { orderId: bigint; stage: number; giver: Address; receiver: Address; nonce: `0x${string}`; expiresAt: bigint },
) {
  const publicClient = await viem.getPublicClient();
  return signer.signTypedData({
    account: signer.account,
    domain: { name: "Patela Escrow", version: "1", chainId: await publicClient.getChainId(), verifyingContract: f.escrow.address },
    types: {
      Handoff: [
        { name: "orderId", type: "uint256" },
        { name: "stage", type: "uint8" },
        { name: "giver", type: "address" },
        { name: "receiver", type: "address" },
        { name: "nonce", type: "bytes32" },
        { name: "expiresAt", type: "uint256" },
      ],
    },
    primaryType: "Handoff",
    message,
  });
}

function pickupMessage(f: Fixture, orderId: bigint) {
  return {
    orderId,
    stage: PICKUP,
    giver: f.supplier.account.address,
    receiver: f.driver.account.address,
    nonce: keccak256(toHex(`pickup-${orderId}`)),
    expiresAt: f.refundDeadline,
  };
}

const balance = (f: Fixture, who: Address) => f.zarp.read.balanceOf([who]);

describe("PatellaEscrowAndLogistics — cycle 1", () => {
  it("rejects creating an order whose splits don't add up to the total", async () => {
    const f = await networkHelpers.loadFixture(deployFixture);
    await viem.assertions.revertWithCustomError(createOrder(f, ZARP("499")), f.escrow, "SplitMismatch");
  });

  it("moves exactly the order total from the buyer into escrow when the buyer funds it", async () => {
    const f = await networkHelpers.loadFixture(deployFixture);
    const orderId = await createOrder(f);
    const buyerBefore = await balance(f, f.buyer.account.address);
    const escrowBefore = await balance(f, f.escrow.address);

    await f.escrow.write.fundEscrow([orderId], { account: f.buyer.account });

    assert.equal(buyerBefore - (await balance(f, f.buyer.account.address)), TOTAL);
    assert.equal((await balance(f, f.escrow.address)) - escrowBefore, TOTAL);
  });

  it("lets only the supplier assign the driver, and only once", async () => {
    const f = await networkHelpers.loadFixture(deployFixture);
    const orderId = await createOrder(f);
    await f.escrow.write.fundEscrow([orderId], { account: f.buyer.account });

    await viem.assertions.revertWithCustomError(
      f.escrow.write.assignDriver([orderId, f.driver.account.address], { account: f.stranger.account }),
      f.escrow,
      "NotSupplier",
    );

    await f.escrow.write.assignDriver([orderId, f.driver.account.address], { account: f.supplier.account });
    assert.equal(
      (await f.escrow.read.driverOf([orderId])).toLowerCase(),
      f.driver.account.address.toLowerCase(),
    );

    await viem.assertions.revertWithCustomError(
      f.escrow.write.assignDriver([orderId, f.stranger.account.address], { account: f.supplier.account }),
      f.escrow,
      "DriverAlreadyAssigned",
    );
  });

  it("pays the driver 10% and the supplier 40% in one transaction when both sign the pickup", async () => {
    const f = await networkHelpers.loadFixture(deployFixture);
    const orderId = await fundedOrderWithDriver(f);
    const msg = pickupMessage(f, orderId);
    const giverSig = await signHandoff(f, f.supplier, msg);
    const receiverSig = await signHandoff(f, f.driver, msg);
    const driverBefore = await balance(f, f.driver.account.address);
    const supplierBefore = await balance(f, f.supplier.account.address);

    // Anyone may submit: here a third party pays the gas.
    await f.escrow.write.releaseHandoff(
      [orderId, PICKUP, msg.nonce, msg.expiresAt, giverSig, receiverSig],
      { account: f.stranger.account },
    );

    assert.equal((await balance(f, f.driver.account.address)) - driverBefore, DRIVER_AT_PICKUP);
    assert.equal((await balance(f, f.supplier.account.address)) - supplierBefore, SUPPLIER_AT_PICKUP);
  });

  it("rejects a pickup signed by anyone other than the supplier and driver, and pays nothing", async () => {
    const f = await networkHelpers.loadFixture(deployFixture);
    const orderId = await fundedOrderWithDriver(f);
    const msg = pickupMessage(f, orderId);
    // Correct message, wrong keys: the attack where someone signs both sides themselves.
    const giverSig = await signHandoff(f, f.stranger, msg);
    const receiverSig = await signHandoff(f, f.stranger2, msg);
    const escrowBefore = await balance(f, f.escrow.address);

    await viem.assertions.revertWithCustomError(
      f.escrow.write.releaseHandoff([orderId, PICKUP, msg.nonce, msg.expiresAt, giverSig, receiverSig], {
        account: f.stranger.account,
      }),
      f.escrow,
      "InvalidSignature",
    );
    assert.equal(await balance(f, f.escrow.address), escrowBefore);
  });
});
