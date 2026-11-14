"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Address, Hex, TypedDataDefinition, WalletClient } from "viem";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { connectEmbeddedWallet, type WalletSigner } from "@/lib/embedded-wallet";
import { NETWORK_LABEL, signWalletLink } from "@/lib/escrow-chain";
import { contractErrorMessage } from "@/lib/handoff";
import { isEmail, isOtpCode } from "@/lib/patela-api";
import { browserApi } from "../handoff/handoff-api";
import { readChainOrderId, readWallet } from "../handoff/handoff-flow";
import { supplierStep, type SupplierStep } from "./accept-steps";

// Supplier / driver onboarding from the emailed link (INTERFACES §1 steps 4–6, §4 web handoff rows).

type Invitation = {
  orderId: string;
  role: "supplier" | "driver";
  email: string;
  agreementText: string;
  agreementHash: Hex;
};
type Step = "loading" | "sign-in" | "code" | "wallet" | "await-driver" | SupplierStep;

const POLL_MS = 3000;
const MAX_POLL_MS = 30_000;

export function AcceptView() {
  const token = useSearchParams().get("token") ?? "";
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [code, setCode] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [demoLink, setDemoLink] = useState<string | null>(null);
  const [driver, setDriver] = useState<Address | null>(null);
  const [signer, setSigner] = useState<WalletSigner | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderPath = (suffix = "") => `/orders/${encodeURIComponent(invite!.orderId)}${suffix}`;
  const getOrder = () => api.getOrder(invite!.orderId);

  useEffect(() => {
    if (!token)
      return setError("This link has no invitation token. Open the link from the email again.");
    (async () => {
      try {
        // Only a 401 means "signed out"; any other /me failure is shown as an error.
        const [inv, signedIn] = await Promise.all([
          browserApi.request(
            "GET",
            `/invitations/${encodeURIComponent(token)}`,
          ) as Promise<Invitation>,
          api.me().then(
            () => true,
            (err) => {
              if (err instanceof ApiError && err.status === 401) return false;
              throw err;
            },
          ),
        ]);
        setInvite(inv);
        setStep(signedIn ? "wallet" : "sign-in");
      } catch (err) {
        setError(contractErrorMessage(err));
      }
    })();
  }, [token]);

  // Supplier: wait for the buyer to fund, or for the invited driver to link a wallet. Funding can take
  // a while, so each poll waits for the last one, backs off, and skips while the tab is hidden.
  useEffect(() => {
    if ((step !== "await-funding" && step !== "await-driver") || !invite) return;
    let delay = POLL_MS;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const poll = async () => {
      const order =
        document.visibilityState === "hidden"
          ? null
          : await api.getOrder(invite.orderId).catch(() => null);
      if (stopped) return;
      const next = order && supplierStep(order);
      // "invite-driver" while awaiting the driver just means the driver hasn't linked yet.
      if (next && next !== step && !(step === "await-driver" && next === "invite-driver")) {
        setDriver(readWallet(order, "driver"));
        return setStep(next);
      }
      delay = Math.min(delay * 1.5, MAX_POLL_MS);
      timer = setTimeout(poll, delay);
    };
    timer = setTimeout(poll, delay);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
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
      await api.requestOtp(invite!.email);
      setStep("code");
    });

  const verifyCode = () =>
    run("Checking code…", async () => {
      await api.verifyOtp(invite!.email, code.trim());
      setStep("wallet");
    });

  const createWallet = () =>
    run("Creating your wallet…", async () => {
      const s = await connectEmbeddedWallet(invite!.email);
      const challenge = await api.walletChallenge(s.address);
      const viaSigner = {
        signTypedData: (td: TypedDataDefinition) => s.signTypedData(td),
      } as Pick<WalletClient, "signTypedData">;
      const signature = await signWalletLink(viaSigner, s.address, challenge.typedData);
      await api.walletLink(challenge.challengeId, signature);
      await browserApi.request("POST", `/invitations/${encodeURIComponent(token)}/accept`, {
        walletAddress: s.address,
      });
      setSigner(s);
      if (invite!.role === "driver") return setStep("done");
      const order = await getOrder();
      setDriver(readWallet(order, "driver"));
      setStep(supplierStep(order));
    });

  const acceptOrder = () =>
    run("Accepting on-chain (gas sponsored)…", async () => {
      const txHash = await signer!.writeEscrow({
        functionName: "acceptOrder",
        args: [readChainOrderId(await getOrder()), invite!.agreementHash],
      });
      await signer!.waitForReceipt(txHash);
      await browserApi.request("POST", orderPath("/acceptance/verify"), { txHash });
      setStep("invite-driver");
    });

  const inviteDriver = () =>
    run("Inviting driver…", async () => {
      const res = (await browserApi.request("POST", orderPath("/driver-invite"), {
        email: driverEmail.trim(),
      })) as {
        acceptUrl?: string;
      };
      setDemoLink(res.acceptUrl ?? null);
      setStep("await-driver");
    });

  const assignDriver = () =>
    run("Assigning driver on-chain…", async () => {
      const txHash = await signer!.writeEscrow({
        functionName: "assignDriver",
        args: [readChainOrderId(await getOrder()), driver!],
      });
      await signer!.waitForReceipt(txHash);
      await browserApi.request("POST", orderPath("/driver/verify"), { txHash });
      setStep("done");
    });

  return (
    <div className="pt-app">
      <SiteNav />
      <main className="mx-auto max-w-2xl space-y-6 p-8">
        <h1 className="text-2xl font-semibold">
          {invite?.role === "driver" ? "Driver invitation" : "Order invitation"}
        </h1>
        <p className="text-sm opacity-70">
          {NETWORK_LABEL}. Gas for your email wallet is sponsored by Patela.
        </p>

        {invite && (
          <section className="space-y-2">
            <p>
              Invited as <strong>{invite.role}</strong> · {invite.email}
            </p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border p-3 text-sm">
              {invite.agreementText}
            </pre>
            <p className="break-all font-mono text-xs opacity-70">
              Agreement hash {invite.agreementHash}
            </p>
          </section>
        )}

        {step === "sign-in" && (
          <Button onClick={requestCode} disabled={!!busy}>
            Email me a sign-in code
          </Button>
        )}
        {step === "code" && (
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button onClick={verifyCode} disabled={!!busy || !isOtpCode(code.trim())}>
              Sign in
            </Button>
          </div>
        )}
        {step === "wallet" && (
          <div className="space-y-1">
            <Button onClick={createWallet} disabled={!!busy}>
              Create my wallet
            </Button>
            <p className="text-xs opacity-70">
              MetaMask Embedded Wallet will email you a second code to unlock your wallet.
            </p>
          </div>
        )}
        {step === "await-funding" && (
          <p aria-live="polite">Waiting for the buyer to fund the escrow…</p>
        )}
        {step === "accept" && (
          <Button onClick={acceptOrder} disabled={!!busy}>
            Accept the order
          </Button>
        )}
        {step === "invite-driver" && (
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="driver@example.com"
              value={driverEmail}
              onChange={(e) => setDriverEmail(e.target.value)}
            />
            <Button onClick={inviteDriver} disabled={!!busy || !isEmail(driverEmail.trim())}>
              Invite driver
            </Button>
          </div>
        )}
        {step === "await-driver" && (
          <section className="space-y-1">
            <p aria-live="polite">Waiting for the driver to accept and create a wallet…</p>
            {demoLink && (
              <p className="break-all text-xs opacity-70">
                Demo mode driver link:{" "}
                <a className="underline" href={demoLink}>
                  {demoLink}
                </a>
              </p>
            )}
          </section>
        )}
        {step === "assign" && driver && (
          <Button onClick={assignDriver} disabled={!!busy}>
            Assign driver {driver.slice(0, 6)}…{driver.slice(-4)}
          </Button>
        )}
        {step === "done" && invite && (
          <section className="space-y-2">
            <p>
              {invite.role === "supplier"
                ? "Driver assigned. Ready for pickup."
                : "You're set up. Open the pickup when the supplier is ready."}
            </p>
            <Link
              className="underline"
              href={`/handoff/${encodeURIComponent(invite.orderId)}/pickup`}
            >
              Go to pickup handoff
            </Link>
          </section>
        )}
        {step === "closed" && <p>This order is closed (refunded or in dispute).</p>}

        {signer && <p className="font-mono text-xs opacity-70">Wallet {signer.address}</p>}
        {busy && <p aria-live="polite">{busy}</p>}
        {error && (
          <p role="alert" className="text-red-500">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
