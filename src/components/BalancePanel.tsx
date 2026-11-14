"use client";

// Explicit React import: vitest here uses the classic JSX transform (tsconfig jsx: "preserve").
import React, { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { ZARM_DECIMALS } from "@/lib/contracts";
import { NETWORK, NETWORK_LABEL, createReadClient, readBalances } from "@/lib/escrow-chain";

void React;

export type Role = "buyer" | "supplier" | "driver" | "escrow";
export type PartyAddresses = Record<Role, string | null | undefined>;
export type Balances = Record<Role, bigint | null>;

const ROLES: { key: Role; label: string; accent: string }[] = [
  { key: "buyer", label: "Buyer", accent: "#ffe2b2" },
  { key: "supplier", label: "Supplier", accent: "#7ea6e0" },
  { key: "driver", label: "Driver", accent: "#9fd6a8" },
  { key: "escrow", label: "Escrow", accent: "#d9c39a" },
];

/** Wei → "1,234.56" (rounded down to 2 decimals); null → "—". */
export function formatZarp(wei: bigint | null | undefined): string {
  if (wei === null || wei === undefined) return "—";
  const [whole, frac = ""] = formatUnits(wei, ZARM_DECIMALS).split(".");
  return `${BigInt(whole).toLocaleString("en-US")}.${(frac + "00").slice(0, 2)}`;
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Read now, then every `intervalMs`. Ticks never overlap: the next read is scheduled only after
 * the previous one settles. Returns a stop function.
 */
export function startBalancePolling<T>(
  read: () => Promise<T>,
  onUpdate: (value: T) => void,
  onError: (message: string) => void,
  intervalMs = 2000,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    try {
      const value = await read();
      if (!stopped) onUpdate(value);
    } catch (err) {
      if (!stopped) onError(err instanceof Error ? err.message : String(err));
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  timer = setTimeout(tick, 0);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

export function BalancePanelView({
  addresses,
  balances,
  error,
}: {
  addresses: PartyAddresses;
  balances: Balances | null;
  error?: string | null;
}) {
  return (
    <section aria-label="Wallet balances" style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 14,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700 }}>Live balances</h2>
        <span className="badge badge-gold" style={{ fontSize: "0.85rem" }}>
          {NETWORK_LABEL}
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {ROLES.map(({ key, label, accent }) => {
          const address = addresses[key];
          return (
            <div
              key={key}
              className="pt-card"
              style={{ padding: "22px 24px", borderTop: `4px solid ${accent}`, marginTop: 0 }}
            >
              <div
                style={{
                  fontSize: "1.1rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: accent,
                  fontWeight: 700,
                }}
              >
                {label}
              </div>
              <div
                aria-live="polite"
                style={{
                  fontSize: "clamp(2rem, 4vw, 3.2rem)",
                  fontWeight: 800,
                  margin: "10px 0 4px",
                  fontVariantNumeric: "tabular-nums",
                  color: "#fff",
                }}
              >
                {formatZarp(address ? balances?.[key] : null)}
                <span
                  style={{ fontSize: "1rem", fontWeight: 600, marginLeft: 8, color: "#a2a9b8" }}
                >
                  {NETWORK.tokenSymbol}
                </span>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: "0.95rem", color: "#a2a9b8" }}>
                {address ? short(address) : "Not assigned yet"}
              </div>
            </div>
          );
        })}
      </div>
      {error ? (
        <p role="alert" style={{ color: "#ff9b8a", marginTop: 12, fontSize: "1rem" }}>
          Couldn&apos;t read balances: {error}
        </p>
      ) : null}
    </section>
  );
}

/** Four-wallet panel that reads ZARm balances from the chain every ~2 seconds. */
export function BalancePanel({
  addresses,
  intervalMs = 2000,
}: {
  addresses: PartyAddresses;
  intervalMs?: number;
}) {
  const [balances, setBalances] = useState<Balances | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = ROLES.map((r) => addresses[r.key] ?? "").join(",");
  const client = useMemo(() => createReadClient(), []);

  useEffect(() => {
    const current = {
      buyer: addresses.buyer,
      supplier: addresses.supplier,
      driver: addresses.driver,
      escrow: addresses.escrow,
    };
    return startBalancePolling(
      () => readBalances(client, current),
      (b) => {
        setBalances(b);
        setError(null);
      },
      setError,
      intervalMs,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the address values
  }, [key, client, intervalMs]);

  return <BalancePanelView addresses={addresses} balances={balances} error={error} />;
}
