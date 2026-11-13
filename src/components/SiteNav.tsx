"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HeroBar, VIDEO, POSTER } from "@/components/HeroBar";
import { patelaApi } from "@/lib/patela-api";
import { actions, browserEthereum, connectWallet, shortAddr, usePatela } from "@/lib/patela-store";
import {
  isUserRejection,
  TARGET_CHAIN_NAME,
  TARGET_ZARM_ADDRESS,
  tokenAddress,
  type Eth,
} from "@/lib/chain";
import { linkConnectedWallet, type LinkOutcome } from "@/lib/wallet-link";

const ZARM = tokenAddress(TARGET_ZARM_ADDRESS);

function reportLink(outcome: LinkOutcome) {
  switch (outcome.status) {
    case "linked":
      return toast.success("Wallet linked to your Patela account.");
    case "signed-out":
      return toast.info("Sign in to link this wallet to your Patela account.");
    case "declined":
      return toast.info("Wallet not linked: the signature was declined.");
    case "failed":
      return toast.error(`Wallet not linked: ${outcome.message}`);
  }
}

/**
 * Shows the connected wallet's real ZARm balance. Acquisition happens through Mento;
 * Patela never mints production payment tokens or holds a buyer's private key.
 */
export function ZarmBalanceButton({ className = "pt-btn ghost" }: { className?: string }) {
  const { wallet } = usePatela();
  const [busy, setBusy] = useState(false);
  const eth = browserEthereum();
  if (!ZARM || !eth || !wallet || wallet.demo || wallet.chain !== TARGET_CHAIN_NAME) return null;

  async function showBalance(eth: Eth, token: string, address: string) {
    setBusy(true);
    try {
      // viem is only needed here, so it loads on click instead of on every page.
      const { zarmBalance } = await import("@/lib/zarp");
      const balance = await zarmBalance({ eth, account: address, token });
      toast.success(`ZARm balance: ${balance}`);
    } catch (error) {
      toast.error(isUserRejection(error) ? "Request cancelled." : (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={className}
      onClick={() => showBalance(eth, ZARM, wallet.address)}
      disabled={busy}
      title="Check your Mento ZARm balance"
    >
      {busy ? "Checking…" : "ZARm balance"}
    </button>
  );
}

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
        if (r.wallet) reportLink(await linkConnectedWallet(patelaApi, browserEthereum(), r.wallet));
      }}
    >
      Connect Celo wallet
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
