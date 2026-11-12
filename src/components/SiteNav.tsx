"use client";

import { toast } from "sonner";
import { HeroBar, VIDEO, POSTER } from "@/components/HeroBar";
import { connectWallet, shortAddr, usePatela, actions } from "@/lib/patela-store";

export function WalletButton({ className = "pt-btn ghost sm" }: { className?: string }) {
  const { wallet } = usePatela();
  if (wallet)
    return (
      <button className={className} onClick={() => actions.setWallet(null)} title="Disconnect">
        <span className="pt-dot" /> {shortAddr(wallet.address)} · {wallet.chain}
      </button>
    );
  return (
    <button
      className={className}
      onClick={async () => {
        const r = await connectWallet();
        (r.ok ? toast.success : toast.error)(r.message);
      }}
    >
      Connect testnet wallet
    </button>
  );
}

export function SiteNav() {
  return (
    <>
      <video
        className="pt-bgv"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        poster={POSTER}
        src={VIDEO}
      />
      <div className="pt-frost" aria-hidden="true" />
      <div className="patela patela-sub">
        <HeroBar />
      </div>
    </>
  );
}
