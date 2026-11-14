import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { buildSlaPdf } from "./sla-pdf";
import { slaApprovalMessage, verifySlaSignature, type SlaRecord } from "./sla";

const buyer = privateKeyToAccount(`0x${"11".repeat(32)}`);
const record: SlaRecord = {
  version: 1,
  signedAt: "2026-11-14T10:00:00.000Z",
  orderId: "PT-0412",
  chainOrderId: "42",
  chainId: 11142220,
  network: "Celo Sepolia",
  contractAddress: "0x0000000000000000000000000000000000001234",
  contractUrl:
    "https://celo-sepolia.blockscout.com/address/0x0000000000000000000000000000000000001234",
  buyerEmail: "buyer@example.com",
  buyerWallet: buyer.address,
  supplierEmail: "supplier@example.com",
  supplierWallet: "0x0000000000000000000000000000000000005678",
  agreementText:
    "Deliver 100 sealed crates to Cape Town by Friday. Confirm pickup and delivery at each handoff.",
  agreementHash: `0x${"aa".repeat(32)}`,
  totalWei: "100000000000000000000",
  driverAtPickupWei: "10000000000000000000",
  supplierAtPickupWei: "40000000000000000000",
  supplierAtDeliveryWei: "50000000000000000000",
  refundDeadline: "2026-11-20T12:00:00.000Z",
  supplierAccepted: true,
};

describe("buyer-signed SLA", () => {
  it("verifies the buyer signature and rejects modified terms", async () => {
    const signature = await buyer.signMessage({ message: slaApprovalMessage(record) });
    expect(await verifySlaSignature(record, signature)).toBe(true);
    expect(await verifySlaSignature({ ...record, agreementText: "Changed scope" }, signature)).toBe(
      false,
    );
  });

  it("creates a PDF with an explorer link and signature evidence", async () => {
    const signature = await buyer.signMessage({ message: slaApprovalMessage(record) });
    const pdf = buildSlaPdf(record, signature);
    const content = new TextDecoder().decode(pdf);
    expect(content).toMatch(/^%PDF-1\.4/);
    expect(content).toContain("/Subtype /Link");
    expect(content).toContain(record.contractUrl);
    expect(content).toContain(signature.slice(2, 66));
    expect(content).toContain("SERVICE LEVEL AGREEMENT");
    expect(content).toContain("sla-record.json");
    if (process.env.SLA_PREVIEW_DIR) {
      mkdirSync(process.env.SLA_PREVIEW_DIR, { recursive: true });
      writeFileSync(`${process.env.SLA_PREVIEW_DIR}/sla-preview.pdf`, pdf);
    }
  });
});
