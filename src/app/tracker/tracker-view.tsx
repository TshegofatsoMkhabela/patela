"use client";

import { useEffect, useState } from "react";
import { QrScanner } from "@/components/QrScanner";
import { LivenessCheck } from "@/components/tracker/LivenessCheck";
import { isApprovedTrackerQr } from "@/lib/tracker-handoff";
import "@/styles/tracker-handoff.css";

type ScanState = "loading" | "scanning" | "blocked" | "liveness" | "approved";

export function TrackerView({ styles, markup }: { styles: string; markup: string }) {
  const [open, setOpen] = useState(false);
  const [scanState, setScanState] = useState<ScanState>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!document.querySelector("script[data-tracker-module]")) {
      const script = document.createElement("script");
      script.type = "module";
      script.src = "/tracker-demo/assets/index-OKFMGh2V.js";
      script.dataset.trackerModule = "true";
      document.body.appendChild(script);
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.type !== "patela:verify-handoff") return;
      setScanState("loading");
      setAttempt((value) => value + 1);
      setOpen(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!open || scanState !== "loading") return;
    const timer = window.setTimeout(() => setScanState("scanning"), 500);
    return () => window.clearTimeout(timer);
  }, [open, scanState]);

  function scan(text: string) {
    if (!isApprovedTrackerQr(text, window.location.origin)) {
      setScanState("blocked");
      return;
    }
    setScanState("liveness");
  }

  function completeLiveness() {
    setScanState("approved");
    window.postMessage({ type: "patela:handoff-result", accepted: true }, window.location.origin);
  }

  function retry() {
    setScanState("loading");
    setAttempt((value) => value + 1);
  }

  function close() {
    window.postMessage({ type: "patela:handoff-result", accepted: false }, window.location.origin);
    setOpen(false);
  }

  return (
    <main className="tracker-page">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div dangerouslySetInnerHTML={{ __html: markup }} />
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

            {scanState === "liveness" ? <LivenessCheck onComplete={completeLiveness} /> : null}

            {scanState === "blocked" ? (
              <div className="tracker-scan-result tracker-scan-result--blocked" role="alert">
                <strong>QR blocked</strong>
                <p>This is not an approved Patella handoff code. Speak to your field supervisor.</p>
                <button type="button" onClick={retry}>
                  Scan another code
                </button>
              </div>
            ) : null}

            {scanState === "approved" ? (
              <div className="tracker-scan-result tracker-scan-result--approved" role="status">
                <strong>Handoff verified</strong>
                <p>The checkpoint can continue.</p>
                <button type="button" onClick={() => setOpen(false)}>
                  Return to route
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
