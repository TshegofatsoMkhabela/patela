"use client";

import QRCode from "qrcode";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PhoneShell } from "@/components/demo/DemoShell";
import { PaidScreen } from "@/components/PaidScreen";
import { QrScanner } from "@/components/QrScanner";
import {
  connectEmbeddedWallet,
  connectExtensionWallet,
  type WalletSigner,
} from "@/lib/embedded-wallet";
import { demoSignerAvailable, demoWalletSigner, type DemoPersona } from "@/lib/demo-signer";
import { contractErrorMessage, type Stage } from "@/lib/handoff";
import { API_ORIGIN, browserApi, locateOrDemo, waitForReleaseOnChain } from "../../handoff-api";
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
  const localDemo = demoSignerAvailable();
  const [pasted, setPasted] = useState("");
  // Pickup: supplier hands to driver. Delivery: driver hands to buyer.
  const personas: DemoPersona[] = stage === 1 ? ["supplier", "driver"] : ["driver", "buyer"];

  async function connect(kind: "extension" | "embedded" | DemoPersona) {
    try {
      const s =
        kind === "extension"
          ? await connectExtensionWallet()
          : kind === "embedded"
            ? await connectEmbeddedWallet(email.trim())
            : demoWalletSigner(kind);
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
    locate: locateOrDemo(localDemo),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer, role, scanned, stage, orderId]);

  useEffect(() => {
    if (state?.kind === "showing-qr")
      void QRCode.toDataURL(state.qr, { width: 360, margin: 2 }).then(setQrImage);
  }, [state]);

  if (!stage)
    return (
      <PhoneShell>
        <h1>Unknown handoff stage</h1>
      </PhoneShell>
    );
  if (state?.kind === "paid")
    return <PaidScreen seconds={state.seconds} txHash={state.txHash} stage={stage} />;

  const retry = () => {
    started.current = false;
    setScanned(null);
    setQrImage(null);
    setState(null);
  };

  const stageName = stage === 1 ? "Pickup" : "Delivery";
  const receiverName = stage === 1 ? "the driver" : "the buyer";
  const giverName = stage === 1 ? "the supplier" : "the driver";

  return (
    <PhoneShell
      who={role === "giver" ? "Handing over" : role === "receiver" ? "Receiving" : stageName}
    >
      <div className="bd-stack-6">
        <span className="bd-label">{stageName} handoff</span>
        <h1>
          {role === "giver"
            ? `Show this to ${receiverName}`
            : role === "receiver"
              ? `Scan ${giverName}'s code`
              : `${stageName} handoff`}
        </h1>
        <p className="dm-lead">
          {localDemo
            ? "Local demo chain with test MockZARP. Sign in to Patella as your persona in this browser first."
            : "Base Sepolia with test MockZARP. On a phone, open this page in the MetaMask app's browser."}
        </p>
      </div>

      {!signer && localDemo && (
        <section className="bd-stack-8">
          <span className="bd-small bd-muted">Who are you in this handoff?</span>
          {personas.map((p) => (
            <button key={p} type="button" className="bd-btn dm-block" onClick={() => connect(p)}>
              I am the {p} (demo)
            </button>
          ))}
        </section>
      )}

      {!signer && !localDemo && (
        <section className="bd-stack-8">
          <span className="bd-small bd-muted">Connect the wallet for your role.</span>
          <label htmlFor="ho-email" className="bd-small">
            Email (driver and supplier wallets)
          </label>
          <input
            id="ho-email"
            className="dm-in"
            type="email"
            placeholder="you@company.co.za"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="button"
            className="bd-btn dm-block"
            disabled={!email.includes("@")}
            onClick={() => connect("embedded")}
          >
            Sign in with email
          </button>
          <button
            type="button"
            className="dm-btn-ghost dm-block"
            onClick={() => connect("extension")}
          >
            Use MetaMask (buyer)
          </button>
        </section>
      )}

      {signer && (
        <span className="dm-badge" style={{ alignSelf: "flex-start" }}>
          Wallet {signer.address.slice(0, 6)}…{signer.address.slice(-4)}
        </span>
      )}

      {role === "receiver" && !scanned && state?.kind !== "error" && (
        <section className="bd-stack-10">
          <div className="dm-scan">
            <QrScanner onScan={setScanned} />
          </div>
          <ul className="dm-checks">
            <li>Proves {giverName} is here with the goods</li>
            <li>Works once and expires in minutes</li>
            <li>Payment releases only after both of you sign</li>
          </ul>
          {localDemo && (
            <div className="bd-stack-8">
              <label htmlFor="ho-paste" className="bd-small bd-muted">
                Demo: paste the QR text instead
              </label>
              <input
                id="ho-paste"
                className="dm-in"
                placeholder="patela:h1:…"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
              />
              <button
                type="button"
                className="dm-btn-ghost dm-block"
                disabled={!pasted.startsWith("patela:")}
                onClick={() => setScanned(pasted.trim())}
              >
                Use pasted QR
              </button>
            </div>
          )}
        </section>
      )}

      {state?.kind === "showing-qr" && qrImage && (
        <section className="bd-stack-10">
          <div className="dm-qr">
            <img src={qrImage} alt="Handoff QR code" width={360} height={360} />
          </div>
          <Countdown expiresAt={state.expiresAt} />
          <span className="dm-badge dm-badge--wait" style={{ alignSelf: "center" }}>
            Waiting for {receiverName} to scan…
          </span>
          {localDemo && (
            <button
              type="button"
              className="dm-btn-ghost dm-block"
              onClick={() => void navigator.clipboard?.writeText(state.qr)}
            >
              Demo: copy QR text for the other window
            </button>
          )}
        </section>
      )}

      {state?.kind === "ready-to-sign" && (
        <section className="bd-stack-10">
          <p className="dm-msg">
            {receiverName[0].toUpperCase() + receiverName.slice(1)} scanned and signed. Both
            locations are recorded.
          </p>
          <button type="button" className="bd-btn dm-block" onClick={() => confirmRef.current()}>
            Sign to release payment
          </button>
        </section>
      )}

      {state &&
        ["locating", "signing", "submitting", "confirming", "waiting-for-release"].includes(
          state.kind,
        ) && (
          <p
            aria-live="polite"
            className="dm-badge dm-badge--wait"
            style={{ alignSelf: "flex-start" }}
          >
            {STATUS[state.kind as keyof typeof STATUS]}
          </p>
        )}

      {state?.kind === "error" && (
        <section role="alert" className="bd-stack-8">
          <p className="dm-msg dm-msg--err">{state.message}</p>
          {signer && (
            <button type="button" className="dm-btn-ghost dm-block" onClick={retry}>
              Start again
            </button>
          )}
        </section>
      )}
    </PhoneShell>
  );
}

const STATUS = {
  locating: "Getting your location…",
  signing: "Confirm the signature in your wallet…",
  submitting: "Sending the release transaction…",
  confirming: "Waiting for the chain to confirm…",
  "waiting-for-release": "Signed. Waiting for the other side to release payment…",
};

function Countdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, expiresAt - now);
  return (
    <p className="dm-center bd-nums" style={{ margin: 0 }}>
      One-time code · expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </p>
  );
}
