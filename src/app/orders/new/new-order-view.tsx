"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isAddress, type Address } from "viem";
import { SiteNav } from "@/components/SiteNav";
import { BalancePanel, formatZarp } from "@/components/BalancePanel";
import { ApiError, api, type Profile } from "@/lib/api";
import {
  connectMetaMask,
  contractErrorMessage,
  contractsConfigured,
  createAndFundOrder,
  getTestZarp,
  canMintTestToken,
  NETWORK,
  NETWORK_LABEL,
  readBalances,
  signWalletLink,
  type ChainClients,
} from "@/lib/chain";
import { ESCROW_ADDRESS } from "@/lib/contracts";
import { DEMO_EMAILS, demoChainClients } from "@/lib/demo-signer";
import { partyAddresses } from "../[id]/order-data";
import { STEP_LABELS, runOrderFlow, type FlowProgress, type FlowState, type StepKey } from "./flow";

const STATUS_ICON = { idle: "○", pending: "…", done: "✓", error: "✕" } as const;
const STATUS_COLOR = {
  idle: "#7c8596",
  pending: "#ffe2b2",
  done: "#9fd6a8",
  error: "#ff9b8a",
} as const;

export function NewOrderView() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authState, setAuthState] = useState<"loading" | "in" | "out" | "error">("loading");
  const [authError, setAuthError] = useState<string | null>(null);
  const [clients, setClients] = useState<ChainClients | null>(null);
  const [zarp, setZarp] = useState<bigint | null>(null);
  const [walletMsg, setWalletMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Local chain: prefill the demo supplier persona's email.
  const [supplierEmail, setSupplierEmail] = useState(NETWORK.local ? DEMO_EMAILS.supplier : "");
  const [totalZarp, setTotalZarp] = useState("100");
  const [refundAfterHours, setRefundAfterHours] = useState(72);
  const [agreementText, setAgreementText] = useState("");
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [progress, setProgress] = useState<FlowProgress>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    api.me().then(
      (me) => {
        setProfile(me);
        setAuthState("in");
      },
      (err) => {
        if (err instanceof ApiError && err.status === 401) setAuthState("out");
        else {
          setAuthState("error");
          setAuthError(err instanceof Error ? err.message : String(err));
        }
      },
    );
  }, []);

  const refreshZarp = useCallback(async (c: ChainClients) => {
    try {
      const { me } = await readBalances(c.publicClient, { me: c.account }, c.zarp);
      setZarp(me);
    } catch {
      /* balance is informational */
    }
  }, []);

  const linked = Boolean(
    profile?.wallet_address &&
    clients &&
    profile.wallet_address.toLowerCase() === clients.account.toLowerCase(),
  );
  const configured = contractsConfigured();
  const locked = Boolean(progress.orderId); // fields frozen once the order exists off-chain

  async function connect(demo = false) {
    setBusy("connect");
    setWalletMsg(null);
    try {
      const c = demo ? demoChainClients("buyer") : await connectMetaMask();
      setClients(c);
      setWalletMsg({
        text: demo
          ? "Demo buyer wallet (Hardhat dev account #1) on the local chain."
          : `MetaMask connected on ${NETWORK.name}.`,
      });
      void refreshZarp(c);
    } catch (err) {
      setWalletMsg({ text: contractErrorMessage(err), error: true });
    } finally {
      setBusy(null);
    }
  }

  async function link() {
    if (!clients) return;
    setBusy("link");
    setWalletMsg(null);
    try {
      const challenge = await api.walletChallenge(clients.account);
      const signature = await signWalletLink(
        clients.walletClient,
        clients.account,
        challenge.typedData,
      );
      await api.walletLink(challenge.challengeId, signature);
      setProfile(await api.me());
      setWalletMsg({ text: "Wallet linked to your Patela account." });
    } catch (err) {
      setWalletMsg({ text: contractErrorMessage(err), error: true });
    } finally {
      setBusy(null);
    }
  }

  async function mint() {
    if (!clients) return;
    setBusy("mint");
    setWalletMsg(null);
    try {
      await getTestZarp(clients);
      await refreshZarp(clients);
      setWalletMsg({ text: `Minted 1,000 test ${NETWORK.tokenSymbol} to your wallet.` });
    } catch (err) {
      setWalletMsg({ text: contractErrorMessage(err), error: true });
    } finally {
      setBusy(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clients) return;
    setFormError(null);
    if (!agreementText.trim()) return setFormError("Describe what is being delivered.");
    setBusy("order");
    try {
      const result = await runOrderFlow(
        {
          createOrder: api.createOrder,
          recordChainOrder: api.recordChainOrder,
          verifyFunding: api.verifyFunding,
          waitForSupplier: async (orderId) => {
            // The supplier accepts from the emailed link; their linked wallet is the on-chain supplier.
            for (;;) {
              const wallet = partyAddresses(await api.getOrder(orderId), ESCROW_ADDRESS).supplier;
              if (wallet && isAddress(wallet)) return wallet as Address;
              await new Promise((r) => setTimeout(r, 2500));
            }
          },
          createAndFund: (params, onStep) => createAndFundOrder(clients, params, onStep),
        },
        {
          supplierEmail,
          totalZarp,
          refundAfterHours,
          agreementText,
        },
        progress,
        (s) => {
          setFlow(s);
          setProgress(s.progress);
        },
      );
      void refreshZarp(clients);
      router.push(`/orders/${encodeURIComponent(result.orderId)}`);
    } catch (err) {
      setFormError(contractErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="pt-app" style={{ minHeight: "100vh" }}>
      <SiteNav />
      <main className="pt-wrap" style={{ maxWidth: 900, padding: "40px 20px 100px" }}>
        <span className="badge badge-gold" style={{ fontSize: "0.85rem" }}>
          {NETWORK_LABEL}
        </span>
        <h1 className="pt-h2" style={{ margin: "12px 0 8px" }}>
          New escrow order
        </h1>
        <p className="pt-lead" style={{ margin: "0 0 28px", maxWidth: "60ch" }}>
          Lock {NETWORK.tokenSymbol} in escrow. Pickup pays the driver 10% and the supplier 40%;
          delivery pays the supplier the remaining 50%.
        </p>

        {!configured ? (
          <p role="alert" className="pt-card" style={{ padding: 18, color: "#ff9b8a" }}>
            Contracts not configured: set NEXT_PUBLIC_ESCROW_ADDRESS and NEXT_PUBLIC_ZARP_ADDRESS.
          </p>
        ) : null}

        {configured ? (
          <div style={{ marginBottom: 28 }}>
            <BalancePanel
              addresses={{
                buyer: clients?.account ?? null,
                supplier: progress.supplierWallet ?? null,
                driver: null,
                escrow: ESCROW_ADDRESS,
              }}
            />
          </div>
        ) : null}

        {/* 1. Account */}
        <section className="pt-card" style={{ padding: "24px 28px", marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: "1.15rem" }}>1. Account</h2>
          {authState === "loading" ? <p style={{ margin: 0 }}>Checking your session…</p> : null}
          {authState === "out" ? (
            <p style={{ margin: 0 }}>
              You&apos;re not signed in.{" "}
              <Link
                href="/signin?next=/orders/new"
                style={{ color: "#ffe2b2", textDecoration: "underline" }}
              >
                Sign in with an email code
              </Link>
            </p>
          ) : null}
          {authState === "error" ? (
            <p role="alert" style={{ margin: 0, color: "#ff9b8a" }}>
              {authError}
            </p>
          ) : null}
          {authState === "in" && profile ? (
            <p style={{ margin: 0 }}>
              Signed in as <strong>{profile.email}</strong>
            </p>
          ) : null}
        </section>

        {/* 2. Wallet */}
        <section className="pt-card" style={{ padding: "24px 28px", marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: "1.15rem" }}>2. Wallet</h2>
          {clients ? (
            <p style={{ margin: "0 0 12px", fontFamily: "monospace" }}>
              {clients.account} · {formatZarp(zarp)} {NETWORK.tokenSymbol}{" "}
              {linked ? "· linked ✓" : ""}
            </p>
          ) : (
            <p style={{ margin: "0 0 12px", color: "#a2a9b8" }}>
              {NETWORK.local
                ? "Local demo: use the demo buyer wallet (a Hardhat dev account that already holds MockZARP), or MetaMask pointed at http://127.0.0.1:8545."
                : NETWORK.mintable
                  ? `Connect the MetaMask extension on ${NETWORK.name}. You need a little ETH for gas; mint test MockZARP below.`
                  : "Connect the MetaMask extension. You need a little CELO for gas and ZARm to fund the order: on Celo Sepolia, get CELO from the Celo faucet and swap some for ZARm in the Mento app."}
            </p>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {NETWORK.local && !clients ? (
              <button
                type="button"
                className="pt-btn"
                onClick={() => connect(true)}
                disabled={busy !== null}
              >
                Use demo buyer wallet
              </button>
            ) : null}
            <button type="button" className="pt-btn" onClick={() => connect()} disabled={busy !== null}>
              {clients
                ? "Reconnect MetaMask"
                : busy === "connect"
                  ? "Connecting…"
                  : "Connect MetaMask"}
            </button>
            {clients && authState === "in" && !linked ? (
              <button type="button" className="pt-btn" onClick={link} disabled={busy !== null}>
                {busy === "link" ? "Sign in MetaMask…" : "Link wallet to account"}
              </button>
            ) : null}
            {clients && canMintTestToken() && configured ? (
              <button type="button" className="pt-btn" onClick={mint} disabled={busy !== null}>
                {busy === "mint" ? "Minting…" : "Get test MockZARP"}
              </button>
            ) : null}
          </div>
          {walletMsg ? (
            <p
              role={walletMsg.error ? "alert" : "status"}
              style={{ margin: "12px 0 0", color: walletMsg.error ? "#ff9b8a" : "#9fd6a8" }}
            >
              {walletMsg.text}
            </p>
          ) : null}
        </section>

        {/* 3. Order */}
        <form
          className="pt-form pt-card"
          onSubmit={submit}
          style={{ padding: "24px 28px", marginTop: 0 }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: "1.15rem" }}>3. Order</h2>
          <div className="pt-field">
            <label htmlFor="o-email">Supplier email (gets the accept link)</label>
            <input
              id="o-email"
              type="email"
              className="pt-in"
              value={supplierEmail}
              disabled={locked}
              onChange={(e) => setSupplierEmail(e.target.value)}
              required
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="pt-field">
              <label htmlFor="o-total">Total ({NETWORK.tokenSymbol})</label>
              <input
                id="o-total"
                className="pt-in"
                inputMode="decimal"
                value={totalZarp}
                disabled={locked}
                onChange={(e) => setTotalZarp(e.target.value)}
                required
              />
            </div>
            <div className="pt-field">
              <label htmlFor="o-refund">Refund after (hours)</label>
              <input
                id="o-refund"
                type="number"
                min={1}
                className="pt-in"
                value={refundAfterHours}
                disabled={locked}
                onChange={(e) => setRefundAfterHours(Number(e.target.value))}
                required
              />
            </div>
          </div>
          <div className="pt-field">
            <label htmlFor="o-agreement">Agreement (what is delivered, where, when)</label>
            <textarea
              id="o-agreement"
              className="pt-in"
              rows={4}
              value={agreementText}
              disabled={locked}
              onChange={(e) => setAgreementText(e.target.value)}
              required
            />
          </div>

          {flow ? (
            <ol
              style={{
                listStyle: "none",
                padding: 0,
                margin: "8px 0 16px",
                display: "grid",
                gap: 8,
              }}
            >
              {(Object.keys(STEP_LABELS) as StepKey[]).map((k) => {
                const s = flow.steps[k];
                return (
                  <li key={k} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <span
                      aria-hidden
                      style={{ color: STATUS_COLOR[s.status], fontWeight: 700, width: 18 }}
                    >
                      {STATUS_ICON[s.status]}
                    </span>
                    <span>
                      {STEP_LABELS[k]}
                      {s.message ? (
                        <span style={{ display: "block", color: STATUS_COLOR.error }}>
                          {s.message}
                        </span>
                      ) : null}
                      {k === "supplier" && s.status === "pending" && progress.acceptUrl ? (
                        <span style={{ display: "block", fontSize: "0.85rem", wordBreak: "break-all" }}>
                          Demo inbox: open this link as the supplier (another browser profile or
                          private window): <a href={progress.acceptUrl}>{progress.acceptUrl}</a>
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}
          {formError && !Object.values(flow?.steps ?? {}).some((s) => s.status === "error") ? (
            <p role="alert" style={{ color: "#ff9b8a" }}>
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            className="pt-btn"
            disabled={busy !== null || !clients || !linked || !configured}
            style={{ width: "100%", justifyContent: "center", padding: 13 }}
          >
            {busy === "order"
              ? "Working… confirm in MetaMask"
              : progress.orderId
                ? "Retry from the failed step"
                : "Create and fund order"}
          </button>
          {!clients || !linked ? (
            <p style={{ color: "#a2a9b8", fontSize: "0.85rem", margin: "10px 0 0" }}>
              Sign in, connect MetaMask and link the wallet first.
            </p>
          ) : null}
        </form>
      </main>
    </div>
  );
}
