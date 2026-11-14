// Turns a spoken order into form fields, and matches it against previous orders.

export type SpokenOrder = {
  agreement: string;
  total?: string;
  refundHours?: number;
  driverPct?: number;
  supplierPickupPct?: number;
};

export type PastOrder = {
  id: string;
  label: string;
  text: string;
  total?: string;
  refundHours?: number;
  seeded?: boolean;
};

const num = (s: string) => s.replace(/[,\s]/g, "");

// Each clause is removed from the agreement once its value is read.
const TOTAL =
  /,?\s*(?:(?:for|total(?:\s+of)?|at|costs?|price(?:\s+of)?)\s+)?(?:\bR\s?(\d[\d,\s]*\d|\d)(?:\.\d+)?|(\d[\d,\s]*\d|\d)\s*(?:rand|zar)\b)\.?/i;
const REFUND =
  /,?\s*(?:and\s+)?refund(?:able)?\s+(?:after|in|within)\s+(\d+)\s*(hours?|hrs?|days?)\b\.?/i;
const DRIVER =
  /,?\s*(?:and\s+)?(?:the\s+)?driver\s+(?:gets|takes|is\s+paid|paid)\s+(\d+)\s*(?:%|percent|per\s+cent)(?:\s+at\s+pickup)?\b\.?/i;
const SUPPLIER_PICKUP =
  /,?\s*(?:and\s+)?(?:the\s+)?supplier\s+(?:gets|takes|is\s+paid|paid)\s+(\d+)\s*(?:%|percent|per\s+cent)\s+at\s+pickup\b\.?/i;

export function parseSpokenOrder(spoken: string): SpokenOrder {
  let text = ` ${spoken.trim()}`;
  const out: Omit<SpokenOrder, "agreement"> = {};
  const take = (re: RegExp) => {
    const m = text.match(re);
    if (m) text = text.replace(m[0], "");
    return m;
  };

  const total = take(TOTAL);
  if (total) out.total = num(total[1] ?? total[2]);
  const refund = take(REFUND);
  if (refund) out.refundHours = Number(refund[1]) * (/^d/i.test(refund[2]) ? 24 : 1);
  const driver = take(DRIVER);
  const supplier = take(SUPPLIER_PICKUP);
  const d = driver ? Number(driver[1]) : undefined;
  const s = supplier ? Number(supplier[1]) : undefined;
  // Something must be left for delivery, or the split is ignored.
  if ((d ?? 10) + (s ?? 40) < 100) {
    if (d !== undefined) out.driverPct = d;
    if (s !== undefined) out.supplierPickupPct = s;
  }

  const agreement = text
    .replace(/\s{2,}/g, " ")
    .replace(/[\s,;]+$/, "")
    .trim();
  return { agreement, ...out };
}

const STOP = new Set(["a", "an", "and", "the", "to", "from", "by", "of", "for", "in", "on", "at"]);
const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w && !STOP.has(w)),
  );

/** Word-overlap (Jaccard) score between two order descriptions, 0 to 1. */
export function similarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / (A.size + B.size - shared);
}

/** The most similar previous order, if it is close enough to suggest reusing its terms. */
export function findSimilarOrder(
  text: string,
  orders: PastOrder[],
  threshold = 0.4,
): { order: PastOrder; score: number } | null {
  let best: { order: PastOrder; score: number } | null = null;
  for (const order of orders) {
    const score = similarity(text, order.text);
    if (score >= threshold && (!best || score > best.score)) best = { order, score };
  }
  return best;
}

/** Demo previous orders, so the Previous orders tab and similarity matching have history. */
export const SEEDED_ORDERS: PastOrder[] = [
  {
    id: "seed-chairs",
    label: "Office chairs · Seatwell Furniture",
    text: "40 ergonomic office chairs on 2 shrink-wrapped pallets, from City Deep, Johannesburg to Ndlovu Home Stores, Durban, delivered by Friday.",
    total: "48000",
    refundHours: 72,
    seeded: true,
  },
  {
    id: "seed-tomatoes",
    label: "Tomatoes · Limpopo Fresh",
    text: "20 crates of grade A tomatoes from Tzaneen to Polokwane market, delivered by 6am Wednesday, kept below 12°C.",
    total: "3600",
    refundHours: 24,
    seeded: true,
  },
  {
    id: "seed-cement",
    label: "Cement · BuildRite Supplies",
    text: "120 bags of 50 kg cement from Midrand to the Soweto site, delivered by Monday, offloaded at gate 2.",
    total: "14400",
    refundHours: 48,
    seeded: true,
  },
  {
    id: "seed-solar",
    label: "Solar panels · SunVolt",
    text: "12 x 550 W solar panels with mounting rails from Cape Town to Stellenbosch, delivered by Thursday.",
    total: "39000",
    refundHours: 96,
    seeded: true,
  },
];
