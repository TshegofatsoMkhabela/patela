import type { Metadata } from "next";
import { InfoPage, Cards, Prose } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "For Suppliers & Carriers — Patella",
  description:
    "Know payment is escrowed before wheels roll. Confirm two-party custody handoffs from any phone with zero app install and get paid on verified milestones.",
  openGraph: {
    title: "For Suppliers & Carriers — Patella",
    description:
      "B2B logistics coordination for carriers and suppliers: escrowed Rand, guest mobile handoffs, and instant tranche releases.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function ForWorkersPage() {
  return (
    <InfoPage
      eyebrow="Solutions · For Suppliers & Carriers"
      title="Know payment is guaranteed before wheels roll."
      lead="Every consignment is backed by funds locked in EscrowVault before cargo departs. Complete verified handoffs and get paid the moment agreed rules are satisfied."
      cta={true}
    >
      <Cards
        cols={3}
        items={[
          {
            t: "Escrowed funds up front",
            p: "Verify that 100% of the transport or commodity budget is locked in smart-contract escrow before assigning fleet assets or dispatching loads.",
          },
          {
            t: "Guest-first mobile handoff",
            p: "Drivers, dock hands, and yard managers confirm physical handoffs from any smartphone browser via a one-time link. Zero app or wallet required.",
          },
          {
            t: "Rule-triggered tranche releases",
            p: "Get paid across the route: advance dispatch, cross-dock arrival, and final terminal discharge. Tranches release automatically on verified events.",
          },
          {
            t: "Sealed-bid tender trail",
            p: "Bid on commercial freight tenders with cryptographic deadline secrecy. Bids remain sealed until tender close, preventing predatory undercutting.",
          },
          {
            t: "No chargebacks or payment delays",
            p: "Once an authorized milestone condition is met, funds release to your account. No 60-day credit terms, arbitrary invoice discounts, or payment disputes.",
          },
          {
            t: "Verifiable delivery track record",
            p: "Build an indisputable on-chain operational profile showcasing confirmed on-time handoffs, CIPC verification, and low dispute ratios.",
          },
        ]}
      />
      <Prose
        sections={[
          {
            h: "Zero App or Wallet Barrier for Drivers",
            p: [
              "In freight and logistics, operational friction kills compliance. Patella requires zero software installation or Web3 knowledge for drivers and warehouse workers. When a vehicle arrives at a gate or loading bay, the dispatcher sends a short-lived, single-use token via SMS or WhatsApp. Both the releasing driver and the receiving clerk sign the custody transfer on the same screen, creating a cryptographic dual-signature record anchored to the route ledger.",
            ],
          },
        ]}
      />
    </InfoPage>
  );
}
