import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, parseUnits, toHex, type Address } from "viem";

// End-to-end run of the stage demo against the contract, beat by beat, with the
// pitch's rand amounts adapted to the agreed two-handoff flow
// (specs/SPEC-demo-order-flow.md): buyer R10,000; pickup pays the driver R1,000
// and the supplier R4,000; delivery pays the supplier the last R5,000.

const { viem, networkHelpers } = await network.connect();

const R = (n: string) => parseUnits(n, 18);
const handoffTypes = {
  Handoff: [
    { name: "orderId", type: "uint256" },
    { name: "stage", type: "uint8" },
    { name: "giver", type: "address" },
    { name: "receiver", type: "address" },
    { name: "nonce", type: "bytes32" },
    { name: "expiresAt", type: "uint256" },
  ],
} as const;

describe("Stage demo, end to end", () => {
  it("runs the full demo: fund, assign driver, pickup, cheating attempts, delivery, and a refund order", async () => {
    const [, buyer, supplier, driver, sponsor, cheater] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    const chainId = await publicClient.getChainId();
    const zarp = await viem.deployContract("MockZARP");
    const registry = await viem.deployContract("PatellaRegistry");
    const escrow = await viem.deployContract("PatellaEscrowAndLogistics", [zarp.address, registry.address]);
    const bal = (a: Address) => zarp.read.balanceOf([a]);
    const wallets = async () => ({
      buyer: await bal(buyer.account.address),
      supplier: await bal(supplier.account.address),
      driver: await bal(driver.account.address),
      escrow: await bal(escrow.address),
    });
    const sign = (who: typeof buyer, message: Record<string, unknown>) =>
      who.signTypedData({
        account: who.account,
        domain: { name: "Patela Escrow", version: "1", chainId, verifyingContract: escrow.address },
        types: handoffTypes,
        primaryType: "Handoff",
        message: message as never,
      });

    // Beat 1: set-up. The buyer holds R10,000; everyone else holds R0.
    await zarp.write.mint([buyer.account.address, R("20000")]); // second R10,000 is for the refund order
    await zarp.write.approve([escrow.address, R("20000")], { account: buyer.account });
    const deadline = BigInt(await networkHelpers.time.latest()) + 24n * 3600n;

    // Beat 2: lock. A wrong split is rejected; the right order is funded.
    await viem.assertions.revertWithCustomError(
      escrow.write.createOrder([supplier.account.address, R("10000"), R("1000"), R("4000"), R("4999"), deadline], { account: buyer.account }),
      escrow,
      "SplitMismatch",
    );
    await escrow.write.createOrder([supplier.account.address, R("10000"), R("1000"), R("4000"), R("5000"), deadline], { account: buyer.account });
    const orderId = await escrow.read.orderCounter();
    await escrow.write.fundEscrow([orderId], { account: buyer.account });
    assert.deepEqual(await wallets(), { buyer: R("10000"), supplier: 0n, driver: 0n, escrow: R("10000") });

    // Beat 3: the supplier accepts and picks a driver.
    await escrow.write.assignDriver([orderId, driver.account.address], { account: supplier.account });

    // Beat 4: pickup. The supplier's screen shows a QR valid for 2 minutes; the
    // driver scans; both sign; a sponsor submits and pays the gas.
    const now = BigInt(await networkHelpers.time.latest());
    const pickup = {
      orderId, stage: 1, giver: supplier.account.address, receiver: driver.account.address,
      nonce: keccak256(toHex("qr-pickup")), expiresAt: now + 120n,
    };
    const pickupSigs = [await sign(supplier, pickup), await sign(driver, pickup)] as const;
    const pickupTx = await escrow.write.releaseHandoff(
      [orderId, 1, pickup.nonce, pickup.expiresAt, ...pickupSigs], { account: sponsor.account },
    );
    assert.deepEqual(await wallets(), { buyer: R("10000"), supplier: R("4000"), driver: R("1000"), escrow: R("5000") });

    // Beat 5: cheating. A screenshot of the old QR pays nothing; a stranger
    // signing both sides pays nothing.
    await viem.assertions.revertWithCustomError(
      escrow.write.releaseHandoff([orderId, 1, pickup.nonce, pickup.expiresAt, ...pickupSigs], { account: cheater.account }),
      escrow,
      "NonceUsed",
    );
    const fakeDelivery = {
      orderId, stage: 2, giver: driver.account.address, receiver: buyer.account.address,
      nonce: keccak256(toHex("qr-fake")), expiresAt: now + 120n,
    };
    await viem.assertions.revertWithCustomError(
      escrow.write.releaseHandoff(
        [orderId, 2, fakeDelivery.nonce, fakeDelivery.expiresAt, await sign(cheater, fakeDelivery), await sign(cheater, fakeDelivery)],
        { account: cheater.account },
      ),
      escrow,
      "InvalidSignature",
    );
    assert.deepEqual(await wallets(), { buyer: R("10000"), supplier: R("4000"), driver: R("1000"), escrow: R("5000") });

    // Beat 6: delivery. The driver hands over; the shop owner scans and signs.
    const delivery = { ...fakeDelivery, nonce: keccak256(toHex("qr-delivery")) };
    await escrow.write.releaseHandoff(
      [orderId, 2, delivery.nonce, delivery.expiresAt, await sign(driver, delivery), await sign(buyer, delivery)],
      { account: sponsor.account },
    );
    assert.deepEqual(await wallets(), { buyer: R("10000"), supplier: R("9000"), driver: R("1000"), escrow: 0n });

    // Beat 7: a second order where the box never arrives; after the deadline the
    // buyer, and only the buyer, takes the money back.
    await escrow.write.createOrder([supplier.account.address, R("10000"), R("1000"), R("4000"), R("5000"), deadline], { account: buyer.account });
    const lostOrder = await escrow.read.orderCounter();
    await escrow.write.fundEscrow([lostOrder], { account: buyer.account });
    assert.equal(await bal(buyer.account.address), 0n);
    await networkHelpers.time.increaseTo(deadline);
    await viem.assertions.revertWithCustomError(escrow.write.refund([lostOrder], { account: cheater.account }), escrow, "NotBuyer");
    await escrow.write.refund([lostOrder], { account: buyer.account });
    assert.equal(await bal(buyer.account.address), R("10000"));
    assert.equal(await bal(escrow.address), 0n);

    // Gas for one handoff release: what Patela's paymaster would sponsor per scan.
    const receipt = await publicClient.getTransactionReceipt({ hash: pickupTx });
    console.log(`    gas used by one handoff release (pickup, 2 payments): ${receipt.gasUsed}`);
  });
});
