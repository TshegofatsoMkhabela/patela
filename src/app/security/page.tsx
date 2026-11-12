import type { Metadata } from "next";
import { InfoPage, Cards, Prose } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Trust & Security — Patella",
  description:
    "How Patella protects supply chains: honest trust boundaries, Base Sepolia EscrowVault, KMS Release Authority, licensed bank client trust accounts, and isolated dispute holding.",
  openGraph: {
    title: "Trust & Security — Patella",
    description:
      "Honest trust disclosures, Base Sepolia smart-contract escrow, and licensed South African banking infrastructure.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function SecurityPage() {
  return (
    <InfoPage
      eyebrow="Solutions · Trust & Security"
      title="Built with honest trust boundaries."
      lead="Patella coordinates commercial custody and automated escrow with clear disclosure of what technology proves, backed by audited smart contracts and licensed South African banking partners."
      cta={true}
    >
      <Cards
        cols={3}
        items={[
          {
            t: "Honest trust boundaries",
            p: "We state clearly what a custody scan proves: two designated parties confirmed physical handover. It is not an independent quality inspection.",
          },
          {
            t: "EscrowVault smart contract",
            p: "Funds are held on Base Sepolia in an audited smart-contract vault governed by declarative code rules, not unilateral discretion.",
          },
          {
            t: "KMS Release Authority",
            p: "The smart contract never accepts plain API calls. Releases require cryptographic signatures from an isolated KMS/HSM service.",
          },
          {
            t: "Licensed bank trust account",
            p: "Fiat ZAR is held in an independent client trust account at a licensed South African bank with daily reconciliation.",
          },
          {
            t: "Isolated parcel holding",
            p: "Disputes are compartmentalized at the parcel level. An issue with one consignment leg never freezes the rest of the order.",
          },
          {
            t: "Forensic auditor trail",
            p: "Every custody handoff, document SHA-256 hash, and release event is immutably anchored on-chain for read-only auditor verification.",
          },
        ]}
      />
      <Prose
        sections={[
          {
            h: "What a Custody Scan Proves — and What It Does Not",
            p: [
              "Trust in supply chain technology requires absolute intellectual honesty:",
              "• What it PROVES: At an exact timestamp and GPS location, the designated releasing party (e.g. driver) and the designated receiving party (e.g. warehouse dock clerk) authenticated with single-use credentials and executed simultaneous cryptographic digital signatures confirming custody transfer, with optional photo and condition notes.",
              "• What it DOES NOT PROVE: A custody scan is not an automated assayer assay or chemical analysis of sealed containers, does not verify that internal cargo was not substituted prior to sealing, and cannot physically prevent armed hijackings or road accidents during transit legs. Patella provides immutable coordination, legal accountability, and deterministic financial settlement when agreed conditions are satisfied.",
            ],
          },
          {
            h: "Money Conservation Invariant",
            p: [
              "Patella enforces a fundamental mathematical invariant: the sum of all payment tranches must equal the total escrowed amount at all times. This rule is enforced at three independent layers: in the REST API validation pipeline, in the internal double-entry accounting ledger, and in the Solidity smart contract code. No partial float, rounding error, or unauthorized slippage is permitted.",
            ],
          },
          {
            h: "Vulnerability Disclosure & Audit Reports",
            p: [
              "We take security vulnerabilities seriously. If you identify a flaw in our smart contracts, API gateway, or guest handoff token engine, please contact security@patella.co.za. We operate a coordinated disclosure process and compensate responsible researchers.",
            ],
          },
        ]}
      />
    </InfoPage>
  );
}
