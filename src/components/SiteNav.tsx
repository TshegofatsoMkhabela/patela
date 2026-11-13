"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HeroBar, VIDEO, POSTER } from "@/components/HeroBar";
import { patelaApi } from "@/lib/patela-api";
import { actions, browserEthereum, connectWallet, shortAddr, usePatela } from "@/lib/patela-store";
import { linkConnectedWallet, type LinkOutcome } from "@/lib/wallet-link";
import { mintTestZarp, testZarpAddress, waitForReceipt, zarpBalance } from "@/lib/zarp";

const TEST_ZARP = testZarpAddress(process.env.NEXT_PUBLIC_ZARP_TOKEN_ADDRESS);
const MINT_AMOUNT = "1000";

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

/** Testnet only: mints MockZARP to the connected wallet from the wallet itself. */
function TestZarpButton({ address, className }: { address: string; className: string }) {
  const [busy, setBusy] = useState(false);
  const eth = browserEthereum();
  if (!TEST_ZARP || !eth) return null;
  const token = TEST_ZARP;

  async function mint() {
    if (!eth) return;
    setBusy(true);
    try {
      const hash = await mintTestZarp({ eth, account: address, token, amount: MINT_AMOUNT });
      toast.info(`Mint sent (${shortAddr(hash)}). Waiting for Base Sepolia to confirm…`);
      if (await waitForReceipt(eth, hash)) {
        const balance = await zarpBalance({ eth, account: address, token });
        toast.success(`Test ZARP balance: ${balance}`);
      } else {
        toast.info("Mint not confirmed yet. Check MetaMask for its status.");
      }
    } catch (error) {
      const code = (error as { code?: number }).code;
      toast.error(code === 4001 ? "Mint cancelled." : (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={className}
      onClick={mint}
      disabled={busy}
      title="Testnet only: MockZARP has no value"
    >
      {busy ? "Minting…" : `Get ${MINT_AMOUNT} test ZARP`}
    </button>
  );
}

export function WalletButton({ className = "pt-btn ghost sm" }: { className?: string }) {
  const { wallet } = usePatela();
  if (wallet)
    return (
      <>
        <button className={className} onClick={() => actions.setWallet(null)} title="Disconnect">
          <span className="pt-dot" /> {shortAddr(wallet.address)} · {wallet.chain}
        </button>
        {!wallet.demo && wallet.chain === "Base Sepolia" && (
          <TestZarpButton address={wallet.address} className={className} />
        )}
      </>
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
