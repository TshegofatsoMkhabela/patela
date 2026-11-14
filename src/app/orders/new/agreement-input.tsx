"use client";

import { useEffect, useRef, useState } from "react";
import { api, type OrderDetail } from "@/lib/api";
import { appendText, cleanPdfText } from "./agreement-text";
import {
  findSimilarOrder,
  parseSpokenOrder,
  SEEDED_ORDERS,
  type PastOrder,
  type SpokenOrder,
} from "./spoken-order";

type Mode = "type" | "previous" | "pdf";
export type OrderFields = Omit<SpokenOrder, "agreement">;

// pdf.js loads from a CDN only when someone uploads a PDF (no package install, no bundle cost).
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs";

type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: ArrayBuffer }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string; hasEOL?: boolean }> }>;
      }>;
    }>;
  };
};

async function pdfToText(file: File): Promise<string> {
  const pdfjs = (await import(/* webpackIgnore: true */ PDFJS)) as PdfJs;
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, 10); n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(content.items.map((i) => (i.str ?? "") + (i.hasEOL ? "\n" : " ")).join(""));
  }
  return cleanPdfText(pages.join("\n\n"));
}

// Minimal Web Speech API types (Chrome/Edge expose it as webkitSpeechRecognition).
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number } }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};
const speechApi = () =>
  typeof window === "undefined"
    ? undefined
    : ((window as unknown as { SpeechRecognition?: new () => Recognition }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => Recognition })
        .webkitSpeechRecognition);

const describeFields = (f: OrderFields) =>
  [
    f.total ? `total R ${f.total}` : "",
    f.refundHours ? `refund after ${f.refundHours} h` : "",
    f.driverPct !== undefined ? `driver ${f.driverPct}% at pickup` : "",
    f.supplierPickupPct !== undefined ? `supplier ${f.supplierPickupPct}% at pickup` : "",
  ]
    .filter(Boolean)
    .join(", ");

/**
 * Agreement field: Type / Previous orders / Upload PDF, plus "Speak the order", which also fills
 * the total, refund time and split, and suggests a similar previous order.
 */
