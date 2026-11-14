"use client";

// Shared pieces for the order screens: who is signed in, which wallet is connected, a task runner
// that turns wallet and contract failures into readable messages, and the page frame.
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { formatUnits, type Address, type Hex } from "viem";
import { SiteNav } from "@/components/SiteNav";
import { TARGET_CHAIN_NAME, type Eth } from "@/lib/chain";
import { ZARM_DECIMALS } from "@/lib/contracts";
import { contractErrorMessage } from "@/lib/handoff";
import { verifyUntilConfirmed } from "@/lib/order-flow";
import { ApiError, patelaApi, type Profile } from "@/lib/patela-api";
import {
  browserEthereum,
  connectWallet,
  liveEthereum,
  shortAddr,
  usePatela,
} from "@/lib/patela-store";
import { linkConnectedWallet } from "@/lib/wallet-link";
import { waitForReceipt } from "@/lib/zarp";
import "@/styles/orders.css";

/** Rand display of a ZARm wei amount, e.g. "R1 000,00". */
export function zar(wei: string | bigint | null | undefined) {
  if (wei === null || wei === undefined) return "—";
  const value = Number(formatUnits(BigInt(wei), ZARM_DECIMALS));
  return `R${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : contractErrorMessage(error);
}

/** After a wallet transaction: wait until it is mined, then have the backend check its events. */
export async function confirmTx(
  eth: Eth,
  hash: Hex,
  say: (status: string) => void,
  verify: () => Promise<unknown>,
) {
  say("Waiting for Celo to confirm…");
  if (!(await waitForReceipt(eth, hash))) throw new Error("Still pending. Reload in a minute.");
  say("Checking it on Celo…");
  return verifyUntilConfirmed(verify);
}

/** Runs one step at a time, with a status line while it runs and a toast if it fails. */
export function useTask() {
  const [status, setStatus] = useState<string | null>(null);
  const run = useCallback(
    async (label: string, task: (say: (s: string) => void) => Promise<void>) => {
      setStatus(label);
      try {
        await task(setStatus);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setStatus(null);
      }
    },
    [],
  );
  return { busy: status !== null, status, run };
}

export type Session = {
  /** undefined while loading, null when signed out. */
  profile: Profile | null | undefined;
  /** Reads window.ethereum at each call, so a late-injected wallet still works. */
  eth: Eth;
  /** The connected MetaMask account, only when it is the wallet linked to this profile. */
  account: Address | null;
  connectedAddress: string | null;
  connect: () => Promise<void>;
};

export function useSession(): Session {
  const { wallet } = usePatela();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const refresh = useCallback(async () => {
    setProfile(await patelaApi.me().catch(() => null));
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connectedAddress = wallet && !wallet.demo ? wallet.address : null;
  const linked = profile?.wallet_address?.toLowerCase();
  const account =
    connectedAddress && linked === connectedAddress.toLowerCase()
      ? (connectedAddress as Address)
      : null;

  async function connect() {
    const result = await connectWallet();
    if (!result.wallet || result.wallet.demo) {
      toast.error(result.wallet?.demo ? "Install MetaMask to use real orders." : result.message);
      return;
    }
    // Read the provider now, not from render: an extension can inject it after the page loads.
    const outcome = await linkConnectedWallet(patelaApi, browserEthereum(), result.wallet);
    if (outcome.status === "failed") toast.error(`Wallet not linked: ${outcome.message}`);
    if (outcome.status === "declined") toast.info("Wallet not linked: the signature was declined.");
    await refresh();
  }

  return { profile, eth: liveEthereum, account, connectedAddress, connect };
}

function SignInPrompt() {
  const [next, setNext] = useState("/orders");
  useEffect(() => setNext(window.location.pathname + window.location.search), []);
  return (
    <div className="pt-card pt-order-panel">
      <p>Sign in with your email to continue.</p>
      <Link className="pt-btn" href={`/signin?next=${encodeURIComponent(next)}`}>
        Sign in
      </Link>
    </div>
  );
}

function WalletPrompt({ session }: { session: Session }) {
  const linked = session.profile?.wallet_address;
  return (
    <div className="pt-card pt-order-panel">
      {session.connectedAddress && linked ? (
        <p>
          MetaMask is on {shortAddr(session.connectedAddress)}, but your account is linked to{" "}
          {shortAddr(linked)}. Switch account in MetaMask, then reconnect.
        </p>
      ) : (
        <p>Connect MetaMask on {TARGET_CHAIN_NAME}. You sign every payment step yourself.</p>
      )}
      <button className="pt-btn" onClick={() => void session.connect()}>
        Connect MetaMask
      </button>
    </div>
  );
}

/**
 * Page frame with the test-network label. Children render once the visitor is signed in and,
 * when `needsWallet`, has their linked MetaMask wallet connected.
 */
export function OrderPage({
  eyebrow,
  title,
  session,
  needsWallet = true,
  children,
}: {
  eyebrow: string;
  title: string;
  session: Session;
  needsWallet?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="pt-app">
      <SiteNav />
      <main className="pt-wrap pt-orders">
        <span className="pt-eyebrow">{eyebrow}</span>
        <h1 className="pt-h2">{title}</h1>
        <p className="pt-testnet" role="note">
          {TARGET_CHAIN_NAME} test network: test ZARm only, no real money.
        </p>
        {session.profile === undefined ? (
          <p className="pt-lead">Loading…</p>
        ) : session.profile === null ? (
          <SignInPrompt />
        ) : needsWallet && !session.account ? (
          <WalletPrompt session={session} />
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export function StatusLine({ status }: { status: string | null }) {
  return status ? (
    <p className="pt-order-status" role="status" aria-live="polite">
      {status}
    </p>
  ) : null;
}
