"use client";

// One QR handoff (specs/INTERFACES.md §5). The giver opens a session and shows the QR; the
// receiver scans it, adds their own location and signs; the giver then signs the same message and
// submits releaseHandoff, which pays that stage in the same transaction.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Address, Hex } from "viem";
import {
  confirmTx,
  errorMessage,
  OrderPage,
  StatusLine,
  useSession,
  useTask,
  zar,
  type Session,
} from "@/components/orders/order-ui";
import {
  buildHandoffTypedData,
  computeEvidenceHash,
  decodeQrPayload,
  encodeQrPayload,
  handoffExpiry,
  HandoffPayloadError,
  newNonce,
  type Evidence,
  type QrPayload,
  type Role,
  type Stage,
} from "@/lib/handoff";
import { nextStep, STAGE_PARTIES, type OrderView as Order } from "@/lib/order-flow";
import { releaseHandoffTransaction, signTypedDataV4 } from "@/lib/order-escrow";
import { API_BASE_URL, patelaApi, type HandoffState } from "@/lib/patela-api";

const now = () => Math.floor(Date.now() / 1000);
const STAGE_NAME: Record<Stage, string> = { 1: "Pickup", 2: "Delivery" };

/** The device's current position as handoff evidence. Location is a record, not proof. */
function captureEvidence(role: Role): Promise<Evidence> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser cannot share a location."));
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: Number(p.coords.latitude.toFixed(6)),
          lng: Number(p.coords.longitude.toFixed(6)),
          accuracyM: Math.round(p.coords.accuracy),
          capturedAt: Math.floor(p.timestamp / 1000),
          role,
        }),
      () => reject(new Error("Allow location access: the handoff records where it happened.")),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}

/** What both people sign: the same message, so the contract can check both signatures. */
function handoffMessage(
  order: Order,
  stage: Stage,
  qr: Pick<QrPayload, "nonce" | "expiresAt">,
  evidenceHash: Hex,
) {
  const { giver, receiver } = STAGE_PARTIES[stage];
  return buildHandoffTypedData({
    chainOrderId: BigInt(order.chainOrderId!),
    stage,
    giver: order.parties[giver]!.wallet as Address,
    receiver: order.parties[receiver]!.wallet as Address,
    nonce: qr.nonce,
    expiresAt: qr.expiresAt,
    evidenceHash,
    verifyingContract: order.escrowAddress as Address,
  });
}

const stagePayment = (order: Order, stage: Stage) =>
  stage === 1
    ? `driver ${zar(order.driverAtPickupWei)} and supplier ${zar(order.supplierAtPickupWei)}`
    : `supplier ${zar(order.supplierAtDeliveryWei)}`;

export function HandoffView({ orderId, stage }: { orderId: string; stage: Stage }) {
  const session = useSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Loaded once: it decides which panel to show. Each panel watches progress on its own, so this
  // order never changes under a panel that is still showing "waiting" or PAID.
  useEffect(() => {
    if (!session.profile) return;
    patelaApi.order(orderId).then(setOrder, (e) => setError(errorMessage(e)));
  }, [session.profile, orderId]);

  const step = order && session.profile ? nextStep(order, session.profile.id) : null;
  const mine = step && (step.kind === "show-qr" || step.kind === "scan-qr") && step.stage === stage;

  return (
    <OrderPage
      eyebrow={`${STAGE_NAME[stage]} handoff`}
      title="Hand over, sign, get paid."
      session={session}
    >
      {error && <p className="pt-order-error">{error}</p>}
      {order && step && !mine && (
        <div className="pt-card pt-order-panel">
          <p>
            {order.status === "delivered" || (stage === 1 && order.status === "in_progress")
              ? "This handoff is already done and paid."
              : "This handoff isn't yours to do right now."}
          </p>
          <Link className="pt-btn ghost" href={`/orders/${orderId}`}>
            Back to the order
          </Link>
        </div>
      )}
      {order && mine && step.kind === "show-qr" && (
        <GiverPanel order={order} stage={stage} session={session} />
      )}
      {order && mine && step.kind === "scan-qr" && (
        <ReceiverPanel order={order} stage={stage} session={session} />
      )}
    </OrderPage>
  );
}