export function AgreementInput({
  value,
  onChange,
  onFields,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Total / refund / split heard in speech or copied from a previous order. */
  onFields: (f: OrderFields) => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("type");
  const [real, setReal] = useState<PastOrder[] | null>(null);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [similar, setSimilar] = useState<{ order: PastOrder; score: number } | null>(null);
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const past = [...(real ?? []), ...SEEDED_ORDERS];
  const pastRef = useRef(past);
  pastRef.current = past;

  useEffect(() => setCanSpeak(Boolean(speechApi())), []);
  useEffect(() => () => rec.current?.stop(), []);

  // The user's own orders: the list endpoint has no agreement text, so read the latest in full.
  useEffect(() => {
    if (real) return;
    void (async () => {
      try {
        const list = (await api.listOrders()).slice(0, 6);
        const details = await Promise.all(
          list.map((o) => api.getOrder(o.id).catch(() => null as OrderDetail | null)),
        );
        setReal(
          details
            .filter((d): d is OrderDetail => Boolean(d?.agreementText))
            .map((d) => ({
              id: d.id,
              label: d.chainOrderId ? `Order #${d.chainOrderId}` : "Your draft order",
              text: String(d.agreementText),
            })),
        );
      } catch {
        setReal([]); // signed out or offline: seeded orders still show
      }
    })();
  }, [real]);

  function pickPast(p: PastOrder) {
    onChange(p.text);
    onFields({ total: p.total, refundHours: p.refundHours });
    setMode("type");
    setSimilar(null);
    setNote({ text: `Copied from ${p.label}. Edit anything that changed.` });
  }

  async function onPdf(file: File | undefined) {
    if (!file) return;
    setNote({ text: `Reading ${file.name}…` });
    try {
      const text = await pdfToText(file);
      if (!text) throw new Error("No text found. Is it a scanned image?");
      onChange(text);
      setMode("type");
      setNote({ text: `Imported from ${file.name}. Check it before you save.` });
    } catch (err) {
      setNote({
        text: `Couldn't read the PDF: ${err instanceof Error ? err.message : err}`,
        error: true,
      });
    }
  }

  function heard(transcript: string) {
    const spoken = parseSpokenOrder(transcript);
    const next = appendText(valueRef.current, spoken.agreement);
    onChange(next);
    const { agreement: _ignored, ...fields } = spoken;
    void _ignored;
    if (Object.keys(fields).length) onFields(fields);
    const filled = describeFields(fields);
    setNote({
      text: filled ? `Heard it. Set ${filled}.` : "Heard it. Keep talking or press Stop.",
    });
    setSimilar(findSimilarOrder(next, pastRef.current));
  }

  function toggleVoice() {
    if (listening) return rec.current?.stop();
    const Api = speechApi();
    if (!Api) return;
    const r = new Api();
    r.lang = "en-ZA";
    r.interimResults = false;
    r.continuous = true;
    r.onresult = (e) => heard(e.results[e.results.length - 1][0].transcript);
    r.onerror = (e) => setNote({ text: `Voice stopped: ${e.error}`, error: true });
    r.onend = () => setListening(false);
    rec.current = r;
    setMode("type");
    setNote({
      text: 'Listening… e.g. "40 office chairs to Durban by Friday for 48,000 rand, refund after 3 days, driver gets 15 percent".',
    });
    setListening(true);
    r.start();
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      className={mode === m ? "dm-tab dm-tab--on" : "dm-tab"}
      onClick={() => setMode(m)}
      disabled={disabled}
    >
      {label}
    </button>
  );

  return (
    <div className="dm-field">
      <label htmlFor="o-agreement">Agreement</label>
      <small id="o-agreement-help">
        What, how many, from where to where, and by when. Its fingerprint goes on-chain, and the
        supplier must accept this exact text.
      </small>
      <div role="tablist" aria-label="How to add the agreement" className="dm-tabs">
        {tab("type", "Type")}
        {tab("previous", "Previous orders")}
        {tab("pdf", "Upload PDF")}
      </div>

      {mode === "type" ? (
        <textarea
          id="o-agreement"
          className="dm-in"
          aria-describedby="o-agreement-help"
          placeholder="20 crates of tomatoes, Johannesburg to Polokwane, delivered by Friday."
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setSimilar(findSimilarOrder(value, past))}
          required
        />
      ) : null}

      {mode === "previous" ? (
        <div className="dm-picker" role="tabpanel">
          {real === null ? <span className="bd-muted">Loading your orders…</span> : null}
          {past.map((p) => (
            <button key={p.id} type="button" className="dm-pick" onClick={() => pickPast(p)}>
              <span className="bd-small bd-muted">
                {p.label}
                {p.total ? ` · R ${Number(p.total).toLocaleString("en-ZA")}` : ""}
                {p.seeded ? " · Demo" : ""}
              </span>
              <span>{p.text.length > 140 ? `${p.text.slice(0, 140)}…` : p.text}</span>
            </button>
          ))}
        </div>
      ) : null}

      {mode === "pdf" ? (
        <label className="dm-drop" role="tabpanel">
          <input
            type="file"
            accept="application/pdf"
            className="dm-sr"
            onChange={(e) => void onPdf(e.target.files?.[0])}
          />
          <strong>Choose a PDF</strong>
          <span className="bd-small bd-muted">
            A quote, purchase order or contract. Its text becomes the agreement.
          </span>
        </label>
      ) : null}

      {similar ? (
        <div className="dm-similar" role="status">
          <span>
            Looks like a previous order: <strong>{similar.order.label}</strong> (
            {Math.round(similar.score * 100)}% similar).
          </span>
          <div className="dm-btns">
            <button type="button" className="bd-btn" onClick={() => pickPast(similar.order)}>
              Use its terms
            </button>
            <button type="button" className="dm-btn-ghost" onClick={() => setSimilar(null)}>
              Keep mine
            </button>
          </div>
        </div>
      ) : null}

      <div className="dm-btns" style={{ alignItems: "center" }}>
        <button
          type="button"
          className={listening ? "dm-mic dm-mic--on" : "dm-mic"}
          onClick={toggleVoice}
          disabled={disabled || !canSpeak}
          aria-pressed={listening}
        >
          <svg
            aria-hidden
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
          {listening ? "Stop" : "Speak the order"}
        </button>
        <span className="bd-small bd-muted">
          {canSpeak
            ? "Say the goods, price, refund time and split. It fills the form."
            : "Voice needs Chrome or Edge."}
        </span>
      </div>
      {note ? (
        <p
          role={note.error ? "alert" : "status"}
          className={note.error ? "dm-msg dm-msg--err" : "dm-msg"}
        >
          {note.text}
        </p>
      ) : null}
    </div>
  );
}
