import { describe, expect, it } from "vitest";
import { recoverTypedDataAddress } from "viem";
import { handoffDomain, handoffTypes } from "./contracts";
import {
  demoAccount,
  demoChainClients,
  demoSignerAvailable,
  demoWalletSigner,
} from "./demo-signer";

const ESCROW = "0x00000000000000000000000000000000000000e5" as const;

describe("demo signer", () => {
  it("Given the local chain 31337, Then demo personas are Hardhat dev accounts #1-#3", () => {
    expect(demoSignerAvailable(31337)).toBe(true);
    expect(demoAccount("buyer", 31337).address).toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
    expect(demoAccount("supplier", 31337).address).toBe(
      "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    );
    expect(demoAccount("driver", 31337).address).toBe("0x90F79bf6EB2c4f870365E785982E1f101E93b906");
  });

  it("Given Base Sepolia or Celo, Then every demo signer entry point refuses", () => {
    for (const chainId of [84532, 11142220, 8453]) {
      expect(demoSignerAvailable(chainId)).toBe(false);
      expect(() => demoAccount("buyer", chainId)).toThrow(/only work on the local chain/);
      expect(() => demoChainClients("buyer", chainId)).toThrow(/only work on the local chain/);
      expect(() => demoWalletSigner("driver", { chainId })).toThrow(/only work on the local chain/);
    }
  });

  it("Given a handoff, When the demo driver signs, Then the signature recovers to the driver", async () => {
    const signer = demoWalletSigner("driver", { chainId: 31337, escrow: ESCROW });
    expect(signer.kind).toBe("demo");
    const td = {
      domain: { ...handoffDomain(ESCROW), chainId: 31337 },
      types: handoffTypes,
      primaryType: "Handoff" as const,
      message: {
        orderId: 1n,
        stage: 1,
        giver: demoAccount("supplier", 31337).address,
        receiver: signer.address,
        nonce: `0x${"01".repeat(32)}` as const,
        expiresAt: 2_000_000_000n,
        evidenceHash: `0x${"02".repeat(32)}` as const,
      },
    };
    const signature = await signer.signTypedData(td);
    expect(await recoverTypedDataAddress({ ...td, signature })).toBe(signer.address);
  });

  it("Given the buyer persona, Then clients carry the buyer account for the order flow", () => {
    const c = demoChainClients("buyer", 31337);
    expect(c.account).toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
    expect(c.walletClient.account?.address).toBe(c.account);
  });
});
