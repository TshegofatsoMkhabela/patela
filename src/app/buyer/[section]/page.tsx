import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/demo/DemoShell";

const sections = {
  shipments: {
    title: "Shipments",
    description: "Follow each route, custody handoff, and delivery update.",
    cards: [
      {
        label: "In transit",
        value: "SHP-99201",
        detail: "Richards Bay → City Deep · Parcel A continuing to destination",
      },
      {
        label: "Checkpoint",
        value: "Live route",
        detail: "Open the tracker to see the simulated journey and verify a handoff.",
      },
    ],
    action: { href: "/tracker", label: "Track order" },
  },
  payments: {
    title: "Payments & escrow",
    description: "See how funds are held and released as delivery milestones are verified.",
    cards: [
      {
        label: "Escrow",
        value: "Protected",
        detail: "Funds remain held until the agreed custody steps are complete.",
      },
      {
        label: "Release",
        value: "Milestone based",
        detail: "Pickup and delivery handoffs determine the payment schedule.",
      },
    ],
    action: { href: "/orders/new", label: "Create an order" },
  },
  documents: {
    title: "Documents",
    description: "Keep order agreements, invoices, and handoff evidence together.",
    cards: [
      {
        label: "Agreement",
        value: "Order record",
        detail: "The accepted terms are attached to each order.",
      },
      {
        label: "Evidence",
        value: "Custody history",
        detail: "Handoff records provide a trail for review.",
      },
    ],
    action: { href: "/orders/new", label: "View order flow" },
  },
  disputes: {
    title: "Disputes",
    description: "Review delivery exceptions and the evidence associated with them.",
    cards: [
      {
        label: "Active case",
        value: "DIS-2026-041",
        detail: "The disputed portion of SHP-99201 is isolated for review.",
      },
      {
        label: "Unaffected delivery",
        value: "Continuing",
        detail: "Parcel A remains in transit while the exception is reviewed.",
      },
    ],
    action: { href: "/buyer/shipments", label: "View shipment" },
  },
} as const;

export default async function BuyerSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!(section in sections)) notFound();
  const page = sections[section as keyof typeof sections];

  return (
    <>
      <PageHeader eyebrow="Buyer workspace · Demo" title={page.title}>
        <p className="dm-lead">{page.description}</p>
      </PageHeader>
      <div className="dm-row" style={{ padding: "24px", alignItems: "stretch" }}>
        {page.cards.map((card) => (
          <section className="dm-card dm-narrow" key={card.label}>
            <span className="bd-label">{card.label}</span>
            <h2 style={{ margin: 0, color: "var(--bd-cream)", fontSize: "1.45rem" }}>
              {card.value}
            </h2>
            <p className="dm-lead">{card.detail}</p>
          </section>
        ))}
      </div>
      <div style={{ padding: "0 24px 24px" }}>
        <Link className="bd-btn" href={page.action.href}>
          {page.action.label}
        </Link>
      </div>
    </>
  );
}
