import type { Metadata } from "next";
import { InfoPage, Cards, Prose } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "For Buyers & Consignors — Patella",
  description:
    "Deposit South African Rand in escrow with a licensed bank partner, enforce multi-hop custody rules, and release payment only on verified delivery.",
  openGraph: {
    title: "For Buyers & Consignors — Patella",
    description:
      "Commercial escrow coordination for buyers: bank-held ZAR trust accounts, split consignments, and isolated dispute protection.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function ForClientsPage() {
  return (
    <InfoPage
      eyebrow="Solutions · For Buyers & Consignors"
      title="Deposit Rand with bank-grade peace of mind."
      lead="Your cargo budget is held in an independent client trust account with a licensed South African bank. Funds move only when physical custody handoffs meet your agreed rules."
      cta={true}
    >
      <Cards
        cols={3}
        items={[
          {
            t: "Licensed bank trust account",
            p: "Deposits are held in an independent client trust account under South African banking regulations, not on an unregulated offshore exchange.",
          },
          {
            t: "Split consignment routing",
            p: "Dispatch bulk shipments and split parcels across multiple regional hubs, depots, and customer receiving bays under one order.",
          },
          {
            t: "Isolated parcel protection",
            p: "If one pallet or truckload is damaged, only that affected tranche is held in dispute. Unaffected cargo continues moving and paying.",
          },
          {
            t: "Dual-signed agreements",
            p: "Both buyer and supplier sign the canonical agreement v1.0. Amendments require mutual cryptographic sign-off before rules change.",
          },
          {
            t: "Vetted freight carriers",
            p: "Browse verified logistics partners with active CIPC registration, goods-in-transit insurance certificates, and confirmed handoff track records.",
          },
          {
            t: "Immutable audit trail",
            p: "Every custody handoff, milestone event, and escrow movement is cryptographically anchored on Celo for external auditors.",
          },
        ]}
      />
      <Prose
        sections={[
          {
            h: "5-Stage Escrow Funding Pipeline",
            p: [
              "When you fund an order on Patella, your wallet approves the exact Mento ZARm total and locks it in the Celo EscrowVault. Patella confirms the on-chain transaction before the order becomes funded.",
            ],
          },
        ]}
      />
    </InfoPage>
  );
}
