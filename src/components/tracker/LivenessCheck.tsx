"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
type Step = "center" | "turn" | "opposite";
const instructions: Record<Step, string> = {
  center: "Center your face and hold still",
  turn: "Slowly turn your head one way",
  opposite: "Now turn your head the other way",
};

/** Wattwise's center → turn → opposite-turn demo gesture, with no images uploaded. */
export function LivenessCheck({ onComplete }: { onComplete: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const [step, setStep] = useState<Step>("center");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let stream: MediaStream | undefined;
    let landmarker: FaceLandmarker | undefined;
    let current: Step = "center";
    let centeredSince = 0;
    let firstSign = 0;
    let lastVideoTime = -1;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(WASM);
        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
          runningMode: "IMAGE",
          numFaces: 1,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        setReady(true);
        const tick = () => {
          if (cancelled || !video.current) return;
          const v = video.current;
          if (v.readyState >= 2 && v.currentTime !== lastVideoTime) {
            lastVideoTime = v.currentTime;
            const points = landmarker!.detect(v).faceLandmarks[0];
            if (points) {
              const nose = points[1],
                a = points[33],
                b = points[263];
              const halfSpan = Math.abs(b.x - a.x) / 2;
              const yaw = halfSpan > 0 ? (nose.x - (a.x + b.x) / 2) / halfSpan : 0;
              const offset = Math.hypot(nose.x - 0.5, nose.y - 0.5);
              if (current === "center") {
                if (Math.abs(yaw) <= 0.45 && offset <= 0.32) {
                  centeredSince ||= performance.now();
                  const fraction = Math.min(1, (performance.now() - centeredSince) / 500);
                  setProgress(fraction / 3);
                  if (fraction === 1) {
                    current = "turn";
                    setStep(current);
                  }
                } else centeredSince = 0;
              } else if (Math.abs(yaw) >= 0.32) {
                if (current === "turn") {
                  firstSign = Math.sign(yaw);
                  current = "opposite";
                  setStep(current);
                  setProgress(2 / 3);
                } else if (Math.sign(yaw) === -firstSign) {
                  setProgress(1);
                  stream?.getTracks().forEach((track) => track.stop());
                  completeRef.current();
                  return;
                }
              }
            } else if (current === "center") centeredSince = 0;
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      } catch {
        stream?.getTracks().forEach((track) => track.stop());
        if (!cancelled) setError("Face check unavailable. Allow camera access and try again.");
      }
    };
    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      landmarker?.close();
    };
  }, []);

  return (
    <div className="tracker-liveness">
      <div className="tracker-liveness-camera">
        <video ref={video} muted playsInline aria-label="Live face camera" />
        {!ready && !error && (
          <span className="tracker-liveness-loading">Preparing face check…</span>
        )}
      </div>
      <p role="status">{error || instructions[step]}</p>
      <div
        className="tracker-liveness-track"
        role="progressbar"
        aria-label="Face gesture progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <small>Demo presence check. This does not identify you.</small>
    </div>
  );
}
