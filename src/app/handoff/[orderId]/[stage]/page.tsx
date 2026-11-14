"use client";

import QRCode from "qrcode";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaidScreen } from "@/components/PaidScreen";
import { SiteNav } from "@/components/SiteNav";
import { QrScanner } from "@/components/QrScanner";
import {
  connectEmbeddedWallet,
  connectExtensionWallet,
  type WalletSigner,
} from "@/lib/embedded-wallet";
import { NETWORK, NETWORK_LABEL } from "@/lib/escrow-chain";
import { contractErrorMessage, type Stage } from "@/lib/handoff";
import { API_ORIGIN, browserApi, browserLocate, waitForReleaseOnChain } from "../../handoff-api";
import {
  readOrderParties,
  runGiver,
  runReceiver,
  type FlowDeps,
  type FlowState,
} from "../../handoff-flow";

const parseStage = (s: string): Stage | null =>
  s === "1" || s === "pickup" ? 1 : s === "2" || s === "delivery" ? 2 : null;

export default function HandoffPage() {
  const params = useParams<{ orderId: string; stage: string }>();
  const orderId = decodeURIComponent(params.orderId);
  const stage = parseStage(params.stage);
  const [signer, setSigner] = useState<WalletSigner | null>(null);
  const [role, setRole] = useState<"giver" | "receiver" | null>(null);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FlowState | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const confirmRef = useRef<() => void>(() => {});
  const started = useRef(false);

  async function connect(kind: "extension" | "embedded") {
    try {
      const s =
        kind === "extension"
          ? await connectExtensionWallet()
          : await connectEmbeddedWallet(email.trim());
      const parties = readOrderParties(
        await browserApi.request("GET", `/orders/${encodeURIComponent(orderId)}`),
        stage!,
      );
      const me = s.address.toLowerCase();
      const r =
        me === parties.giver.toLowerCase()
          ? "giver"
          : me === parties.receiver.toLowerCase()
            ? "receiver"
            : null;
      if (!r) throw new Error("This wallet is not part of this handoff");
      setSigner(s);
      setRole(r);
    } catch (err) {
      setState({ kind: "error", message: contractErrorMessage(err) });
    }
  }

  const deps = (s: WalletSigner): FlowDeps => ({
    api: browserApi,
    apiOrigin: API_ORIGIN,
    signer: s,
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    locate: browserLocate,
    confirm: () => new Promise<void>((resolve) => (confirmRef.current = resolve)),
    waitForRelease: waitForReleaseOnChain,
    onState: setState,
  });

  // Giver starts as soon as its wallet is known; receiver starts on scan.
  useEffect(() => {
    if (!signer || !stage || started.current) return;
    if (role === "giver") {
      started.current = true;
      void runGiver(deps(signer), { orderId, stage });
    } else if (role === "receiver" && scanned) {
      started.current = true;
      void runReceiver(deps(signer), { orderId, stage, scanned });
    }
  }, [signer, role, scanned, stage, orderId]);

  useEffect(() => {
    if (state?.kind === "showing-qr")
      void QRCode.toDataURL(state.qr, { width: 360, margin: 2 }).then(setQrImage);
  }, [state]);

  if (!stage) return <main className="p-8">Unknown handoff stage.</main>;
  if (state?.kind === "paid")
    return <PaidScreen seconds={state.seconds} txHash={state.txHash} stage={stage} />;

  const retry = () => {
    started.current = false;
    setScanned(null);
    setQrImage(null);
    setState(null);
  };

  return (
    <div className="pt-app">
      <SiteNav />
      <main className="mx-auto max-w-xl space-y-6 p-8">
        <h1 className="text-2xl font-semibold">{stage === 1 ? "Pickup" : "Delivery"} handoff</h1>
        <p className="text-sm opacity-70">
          {NETWORK_LABEL}. Gas for the email wallet is sponsored by Patela.
        </p>

        {!signer && (
          <section className="space-y-3">
            <p>Connect the wallet for your role.</p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button disabled={!email.includes("@")} onClick={() => connect("embedded")}>
                Sign in with email
              </Button>
            </div>
            <Button variant="outline" onClick={() => connect("extension")}>
              Use MetaMask extension (buyer)
            </Button>
          </section>
        )}

        {signer && (
          <p className="text-sm">
            {role === "giver" ? "You are handing over" : "You are receiving"} ·{" "}
            {signer.address.slice(0, 6)}…{signer.address.slice(-4)}
          </p>
        )}

        {role === "receiver" && !scanned && state?.kind !== "error" && (
          <section className="space-y-2">
            <p>Point the webcam at the QR on the other screen.</p>
            <QrScanner onScan={setScanned} />
          </section>
        )}

        {state?.kind === "showing-qr" && qrImage && (
          <section className="space-y-2 text-center">
            <img src={qrImage} alt="Handoff QR code" className="mx-auto" width={360} height={360} />
            <Countdown expiresAt={state.expiresAt} />
            <p className="text-sm opacity-70">Waiting for the receiver to scan…</p>
          </section>
        )}

        {state?.kind === "ready-to-sign" && (
          <section className="space-y-2">
            <p>The receiver scanned and signed. Both locations are recorded.</p>
            <Button size="lg" onClick={() => confirmRef.current()}>
              Sign to release payment
            </Button>
          </section>
        )}

        {state &&
          ["locating", "signing", "submitting", "confirming", "waiting-for-release"].includes(
            state.kind,
          ) && <p aria-live="polite">{STATUS[state.kind as keyof typeof STATUS]}</p>}

        {state?.kind === "error" && (
          <section role="alert" className="space-y-2">
            <p className="text-red-500">{state.message}</p>
            {signer && (
              <Button variant="outline" onClick={retry}>
                Start again
              </Button>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

const STATUS = {
  locating: "Getting your location…",
  signing: "Confirm the signature in your wallet…",
  submitting: "Sending the release transaction…",
  confirming: `Waiting for ${NETWORK.name} to confirm…`,
  "waiting-for-release": "Signed. Waiting for the other side to release payment…",
};

function Countdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return <p className="font-mono">Expires in {Math.max(0, expiresAt - now)} s</p>;
}
