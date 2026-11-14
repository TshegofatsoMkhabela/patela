import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits } from "viem";

// CZAR: the test Rand for the Celo Sepolia demo. Anyone can mint it (a faucet), never real money.
describe("CZAR test token", async () => {
  const { viem } = await network.connect();
  const [, stranger] = await viem.getWalletClients();

  it("is called Patella Test ZAR, symbol CZAR, 18 decimals", async () => {
    const czar = await viem.deployContract("CZAR");
    assert.equal(await czar.read.symbol(), "CZAR");
    assert.equal(await czar.read.name(), "Patella Test ZAR");
    assert.equal(await czar.read.decimals(), 18);
  });

  it("lets any wallet mint test Rand to itself, like the Get test Rand button does", async () => {
    const czar = await viem.deployContract("CZAR");
    await czar.write.mint([stranger.account.address, parseUnits("1000", 18)], {
      account: stranger.account,
    });
    assert.equal(await czar.read.balanceOf([stranger.account.address]), parseUnits("1000", 18));
  });

  it("caps one mint at 1,000,000 so a typo can't create absurd balances", async () => {
    const czar = await viem.deployContract("CZAR");
    await assert.rejects(czar.write.mint([stranger.account.address, parseUnits("1000001", 18)]));
  });
});