type Shown = { text: string; image: string; payload: QrPayload; shownAt: number };

function GiverPanel({ order, stage, session }: { order: Order; stage: Stage; session: Session }) {
  const { busy, status, run } = useTask();
  const [shown, setShown] = useState<Shown | null>(null);
  const [paidIn, setPaidIn] = useState<number | null>(null);
  const [clock, setClock] = useState(now());
  const [countersigned, setCountersigned] = useState<HandoffState | null>(null);
  const autoReleased = useRef(false);
  const eth = session.eth;
  const account = session.account!;

  const expiresAt = shown?.payload.expiresAt ?? 0;
  // Countdown ticks only while a QR is live.
  useEffect(() => {
    if (!expiresAt) return;
    setClock(now());
    const timer = setInterval(() => {
      setClock(now());
      if (now() > expiresAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const showQr = () =>
    run("Recording your location…", async (say) => {
      const giverEvidence = await captureEvidence("giver");
      const nonce = newNonce();
      const expiresAt = handoffExpiry(now());
      say("Opening the handoff…");
      const { sessionId } = await patelaApi.openHandoff(order.id, stage, {
        nonce,
        expiresAt,
        giverEvidence,
      });
      const payload: QrPayload = {
        orderId: order.id,
        stage,
        sessionId,
        nonce,
        expiresAt,
        giverEvidence,
        apiOrigin: new URL(API_BASE_URL).origin,
      };
      const text = encodeQrPayload(payload);
      const QRCode = (await import("qrcode")).default;
      const image = await QRCode.toDataURL(text, {
        margin: 1,
        width: 320,
        errorCorrectionLevel: "M",
      });
      autoReleased.current = false;
      setCountersigned(null);
      setShown({ text, image, payload, shownAt: Date.now() });
    });

  // Poll until the receiver has scanned and countersigned, or the QR has expired.
  useEffect(() => {
    if (!shown || countersigned) return;
    let inFlight = false;
    const timer = setInterval(async () => {
      if (now() > shown.payload.expiresAt) return clearInterval(timer);
      if (inFlight) return;
      inFlight = true;
      const state = await patelaApi
        .handoffState(order.id, stage, shown.payload.sessionId)
        .catch(() => ({}) as HandoffState);
      inFlight = false;
      if (state.receiverSig && state.receiverEvidence && state.evidenceHash)
        setCountersigned(state);
    }, 2000);
    return () => clearInterval(timer);
  }, [shown, countersigned, order.id, stage]);

  /** Sign the same message the receiver signed, then submit both signatures in one transaction. */
  const release = useCallback(
    () =>
      run("The receiver signed. Confirm in MetaMask to release payment", async (say) => {
        if (!shown || !countersigned) return;
        const evidenceHash = computeEvidenceHash(
          shown.payload.giverEvidence,
          countersigned.receiverEvidence!,
        );
        if (evidenceHash !== countersigned.evidenceHash) {
          throw new Error("The two locations don't match what was signed.");
        }
        const typed = handoffMessage(order, stage, shown.payload, evidenceHash);
        const giverSig = await signTypedDataV4(eth, account, typed);
        say("Confirm in MetaMask: send the payment");
        const hash = await releaseHandoffTransaction(
          { eth, account, escrow: order.escrowAddress as Address },
          {
            chainOrderId: BigInt(order.chainOrderId!),
            stage,
            nonce: shown.payload.nonce,
            expiresAt: shown.payload.expiresAt,
            evidenceHash,
            giverSig,
            receiverSig: countersigned.receiverSig as Hex,
          },
        );
        await confirmTx(eth, hash, say, () => patelaApi.verifyHandoff(order.id, stage, hash));
        setPaidIn(Math.round((Date.now() - shown.shownAt) / 1000));
        toast.success("Paid.");
      }),
    [shown, countersigned, order, stage, eth, account, run],
  );

  // Start the release once, as soon as the countersignature arrives; a retry is a button.
  useEffect(() => {
    if (countersigned && !autoReleased.current) {
      autoReleased.current = true;
      void release();
    }
  }, [countersigned, release]);

  if (paidIn !== null) return <Paid order={order} stage={stage} seconds={paidIn} />;

  const left = shown ? shown.payload.expiresAt - clock : 0;
  if (countersigned && left > 0) {
    return (
      <div className="pt-card pt-order-panel">
        <p>
          The {STAGE_PARTIES[stage].receiver} scanned and signed. Confirm in MetaMask to release{" "}
          {stagePayment(order, stage)}. {left}s left on this QR.
        </p>
        <button className="pt-btn" onClick={() => void release()} disabled={busy}>
          Release payment
        </button>
        <StatusLine status={status} />
      </div>
    );
  }
  return (
    <div className="pt-card pt-order-panel">
      {!shown || left <= 0 ? (
        <>
          <p>
            {shown
              ? "That QR expired before it was scanned. Make a new one."
              : `When you hand over the goods, show this QR. Once both of you sign, ${stagePayment(order, stage)} is paid.`}
          </p>
          <button className="pt-btn" onClick={showQr} disabled={busy}>
            {shown ? "New QR" : "Show handoff QR"}
          </button>
        </>
      ) : (
        <>
          <img
            className="pt-order-qr"
            src={shown.image}
            alt="Handoff QR code"
            width={320}
            height={320}
          />
          <p>
            Valid for {left}s. Ask the {STAGE_PARTIES[stage].receiver} to scan it on their order
            page.
          </p>
          <details>
            <summary>Can&apos;t scan? Copy the code instead</summary>
            <textarea className="pt-in pt-mono" readOnly value={shown.text} rows={4} />
            <button
              className="pt-btn ghost sm"
              onClick={() => void navigator.clipboard.writeText(shown.text)}
            >
              Copy
            </button>
          </details>
        </>
      )}
      <StatusLine status={status} />
    </div>
  );
}

/** Why a scanned code was refused, in words the receiver can act on. */
function rejection(error: unknown) {
  if (error instanceof HandoffPayloadError && error.code === "expired") {
    return "This QR has expired. Ask for a new one.";
  }
  return error instanceof Error ? error.message : "QR rejected.";
}

function ReceiverPanel({
  order,
  stage,
  session,
}: {
  order: Order;
  stage: Stage;
  session: Session;
}) {
  const { busy, status, run } = useTask();
  const [pasted, setPasted] = useState("");
  const [rejected, setRejected] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<number | null>(null);
  const [paidIn, setPaidIn] = useState<number | null>(null);
  const handled = useRef(false);
  const eth = session.eth;
  const account = session.account!;
  const before = order.status;

  const accept = useCallback(
    (text: string) => {
      if (handled.current) return;
      handled.current = true;
      setRejected(null);
      void run("Checking the QR…", async (say) => {
        let payload: QrPayload;
        try {
          payload = decodeQrPayload(text.trim(), now());
        } catch (e) {
          setRejected(rejection(e));
          return;
        }
        if (payload.orderId !== order.id || payload.stage !== stage) {
          setRejected("This QR is for a different order or handoff.");
          return;
        }
        say("Recording your location…");
        const receiverEvidence = await captureEvidence("receiver");
        const evidenceHash = computeEvidenceHash(payload.giverEvidence, receiverEvidence);
        say("Confirm in MetaMask: sign that you received the goods");
        const receiverSig = await signTypedDataV4(
          eth,
          account,
          handoffMessage(order, stage, payload, evidenceHash),
        );
        await patelaApi.submitReceiver(order.id, stage, payload.sessionId, {
          receiverEvidence,
          evidenceHash,
          receiverSig,
        });
        setSignedAt(Date.now());
      }).finally(() => {
        handled.current = false;
      });
    },
    [order, stage, eth, account, run],
  );

  // After countersigning, wait for the giver's release to move the order on.
  useEffect(() => {
    if (signedAt === null || paidIn !== null) return;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      const fresh = await patelaApi.order(order.id).catch(() => null);
      if (fresh && fresh.status !== before) setPaidIn(Math.round((Date.now() - signedAt) / 1000));
    }, 3000);
    return () => clearInterval(timer);
  }, [signedAt, paidIn, order.id, before]);

  if (paidIn !== null) return <Paid order={order} stage={stage} seconds={paidIn} />;
  if (signedAt !== null) {
    return (
      <div className="pt-card pt-order-panel">
        <p>
          Signed. Waiting for the {STAGE_PARTIES[stage].giver} to confirm in their wallet, which
          releases the payment…
        </p>
      </div>
    );
  }

  return (
    <div className="pt-card pt-order-panel">
      <p>
        When you receive the goods, scan the {STAGE_PARTIES[stage].giver}&apos;s QR. Then sign in
        MetaMask.
      </p>
      <Scanner onText={accept} paused={busy} />
      <details>
        <summary>Can&apos;t scan? Paste the code instead</summary>
        <textarea
          className="pt-in pt-mono"
          rows={4}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="patela:h1:…"
        />
        <button
          className="pt-btn ghost sm"
          disabled={busy || !pasted.trim()}
          onClick={() => accept(pasted)}
        >
          Use this code
        </button>
      </details>
      {rejected && (
        <p className="pt-order-error" role="alert">
          Rejected: {rejected}
        </p>
      )}
      <StatusLine status={status} />
    </div>
  );
}

/** Webcam QR reader (jsQR on video frames). Camera access needs localhost or HTTPS. */
function Scanner({ onText, paused }: { onText: (text: string) => void; paused: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Read through refs so pausing or a new callback doesn't restart the camera.
  const latest = useRef({ onText, paused });
  latest.current = { onText, paused };

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    const canvas = document.createElement("canvas");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        setProblem("Camera unavailable. Allow camera access, or paste the code below.");
        setOn(false);
        return;
      }
      const el = video.current;
      // Left the page while the camera permission prompt was open.
      if (stopped || !el) return stream.getTracks().forEach((t) => t.stop());
      el.srcObject = stream;
      await el.play().catch(() => undefined);
      const jsQR = (await import("jsqr")).default;
      if (stopped) return;
      timer = setInterval(() => {
        if (latest.current.paused || !el.videoWidth) return;
        canvas.width = el.videoWidth;
        canvas.height = el.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(el, 0, 0);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(frame.data, frame.width, frame.height);
        if (code?.data) latest.current.onText(code.data);
      }, 300);
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on]);

  return (
    <div className="pt-order-scanner">
      {on ? (
        <video ref={video} muted playsInline aria-label="Camera view for scanning the QR" />
      ) : (
        <button className="pt-btn" onClick={() => (setProblem(null), setOn(true))}>
          Scan with camera
        </button>
      )}
      {problem && <p className="pt-order-error">{problem}</p>}
    </div>
  );
}

function Paid({ order, stage, seconds }: { order: Order; stage: Stage; seconds: number }) {
  return (
    <div className="pt-card pt-order-panel pt-order-paid" role="status">
      <strong>PAID</strong>
      <p>
        {STAGE_NAME[stage]} handoff signed by both. Released {stagePayment(order, stage)} in{" "}
        {seconds}s.
      </p>
      <Link className="pt-btn" href={`/orders/${order.id}`}>
        Back to the order
      </Link>
    </div>
  );
}
