import type { Metadata } from "next";
import { TrackerView } from "./tracker-view";

export const metadata: Metadata = {
  title: "Route tracker demo — Patela",
  description:
    "A simulated Cape Town to Beaufort West shipment with a 3D truck and custody handoff.",
};

export default function TrackerPage() {
  return <TrackerView />;
}
