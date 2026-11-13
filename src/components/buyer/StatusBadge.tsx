import type { BadgeTone } from "@/lib/buyer-shipments";

export function StatusBadge({ badge }: { badge: { label: string; tone: BadgeTone } | null }) {
  if (!badge) return null;
  return <span className={`bd-badge bd-badge--${badge.tone}`}>{badge.label}</span>;
}
