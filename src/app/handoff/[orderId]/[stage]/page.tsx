"use client";

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
import { isEmail } from "@/lib/patela-api";
import { API_ORIGIN, browserApi, browserLocate, waitForReleaseOnChain } from "../../handoff-api";
import { roleFor, runGiver, runReceiver, type FlowDeps, type FlowState } from "../../handoff-flow";

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
  const [pasted, setPasted] = useState("");
  const confirmRef = useRef<() => void>(() => {});
  const started = useRef(false);
  // Bumped on retry and unmount so a superseded run stops polling and stops writing state.
  const run = useRef(0);

  async function connect(kind: "extension" | "embedded") {
    try {
      const s =
        kind === "extension"
          ? await connectExtensionWallet()
          : await connectEmbeddedWallet(email.trim());
      const order = await browserApi.request("GET", `/orders/${encodeURIComponent(orderId)}`);
      const r = roleFor(order, stage!, s.address);
      if (!r) throw new Error("This wallet is not part of this handoff");
      setSigner(s);
      setRole(r);
    } catch (err) {
      setState({ kind: "error", message: contractErrorMessage(err) });
    }
  }

  const deps = (s: WalletSigner): FlowDeps => {
    const id = ++run.current;
    const current = () => run.current === id;
    return {
      api: browserApi,
      apiOrigin: API_ORIGIN,
      signer: s,
      now: () => Date.now(),
      sleep: (ms) =>
        new Promise((resolve, reject) =>
          setTimeout(() => (current() ? resolve() : reject(new Error("cancelled"))), ms),
        ),
      locate: browserLocate,
      confirm: () => new Promise<void>((resolve) => (confirmRef.current = resolve)),
      waitForRelease: (args) => waitForReleaseOnChain({ ...args, current }),
      onState: (next) => current() && setState(next),
    };
  };

  useEffect(
    () => () => {
      run.current++;
    },
    [],
  );

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
    if (state?.kind !== "showing-qr") return;
    // Only the giver draws a QR, so the encoder loads on demand.
    void import("qrcode")
      .then((QRCode) => QRCode.toDataURL(state.qr, { width: 360, margin: 2 }))
      .then(setQrImage);
  }, [state]);

  if (!stage) return <main className="p-8">Unknown handoff stage.</main>;
  if (state?.kind === "paid")
    return <PaidScreen seconds={state.seconds} txHash={state.txHash} stage={stage} />;

  const retry = () => {
    run.current++;
    started.current = false;
    setScanned(null);
    setPasted("");
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
              <Button disabled={!isEmail(email.trim())} onClick={() => connect("embedded")}>
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
          <section className="space-y-3">
            <p>Point the webcam at the QR on the other screen.</p>
            <QrScanner onScan={setScanned} />
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm opacity-70">
                Camera unavailable? Paste the handoff code shown with the QR.
              </p>
              <div className="flex gap-2">
                <Input
                  aria-label="Paste handoff code"
                  placeholder="patela:h1:…"
                  value={pasted}
                  onChange={(event) => setPasted(event.target.value)}
                />
                <Button disabled={!pasted.trim()} onClick={() => setScanned(pasted.trim())}>
                  Use pasted code
                </Button>
              </div>
            </div>
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

        {state && STATUS[state.kind] && <p aria-live="polite">{STATUS[state.kind]}</p>}

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

const STATUS: Partial<Record<FlowState["kind"], string>> = {
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
