import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, parseUnits, toHex } from "viem";

// CZARToken (from ThabisoDev) is a test-only rand token Patela mints itself. Real orders use
// Mento ZARm; CZAR has no reserve behind it, so nobody will redeem it for rand.

const { viem, networkHelpers } = await network.connect();
const CZAR = (n: string) => parseUnits(n, 18);

async function deployFixture() {
  const [owner, buyer, supplier, stranger] = await viem.getWalletClients();
  const czar = await viem.deployContract("CZARToken", [CZAR("1000000")]);
  return { owner, buyer, supplier, stranger, czar };
}

describe("CZARToken", () => {
  it("is 18-decimal Crypto ZAR with the initial supply held by the deployer", async () => {
    const { owner, czar } = await networkHelpers.loadFixture(deployFixture);
    assert.equal(await czar.read.name(), "Crypto ZAR");
    assert.equal(await czar.read.symbol(), "CZAR");
    assert.equal(await czar.read.decimals(), 18);
    assert.equal(await czar.read.balanceOf([owner.account.address]), CZAR("1000000"));
  });

  it("lets only the owner mint", async () => {
    const { buyer, stranger, czar } = await networkHelpers.loadFixture(deployFixture);
    await czar.write.mint([buyer.account.address, CZAR("500")]);
    assert.equal(await czar.read.balanceOf([buyer.account.address]), CZAR("500"));
    await assert.rejects(
      czar.write.mint([stranger.account.address, CZAR("1")], { account: stranger.account }),
      /OwnableUnauthorizedAccount/,
    );
  });

  it("can stand in for ZARm as the escrow's payment token in tests", async () => {
    const { buyer, supplier, czar } = await networkHelpers.loadFixture(deployFixture);
    const total = CZAR("1000");
    const registry = await viem.deployContract("PatellaRegistry");
    const escrow = await viem.deployContract("PatellaEscrowAndLogistics", [
      czar.address,
      registry.address,
      total,
    ]);
    assert.equal((await escrow.read.paymentToken()).toLowerCase(), czar.address.toLowerCase());

    await czar.write.mint([buyer.account.address, total]);
    await czar.write.approve([escrow.address, total], { account: buyer.account });
    const deadline = BigInt(await networkHelpers.time.latest()) + 86_400n;
    await escrow.write.createOrder(
      [
        supplier.account.address,
        total,
        CZAR("100"),
        CZAR("400"),
        CZAR("500"),
        deadline,
        keccak256(toHex("test order")),
      ],
      { account: buyer.account },
    );
    await escrow.write.fundEscrow([await escrow.read.orderCounter()], { account: buyer.account });
    assert.equal(await czar.read.balanceOf([escrow.address]), total);
  });
});
