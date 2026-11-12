import type { Metadata } from "next";
import { InfoPage, Cards, Prose } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "How it works — Patella",
  description:
    "How Patella coordinates multi-hop supply chains: commercial agreement, multi-hop route configuration, Rand escrow, two-party mobile handoffs, and declarative tranche releases.",
  openGraph: {
    title: "How it works — Patella",
    description:
      "8-stage order-to-settlement coordination: multi-hop route graphs, guest-first mobile custody handoffs, and Base Sepolia EscrowVault.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function HowItWorksPage() {
  return (
    <InfoPage
      title="From order to settlement, without the custody trust problem."
      lead="Patella coordinates B2B supply chains across South Africa: route-agnostic multi-hop logistics, two-party mobile handoffs, and automated Rand escrow."
      centerTitle={true}
      cta={true}
    >
      <Cards
        cols={4}
        items={[
          {
            n: "STAGE 01",
            t: "Agree order & RFQ",
            p: "Buyer and supplier finalize specifications, line items, and consignment splits via direct agreement or sealed-bid tender trail.",
          },
          {
            n: "STAGE 02",
            t: "Build multi-hop route",
            p: "Configure any logistics corridor: direct road freight, rail links, bonded storage, or multi-depot hub-and-spoke routes.",
          },
          {
            n: "STAGE 03",
            t: "Declarative payment plan",
            p: "Rules are data. Define milestone triggers (dispatch, arrival, inspection) where tranche amounts sum exactly to the escrow total.",
          },
          {
            n: "STAGE 04",
            t: "Fund Rand escrow",
            p: "Deposit ZAR into a licensed South African bank client trust account. The equivalent ZARP rand-stablecoin locks in EscrowVault on Base Sepolia.",
          },
          {
            n: "STAGE 05",
            t: "Active custody tracking",
            p: "Parcels move through the route graph. At every step, the active custody holder is uniquely identified and accountable.",
          },
          {
            n: "STAGE 06",
            t: "Two-party guest handoff",
            p: "Drivers and warehouse receiving teams scan a short-lived link and record simultaneous signatures without downloading an app or wallet.",
          },
          {
            n: "STAGE 07",
            t: "Rule-triggered payout",
            p: "Verified handoff events trigger the rules engine. KMS Release Authority signs the instruction and EscrowVault settles instantly.",
          },
          {
            n: "STAGE 08",
            t: "Isolated dispute holding",
            p: "Damaged or short cargo holds only its affected parcel tranche. Unaffected consignments continue moving and paying without delay.",
          },
        ]}
      />
      <Prose
        sections={[
          {
            h: "Route-Agnostic Multi-Hop Architecture",
            p: [
              "Supply chains in southern Africa are rarely simple point-A to point-B trips. Goods transit through consolidation depots, rail sidings, customs bonded facilities, and regional distribution centers. Patella treats every corridor as a directed graph of nodes and edges, allowing any arbitrary sequence of carriers and handoffs to be governed by a single master agreement.",
            ],
          },
          {
            h: "Conservation of Money & Declarative Rules",
            p: [
              "Every payment plan is versioned and immutable once signed. Rules are declarative data evaluated by an automated engine. The platform strictly enforces conservation of money across the API, internal double-entry ledger, and smart contract: the sum of all tranches must equal the funded escrow total down to the cent, with zero float or unauthorized leakage.",
            ],
          },
          {
            h: "Honest Trust Boundary Disclosure",
            p: [
              "Patella maintains clear boundaries on what technology can and cannot prove: a cryptographic scan confirms that two designated parties signed a physical custody transfer at a specific timestamp and GPS coordinate. It is not an independent assayer inspection of internal cargo condition, nor does it physically prevent transit theft or hijacking. We coordinate accountability, record immutable proof, and automate payment upon agreed conditions.",
            ],
          },
        ]}
      />
    </InfoPage>
  );
}
