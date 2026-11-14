import { sameDay } from "@/lib/buyer-shipments";
const time = (t: number) =>
  new Date(t).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });

/** "Today, 16:30" or "Sat 14 Nov, 14:20". */
export function formatEta(t: number, now: number) {
  if (sameDay(t, now)) return `Today, ${time(t)}`;
  const d = new Date(t);
  const day = d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${time(t)}`;
}

/** "Today 16:30" or "Sat 14:20", for the compact list. */
export function formatEtaShort(t: number, now: number) {
  if (sameDay(t, now)) return `Today ${time(t)}`;
  return `${new Date(t).toLocaleDateString("en-ZA", { weekday: "short" })} ${time(t)}`;
}

/** "Just now", "12 min ago", "09:12 today", "Yesterday" or a date. */
export function formatWhen(t: number, now: number) {
  const mins = Math.round((now - t) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (sameDay(t, now)) return `${time(t)} today`;
  if (sameDay(t, now - 86_400_000)) return "Yesterday";
  return new Date(t).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}
