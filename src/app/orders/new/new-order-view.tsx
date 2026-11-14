"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isAddress, type Address } from "viem";
import { DemoShell, PageHeader } from "@/components/demo/DemoShell";
import { BalancePanel, formatZarp } from "@/components/BalancePanel";
import { ApiError, api, type Profile } from "@/lib/api";
import { isEmail } from "@/lib/patela-api";
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
  addTokenToWallet,
  DEFAULT_SPLIT,
  type SplitPct,
  signWalletLink,
  type ChainClients,
} from "@/lib/chain";
import { ESCROW_ADDRESS } from "@/lib/contracts";
import { DEMO_EMAILS, demoChainClients } from "@/lib/demo-signer";
import { partyAddresses } from "../[id]/order-data";
import { AgreementInput, type OrderFields } from "./agreement-input";
import { STEP_LABELS, runOrderFlow, type FlowProgress, type FlowState, type StepKey } from "./flow";

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
  const [splitPct, setSplitPct] = useState<SplitPct>(DEFAULT_SPLIT);
  // Voice or a previous order can fill the total, refund time and split.
  const applyFields = (f: OrderFields) => {
    if (f.total) setTotalZarp(f.total);
    if (f.refundHours) setRefundAfterHours(f.refundHours);
    if (f.driverPct !== undefined || f.supplierPickupPct !== undefined)
      setSplitPct((p) => ({
        driverPct: f.driverPct ?? p.driverPct,
        supplierPickupPct: f.supplierPickupPct ?? p.supplierPickupPct,
      }));
  };
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

  const formReady =
    isEmail(supplierEmail.trim()) && agreementText.trim().length >= 10 && Number(totalZarp) > 0;

  async function submit(e: React.FormEvent) {
    const connected = clients;
    e.preventDefault();
    setFormError(null);
    if (!agreementText.trim()) return setFormError("Describe what is being delivered.");
    if (authState !== "in") {
      router.push("/signin?next=/orders/new");
      return;
    }
    setBusy("order");
    try {
      // One click: connect and link the wallet first when that hasn't been done yet.
      const clients =
        connected ?? (NETWORK.local ? demoChainClients("buyer") : await connectMetaMask());
      setClients(clients);
      if (profile?.wallet_address?.toLowerCase() !== clients.account.toLowerCase()) {
        const challenge = await api.walletChallenge(clients.account);
        const signature = await signWalletLink(
          clients.walletClient,
          clients.account,
          challenge.typedData,
        );
        await api.walletLink(challenge.challengeId, signature);
        setProfile(await api.me());
      }
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
          split: splitPct,
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

  // Preview of the fixed 10/40/50 escrow split for the total being typed.
  const total = Number(totalZarp);
  const split =
    Number.isFinite(total) && total > 0
      ? [
          {
            who: "Driver, at pickup",
            pct: splitPct.driverPct,
            amount: (total * splitPct.driverPct) / 100,
          },
          {
            who: "Supplier, at pickup",
            pct: splitPct.supplierPickupPct,
            amount: (total * splitPct.supplierPickupPct) / 100,
          },
          {
            who: "Supplier, at delivery",
            pct: 100 - splitPct.driverPct - splitPct.supplierPickupPct,
            amount: (total * (100 - splitPct.driverPct - splitPct.supplierPickupPct)) / 100,
          },
        ]
      : null;
  const money = (n: number) =>
    `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  return (
    <DemoShell
      current="/orders/new"
      account={
        <>
          <span className="bd-strong">{profile?.email ?? "Not signed in"}</span>
          <span className="bd-small bd-muted">{NETWORK_LABEL}</span>
        </>
      }
    >
      <PageHeader
        eyebrow={`New order · ${NETWORK.name}`}
        title="Agree the terms, then lock the money"
      />

      {!configured ? (
        <p role="alert" className="dm-note" style={{ color: "#ff9b8a" }}>
          Contracts not configured: set NEXT_PUBLIC_ESCROW_ADDRESS and NEXT_PUBLIC_ZARP_ADDRESS.
        </p>
      ) : null}

      <div className="dm-row" style={{ alignItems: "flex-start" }}>
        <form className="dm-card dm-wide" onSubmit={submit}>
          <div className="dm-field">
            <label htmlFor="o-email">Supplier email</label>
            <input
              id="o-email"
              type="email"
              className="dm-in"
              placeholder="supplier@company.co.za"
              value={supplierEmail}
              disabled={locked}
              onChange={(e) => setSupplierEmail(e.target.value)}
              required
            />
          </div>
          <AgreementInput
            value={agreementText}
            onChange={setAgreementText}
            onFields={applyFields}
            disabled={locked}
          />
          <div className="dm-pair">
            <div className="dm-field">
              <label htmlFor="o-total">Total ({NETWORK.tokenSymbol}, 1 = R 1)</label>
              <input
                id="o-total"
                className="dm-in"
                inputMode="decimal"
                value={totalZarp}
                disabled={locked}
                onChange={(e) => setTotalZarp(e.target.value)}
                required
              />
            </div>
            <div className="dm-field">
              <label htmlFor="o-refund">Refund after (hours)</label>
              <input
                id="o-refund"
                type="number"
                min={1}
                className="dm-in"
                value={refundAfterHours}
                disabled={locked}
                onChange={(e) => setRefundAfterHours(Number(e.target.value))}
                required
              />
            </div>
          </div>
          <fieldset className="dm-split">
            <legend>Who is paid when</legend>
            {split ? (
              split.map((s) => (
                <div key={s.who} className="bd-stack-6">
                  <span className="bd-small bd-muted">{s.who}</span>
                  <span className="dm-figure">{money(s.amount)}</span>
                  <span className="bd-small bd-muted">{s.pct}%</span>
                </div>
              ))
            ) : (
              <span className="bd-muted">Enter a total to see the split.</span>
            )}
          </fieldset>
          <small className="bd-muted">
            If the goods never arrive, you can take back what is unpaid after the refund time.
          </small>

          {flow ? (
            <ol className="dm-steps" aria-label="Order progress">
              {(Object.keys(STEP_LABELS) as StepKey[]).map((k, i, all) => {
                const s = flow.steps[k];
                const dot =
                  s.status === "done"
                    ? "dm-dot dm-dot--done"
                    : s.status === "pending"
                      ? "dm-dot dm-dot--now"
                      : s.status === "error"
                        ? "dm-dot dm-dot--err"
                        : "dm-dot";
                return (
                  <li key={k}>
                    <div className="dm-rail" aria-hidden>
                      <span className={dot}>{s.status === "done" ? "✓" : ""}</span>
                      {i < all.length - 1 ? (
                        <span
                          className={s.status === "done" ? "dm-line dm-line--done" : "dm-line"}
                        />
                      ) : null}
                    </div>
                    <div className="dm-step-body">
                      <span className="dm-step-title">
                        {STEP_LABELS[k]}
                        {s.status === "pending" ? (
                          <span className="dm-badge dm-badge--wait">Working</span>
                        ) : null}
                      </span>
                      {s.message ? <span className="dm-msg dm-msg--err">{s.message}</span> : null}
                      {k === "supplier" && s.status === "pending" && progress.acceptUrl ? (
                        <span className="bd-small bd-soft">
                          Invitation sent. Demo: open this link as the supplier (another browser
                          profile or the phone):{" "}
                          <a className="dm-mono" href={progress.acceptUrl}>
                            {progress.acceptUrl}
                          </a>
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : null}
          {formError && !Object.values(flow?.steps ?? {}).some((s) => s.status === "error") ? (
            <p role="alert" className="dm-msg dm-msg--err">
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            className="bd-btn dm-block"
            disabled={busy !== null || !configured || !formReady}
          >
            {busy === "order"
              ? "Working… confirm in your wallet"
              : progress.orderId
                ? "Retry from the failed step"
                : "Send invoice to supplier"}
          </button>
          <small className="bd-muted">
            {!formReady
              ? "Fill in the supplier email, agreement and total to send the invoice."
              : authState !== "in"
                ? "You'll sign in first, then the invoice is sent."
                : !clients || !linked
                  ? "Your wallet connects and links when you send."
                  : "Emails the supplier an invoice and accept link, then locks the money once they accept."}
          </small>
        </form>

        <aside className="dm-narrow bd-stack-10" style={{ gap: 20 }}>
          <section className="dm-card" aria-labelledby="acct-title">
            <h2 id="acct-title" className="bd-h2">
              Your wallet
            </h2>
            {authState === "loading" ? <p className="bd-muted">Checking your session…</p> : null}
            {authState === "out" ? (
              <p style={{ margin: 0 }}>
                You&apos;re not signed in.{" "}
                <Link href="/signin?next=/orders/new">Sign in with an email code</Link>
              </p>
            ) : null}
            {authState === "error" ? (
              <p role="alert" className="dm-msg dm-msg--err">
                {authError}
              </p>
            ) : null}
            {clients ? (
              <div className="bd-stack-6">
                <span className="dm-mono">{clients.account}</span>
                <span className="dm-figure">
                  {formatZarp(zarp)}{" "}
                  <span className="bd-small bd-muted">{NETWORK.tokenSymbol}</span>
                </span>
                {linked ? (
                  <span className="dm-badge dm-badge--ok" style={{ alignSelf: "flex-start" }}>
                    Linked to your account
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="bd-small bd-muted" style={{ margin: 0 }}>
                {NETWORK.local
                  ? "Local demo: use the demo buyer wallet, or MetaMask pointed at http://127.0.0.1:8545."
                  : NETWORK.mintable
                    ? `Connect MetaMask on ${NETWORK.name}. You need a little ETH for gas; get test Rand below.`
                    : "Connect MetaMask. You need CELO for gas and ZARm to fund the order."}
              </p>
            )}
            <div className="dm-btns">
              {NETWORK.local && !clients ? (
                <button
                  type="button"
                  className="bd-btn"
                  onClick={() => connect(true)}
                  disabled={busy !== null}
                >
                  Use demo buyer wallet
                </button>
              ) : null}
              <button
                type="button"
                className={clients ? "dm-btn-ghost" : "bd-btn"}
                onClick={() => connect()}
                disabled={busy !== null}
              >
                {clients
                  ? "Reconnect MetaMask"
                  : busy === "connect"
                    ? "Connecting…"
                    : "Connect MetaMask"}
              </button>
              {clients && authState === "in" && !linked ? (
                <button type="button" className="bd-btn" onClick={link} disabled={busy !== null}>
                  {busy === "link" ? "Sign in MetaMask…" : "Link wallet to account"}
                </button>
              ) : null}
              {clients && canMintTestToken() && configured ? (
                <button
                  type="button"
                  className="dm-btn-ghost"
                  onClick={mint}
                  disabled={busy !== null}
                >
                  {busy === "mint" ? "Minting…" : "Get test Rand"}
                </button>
              ) : null}
              {clients && configured && !NETWORK.local ? (
                <button
                  type="button"
                  className="dm-btn-ghost"
                  onClick={() =>
                    void addTokenToWallet().then(
                      (ok) =>
                        ok &&
                        setWalletMsg({ text: `${NETWORK.tokenSymbol} now shows in MetaMask.` }),
                      (err) => setWalletMsg({ text: contractErrorMessage(err), error: true }),
                    )
                  }
                >
                  Add {NETWORK.tokenSymbol} to MetaMask
                </button>
              ) : null}
            </div>
            {walletMsg ? (
              <p
                role={walletMsg.error ? "alert" : "status"}
                className={walletMsg.error ? "dm-msg dm-msg--err" : "dm-msg"}
              >
                {walletMsg.text}
              </p>
            ) : null}
          </section>

          <section className="dm-card" aria-labelledby="next-title">
            <h2 id="next-title" className="bd-h2">
              What happens next
            </h2>
            <ol className="bd-stack-10" style={{ margin: 0, paddingLeft: 18 }}>
              <li>The supplier gets an email link and accepts this exact agreement.</li>
              <li>You create the order on-chain and lock the total in escrow.</li>
              <li>Each QR handoff releases the next payment.</li>
            </ol>
          </section>
        </aside>
      </div>

      {configured ? (
        <section className="dm-card" aria-label="Live balances">
          <BalancePanel
            addresses={{
              buyer: clients?.account ?? null,
              supplier: progress.supplierWallet ?? null,
              driver: null,
              escrow: ESCROW_ADDRESS,
            }}
          />
        </section>
      ) : null}
    </DemoShell>
  );
}
