"use client";

/** Full-screen confirmation after a handoff's release transaction is confirmed. */
export function PaidScreen({ seconds, txHash, stage }: { seconds: number; txHash: string; stage: 1 | 2 }) {
  return (
    <div role="status" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-emerald-600 text-white">
      <p className="text-8xl font-bold tracking-tight">PAID</p>
      <p className="text-2xl">{stage === 1 ? "Pickup" : "Delivery"} payment released in {seconds.toFixed(1)} s</p>
      <a
        className="underline opacity-90"
        href={`https://sepolia.basescan.org/tx/${txHash}`}
        target="_blank"
        rel="noreferrer"
      >
        View transaction
      </a>
      <p className="text-sm opacity-75">Base Sepolia testnet · MockZARP demo</p>
    </div>
  );
}
