"use client";

import { memo, useEffect, useState } from "react";
import Script from "next/script";
import { QrScanner } from "@/components/QrScanner";
import { LivenessCheck } from "@/components/tracker/LivenessCheck";
import { isApprovedTrackerQr } from "@/lib/tracker-handoff";
import "@/styles/tracker-handoff.css";

type ScanState = "loading" | "scanning" | "wrongQr" | "blocked" | "liveness";

declare global {
  interface Window {
    PATELA_TRACKER_BOOT?: () => void;
  }
}

const TrackerCanvas = memo(function TrackerCanvas({
  styles,
  markup,
  script,
}: {
  styles: string;
  markup: string;
  script: string;
}) {
  return (
    <>
      {script ? (
        <Script
          src={script}
          type="module"
          strategy="afterInteractive"
          onReady={() => window.PATELA_TRACKER_BOOT?.()}
        />
      ) : null}
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div dangerouslySetInnerHTML={{ __html: markup }} />
    </>
  );
});

export function TrackerView({
  styles,
  markup,
  script,
}: {
  styles: string;
  markup: string;
  script: string;
}) {
  const [open, setOpen] = useState(false);
  const [scanState, setScanState] = useState<ScanState>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const onHandoffRequest = () => {
      setScanState("loading");
      setAttempt((value) => value + 1);
      setOpen(true);
    };
    window.addEventListener("patela:verify-handoff", onHandoffRequest);
    return () => window.removeEventListener("patela:verify-handoff", onHandoffRequest);
  }, []);

  useEffect(() => {
    const onJourneyComplete = () => {
      window.location.assign("/buyer?trackerFulfilled=PT-0412");
    };
    window.addEventListener("patela:journey-complete", onJourneyComplete);
    return () => window.removeEventListener("patela:journey-complete", onJourneyComplete);
  }, []);

  useEffect(() => {
    if (!open || scanState !== "loading") return;
    const timer = window.setTimeout(() => setScanState("scanning"), 500);
    return () => window.clearTimeout(timer);
  }, [open, scanState]);

  function scan(text: string) {
    if (isApprovedTrackerQr(text, window.location.origin)) {
      approveHandoff();
      return;
    }
    setScanState("wrongQr");
  }

  function approveHandoff() {
    window.dispatchEvent(new CustomEvent("patela:handoff-result", { detail: { accepted: true } }));
    setOpen(false);
  }

  function completeLiveness() {
    setScanState("blocked");
  }

  function retry() {
    setScanState("loading");
    setAttempt((value) => value + 1);
  }

  function close() {
    window.dispatchEvent(new CustomEvent("patela:handoff-result", { detail: { accepted: false } }));
    setOpen(false);
  }

  return (
    <main className="tracker-page">
      <TrackerCanvas styles={styles} markup={markup} script={script} />
      {open ? (
        <div className="tracker-scan-backdrop" role="presentation">
          <section
            className="tracker-scan-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tracker-scan-title"
          >
            <div className="tracker-scan-head">
              <div>
                <span>Checkpoint verification</span>
                <h1 id="tracker-scan-title">Scan the handoff QR</h1>
              </div>
              <button type="button" onClick={close} aria-label="Close QR scanner">
                ×
              </button>
            </div>

            {scanState === "loading" ? <p role="status">Opening QR camera…</p> : null}
            {scanState === "scanning" ? (
              <>
                <p>Point this phone&apos;s camera at the Patella QR shown at the checkpoint.</p>
                <div className="tracker-camera">
                  <QrScanner key={attempt} onScan={scan} />
                  <span className="tracker-scan-frame" aria-hidden="true" />
                </div>
              </>
            ) : null}

            {scanState === "wrongQr" ? (
              <div className="tracker-scan-result tracker-scan-result--blocked" role="alert">
                <strong>QR not approved</strong>
                <p>Try the Patella handoff code shown on your phone.</p>
                <button type="button" onClick={retry}>
                  Scan another code
                </button>
                <button type="button" onClick={() => setScanState("liveness")}>
                  Face check and supervisor help
                </button>
              </div>
            ) : null}

            {scanState === "liveness" ? (
              <>
                <p>
                  This QR code is not approved. Complete the face check before contacting your field
                  supervisor.
                </p>
                <LivenessCheck onComplete={completeLiveness} />
              </>
            ) : null}

            {scanState === "blocked" ? (
              <div className="tracker-scan-result tracker-scan-result--blocked" role="alert">
                <strong>QR blocked</strong>
                <p>This is not an approved Patella handoff code. Speak to your field supervisor.</p>
                <button type="button" onClick={retry}>
                  Scan another code
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
