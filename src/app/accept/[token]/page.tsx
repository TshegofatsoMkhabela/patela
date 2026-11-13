"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Address, Hex, TypedDataDefinition } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">
        {invite?.role === "driver" ? "Driver invitation" : "Order invitation"}
      </h1>
      <p className="text-sm opacity-70">
        {localDemo
          ? "Demo on a local Hardhat chain with test MockZARP. Your demo wallet is a Hardhat dev account."
          : "Demo on Base Sepolia with test MockZARP. Gas is sponsored by Patela."}
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
          <Button onClick={verifyCode} disabled={!!busy || code.trim().length !== 6}>
            Sign in
          </Button>
        </div>
      )}
      {step === "wallet" && (
        <div className="space-y-1">
          <Button onClick={createWallet} disabled={!!busy}>
            {localDemo ? "Use my demo wallet" : "Create my wallet"}
          </Button>
          <p className="text-xs opacity-70">
            {localDemo
              ? "Demo: signs with a Hardhat dev account on the local chain."
              : "MetaMask Embedded Wallet will email you a second code to unlock your wallet."}
          </p>
        </div>
      )}
      {step === "await-funding" && (
        <p aria-live="polite">Waiting for the buyer to create and fund the escrow…</p>
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
          <Button onClick={inviteDriver} disabled={!!busy || !driverEmail.includes("@")}>
            Invite driver
          </Button>
        </div>
      )}
      {step === "await-driver" && (
        <p aria-live="polite">Waiting for the driver to accept and create a wallet…</p>
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

      {signer && <p className="font-mono text-xs opacity-70">Wallet {signer.address}</p>}
      {demoNote && <p className="break-all rounded border border-dashed p-2 text-sm">{demoNote}</p>}
      {busy && <p aria-live="polite">{busy}</p>}
      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}
    </main>
  );
}
