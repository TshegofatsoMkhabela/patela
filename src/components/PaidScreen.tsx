"use client";

import { NETWORK_LABEL, explorerTxUrl } from "@/lib/chain";
import { PhoneShell } from "@/components/demo/DemoShell";

/** Full-screen confirmation after a handoff's release transaction is confirmed. */
export function PaidScreen({
  seconds,
  txHash,
  stage,
}: {
  seconds: number;
  txHash: string;
  stage: 1 | 2;
}) {
  // The local Hardhat chain has no explorer, so the hash is shown instead of a link.
  const txUrl = explorerTxUrl(txHash);
  return (
    <PhoneShell who={stage === 1 ? "Pickup" : "Delivery"}>
      <div role="status" className="bd-stack-10" style={{ flex: 1 }}>
        <div className="dm-paid-mark" aria-hidden>
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <div className="dm-center bd-stack-8">
          <span className="bd-label" style={{ color: "#8ee6b4" }}>
            {stage === 1 ? "Pickup confirmed" : "Delivery confirmed"}
          </span>
          <h1>Payment released</h1>
          <p className="dm-lead" style={{ margin: "0 auto" }}>
            {stage === 1
              ? "10% to the driver and 40% to the supplier"
              : "The last 50% to the supplier"}
            , straight from escrow in {seconds.toFixed(1)} s.
          </p>
        </div>
        <div className="dm-push bd-stack-8">
          {txUrl ? (
            <a className="dm-btn-ghost dm-block" href={txUrl} target="_blank" rel="noreferrer">
              View transaction ↗
            </a>
          ) : (
            <p className="dm-note dm-mono">Transaction {txHash}</p>
          )}
          <p className="dm-center bd-small bd-muted" style={{ margin: 0 }}>
            {NETWORK_LABEL}
          </p>
        </div>
      </div>
    </PhoneShell>
  );
}
