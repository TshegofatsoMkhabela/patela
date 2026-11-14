"use client";

import { useEffect, useRef, useState } from "react";

const DECODE_EVERY_MS = 100; // ~10 decodes a second is plenty for a hand-held QR
const MAX_DECODE_WIDTH = 640;

/**
 * Webcam QR reader. Desktop Chrome on Windows has no BarcodeDetector, so frames are decoded with
 * the bundled jsQR. Calls onScan once with the first decoded text.
 */
export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let stream: MediaStream | undefined;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        const { default: jsQR } = await import("jsqr");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        const video = videoRef.current;
        if (!video || stopped) return;
        video.srcObject = stream;
        await video.play();
        let last = 0;
        const tick = (now = 0) => {
          if (stopped) return;
          if (ctx && now - last >= DECODE_EVERY_MS && video.readyState >= video.HAVE_ENOUGH_DATA) {
            last = now;
            // Decode a downscaled frame; resizing the canvas only when the camera size changes.
            const scale = Math.min(1, MAX_DECODE_WIDTH / video.videoWidth);
            const w = Math.round(video.videoWidth * scale);
            const h = Math.round(video.videoHeight * scale);
            if (canvas.width !== w || canvas.height !== h) {
              canvas.width = w;
              canvas.height = h;
            }
            ctx.drawImage(video, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (code?.data) {
              stopped = true;
              onScanRef.current(code.data);
              return;
            }
          }
          frame = requestAnimationFrame(tick);
        };
        tick();
      } catch (err) {
        setError(
          err instanceof Error ? `Camera unavailable: ${err.message}` : "Camera unavailable",
        );
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        muted
        playsInline
        className="w-full max-w-md rounded-lg border bg-black"
        aria-label="Webcam QR scanner"
      />
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
