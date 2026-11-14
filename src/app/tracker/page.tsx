import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TrackerView } from "./tracker-view";

export const metadata: Metadata = {
  title: "Route tracker demo — Patela",
  description:
    "A simulated Cape Town to Beaufort West shipment with a 3D truck and custody handoff.",
};

export default function TrackerPage() {
  const source = readFileSync(path.join(process.cwd(), "public/tracker-demo/index.html"), "utf8");
  const styles = source.match(/<style>([\s\S]*?)<\/style>/i)?.[1] ?? "";
  const markup = source.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? "";
  return <TrackerView styles={styles} markup={markup} />;
}
