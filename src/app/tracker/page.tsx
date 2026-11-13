import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Route tracker demo — Patela",
  description:
    "A simulated Cape Town to Beaufort West shipment with a 3D truck and custody handoff.",
};

export default function TrackerPage() {
  return (
    <iframe
      title="Simulated Cape Town to Beaufort West route tracker"
      src="/tracker-demo/index.html"
      style={{ display: "block", width: "100vw", height: "100dvh", border: 0 }}
    />
  );
}
