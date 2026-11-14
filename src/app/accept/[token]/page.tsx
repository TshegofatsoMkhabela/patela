"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Address, Hex, TypedDataDefinition } from "viem";
import { DemoShell, PageHeader } from "@/components/demo/DemoShell";
import { connectEmbeddedWallet, type WalletSigner } from "@/lib/embedded-wallet";
import { demoSignerAvailable, demoWalletSigner } from "@/lib/demo-signer";
import { contractErrorMessage } from "@/lib/handoff";
import { browserApi } from "../../handoff/handoff-api";
import { readChainOrderId, readWallet } from "../../handoff/handoff-flow";

// Supplier / driver onboarding from the emailed link (INTERFACES §1 steps 5–6, §4 web handoff rows).

type Invitation = {
  orderId: string;
  role: "supplier" | "driver";
  email: string;
  agreementText: string;
  agreementHash: Hex;
};
type Step =
  | "loading"
  | "sign-in"
  | "code"
  | "wallet"
  | "await-funding"
  | "accept"
  | "invite-driver"
  | "await-driver"
  | "assign"
  | "done";

export default function AcceptPage() {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [code, setCode] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driver, setDriver] = useState<Address | null>(null);
  const [signer, setSigner] = useState<WalletSigner | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // LOCAL DEMO: the backend returns sign-in codes and invite links instead of emailing them.
  const [demoNote, setDemoNote] = useState<string | null>(null);
  const localDemo = demoSignerAvailable();

  useEffect(() => {
    (async () => {
      try {
        const inv = (await browserApi.request(
          "GET",
          `/invitations/${encodeURIComponent(token)}`,
        )) as Invitation;
        setInvite(inv);
        // Only a session for the invited email counts (another persona may be signed in here).
        const me = (await browserApi.request("GET", "/me").catch(() => null)) as {
          email?: string;
        } | null;
        setStep(me?.email?.toLowerCase() === inv.email.toLowerCase() ? "wallet" : "sign-in");
      } catch (err) {
        setError(contractErrorMessage(err));
      }
    })();
  }, [token]);

  // Supplier: acceptOrder needs a funded escrow, and the buyer funds only after this acceptance.
  useEffect(() => {
    if (step !== "await-funding" || !invite) return;
    const t = setInterval(async () => {
      const order = (await browserApi
        .request("GET", `/orders/${encodeURIComponent(invite.orderId)}`)
        .catch(() => null)) as {
        status?: string;
      } | null;
      if (order?.status === "funded") setStep("accept");
    }, 3000);
    return () => clearInterval(t);
  }, [step, invite]);

  // Supplier: wait for the invited driver to link a wallet.
  useEffect(() => {
    if (step !== "await-driver" || !invite) return;
    const t = setInterval(async () => {
      const order = await browserApi
        .request("GET", `/orders/${encodeURIComponent(invite.orderId)}`)
        .catch(() => null);
      const d = readWallet(order, "driver");
      if (d) {
        setDriver(d);
        setStep("assign");
      }
    }, 3000);
    return () => clearInterval(t);
  }, [step, invite]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(contractErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const requestCode = () =>
    run("Sending code…", async () => {
      const sent = (await browserApi.request("POST", "/auth/otp/request", {
        email: invite!.email,
      })) as {
        code?: string;
      };
      if (sent?.code) {
        setCode(sent.code);
        setDemoNote(`Demo inbox: your sign-in code is ${sent.code} (filled in for you).`);
      }
      setStep("code");
    });

  const verifyCode = () =>
    run("Checking code…", async () => {
      await browserApi.request("POST", "/auth/otp/verify", {
        email: invite!.email,
        code: code.trim(),
      });
      setStep("wallet");
    });

  const createWallet = () =>
    run("Creating your wallet…", async () => {
      // Local chain: the invited persona signs with its Hardhat dev account (demo only).
      const s = localDemo
        ? demoWalletSigner(invite!.role)
        : await connectEmbeddedWallet(invite!.email);
      const challenge = (await browserApi.request("POST", "/wallet/challenge", {
        wallet: s.address,
      })) as {
        challengeId: string;
        typedData: TypedDataDefinition & { message: Record<string, unknown> };
      };
      const td = challenge.typedData;
      const message = { ...td.message, expiresAt: BigInt(td.message.expiresAt as string) };
      const signature = await s.signTypedData({ ...td, message } as TypedDataDefinition);
      await browserApi.request("POST", "/wallet/link", {
        challengeId: challenge.challengeId,
        signature,
      });
      await browserApi.request("POST", `/invitations/${encodeURIComponent(token)}/accept`, {
        walletAddress: s.address,
      });
      setSigner(s);
      setStep(invite!.role === "supplier" ? "await-funding" : "done");
    });

  const acceptOrder = () =>
    run("Accepting on-chain (gas sponsored)…", async () => {
      const order = await browserApi.request(
        "GET",
        `/orders/${encodeURIComponent(invite!.orderId)}`,
      );
      const txHash = await signer!.writeEscrow({
        functionName: "acceptOrder",
        args: [readChainOrderId(order), invite!.agreementHash],
      });
      await signer!.waitForReceipt(txHash);
      await browserApi.request(
        "POST",
        `/orders/${encodeURIComponent(invite!.orderId)}/acceptance/verify`,
        { txHash },
      );
      setStep("invite-driver");
    });

  const inviteDriver = () =>
    run("Inviting driver…", async () => {
      const sent = (await browserApi.request(
        "POST",
        `/orders/${encodeURIComponent(invite!.orderId)}/driver-invite`,
        {
          email: driverEmail.trim(),
        },
      )) as { acceptUrl?: string };
      if (sent?.acceptUrl) setDemoNote(`Demo inbox: send the driver this link: ${sent.acceptUrl}`);
      setStep("await-driver");
    });

  const assignDriver = () =>
    run("Assigning driver on-chain…", async () => {
      const order = await browserApi.request(
        "GET",
        `/orders/${encodeURIComponent(invite!.orderId)}`,
      );
      const txHash = await signer!.writeEscrow({
        functionName: "assignDriver",
        args: [readChainOrderId(order), driver!],
      });
      await signer!.waitForReceipt(txHash);
      await browserApi.request(
        "POST",
        `/orders/${encodeURIComponent(invite!.orderId)}/driver/verify`,
        { txHash },
      );
      setStep("done");
    });

  const isDriver = invite?.role === "driver";
  return (
    <DemoShell
      workspace={isDriver ? "Driver workspace" : "Supplier workspace"}
      nav={[]}
      account={
        invite ? (
          <>
            <span className="bd-strong">{invite.email}</span>
            <span className="bd-small bd-muted">
              {signer
                ? `Wallet ${signer.address.slice(0, 6)}…${signer.address.slice(-4)}`
                : "No wallet yet"}
            </span>
          </>
        ) : undefined
      }
    >
      <PageHeader
        eyebrow={isDriver ? "Driver invitation" : "Order invitation"}
        title={isDriver ? "You're driving this order" : "Read it. Then sign it on-chain."}
      >
        <p className="dm-lead">
          {localDemo
            ? "Local demo chain with test MockZARP. Your demo wallet is a Hardhat dev account."
            : "Base Sepolia with test MockZARP, so no real money moves. Gas is sponsored by Patella."}
        </p>
      </PageHeader>

      {invite && (
        <section className="dm-agreement" aria-labelledby="agreement-label">
          <span id="agreement-label" className="bd-label">
            The agreement
          </span>
          <p>{invite.agreementText}</p>
          <div className="dm-agreement-hash">
            <span className="bd-label">Fingerprint (agreement hash)</span>
            <span className="dm-mono">{invite.agreementHash}</span>
          </div>
        </section>
      )}

      <section className="dm-card" aria-live="polite" style={{ maxWidth: 720 }}>
        <h2 className="bd-h2">
          {step === "accept"
            ? "Accept the order"
            : step === "invite-driver" || step === "await-driver" || step === "assign"
              ? "Your driver"
              : step === "done"
                ? "All set"
                : "Get started"}
        </h2>

        {step === "loading" && <p className="bd-muted">Opening your invitation…</p>}
        {step === "sign-in" && (
          <button type="button" className="bd-btn" onClick={requestCode} disabled={!!busy}>
            Email me a sign-in code
          </button>
        )}
        {step === "code" && (
          <div className="dm-btns">
            <label htmlFor="acc-code" className="bd-small bd-muted" style={{ flexBasis: "100%" }}>
              6-digit code from your email
            </label>
            <input
              id="acc-code"
              className="dm-in"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              type="button"
              className="bd-btn"
              onClick={verifyCode}
              disabled={!!busy || code.trim().length !== 6}
            >
              Sign in
            </button>
          </div>
        )}
        {step === "wallet" && (
          <div className="bd-stack-8">
            <button type="button" className="bd-btn" onClick={createWallet} disabled={!!busy}>
              {localDemo ? "Use my demo wallet" : "Create my wallet"}
            </button>
            <small className="bd-muted">
              {localDemo
                ? "Demo: signs with a Hardhat dev account on the local chain."
                : "MetaMask Embedded Wallet will email you a second code to unlock your wallet."}
            </small>
          </div>
        )}
        {step === "await-funding" && (
          <span className="dm-badge dm-badge--wait" style={{ alignSelf: "flex-start" }}>
            Waiting for the buyer to create and fund the escrow…
          </span>
        )}
        {step === "accept" && (
          <div className="bd-stack-8">
            <span className="dm-badge dm-badge--ok" style={{ alignSelf: "flex-start" }}>
              The buyer&apos;s money is locked in escrow
            </span>
            <button type="button" className="bd-btn" onClick={acceptOrder} disabled={!!busy}>
              Accept on-chain
            </button>
            <small className="bd-muted">
              This records the fingerprint above on the escrow contract.
            </small>
          </div>
        )}
        {step === "invite-driver" && (
          <div className="dm-btns">
            <label htmlFor="acc-driver" className="bd-small bd-muted" style={{ flexBasis: "100%" }}>
              Driver email
            </label>
            <input
              id="acc-driver"
              className="dm-in"
              type="email"
              placeholder="driver@company.co.za"
              value={driverEmail}
              onChange={(e) => setDriverEmail(e.target.value)}
            />
            <button
              type="button"
              className="bd-btn"
              onClick={inviteDriver}
              disabled={!!busy || !driverEmail.includes("@")}
            >
              Invite driver
            </button>
          </div>
        )}
        {step === "await-driver" && (
          <span className="dm-badge dm-badge--wait" style={{ alignSelf: "flex-start" }}>
            Waiting for the driver to accept and create a wallet…
          </span>
        )}
        {step === "assign" && driver && (
          <button type="button" className="bd-btn" onClick={assignDriver} disabled={!!busy}>
            Assign driver {driver.slice(0, 6)}…{driver.slice(-4)} on-chain
          </button>
        )}
        {step === "done" && invite && (
          <div className="bd-stack-8">
            <p style={{ margin: 0 }}>
              {invite.role === "supplier"
                ? "Driver assigned. Ready for pickup."
                : "You're set up. Open the pickup when the supplier is ready."}
            </p>
            <Link
              className="bd-btn"
              style={{ alignSelf: "flex-start" }}
              href={`/handoff/${encodeURIComponent(invite.orderId)}/pickup`}
            >
              Go to pickup handoff
            </Link>
          </div>
        )}

        {demoNote && <p className="dm-note dm-mono">{demoNote}</p>}
        {busy && <p className="dm-msg">{busy}</p>}
        {error && (
          <p role="alert" className="dm-msg dm-msg--err">
            {error}
          </p>
        )}
      </section>
    </DemoShell>
  );
}
