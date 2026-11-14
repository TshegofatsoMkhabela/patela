export const DEPLOYED_DEMO_ORIGIN = "https://demo.d3qsd88bzmzh35.amplifyapp.com";
export const APPROVED_TRACKER_QR = "https://myqrcode.mobi/12d2dccd";
export const APPROVED_WEBCAM_TEST_QR = "https://webcamtests.com/";

/** Tracker demo allowlist: the deployed Patella site, plus this same origin for local testing. */
export function isApprovedTrackerQr(text: string, currentOrigin: string): boolean {
  try {
    const scanned = new URL(text);
    return (
      scanned.href === APPROVED_TRACKER_QR ||
      scanned.href === APPROVED_WEBCAM_TEST_QR ||
      scanned.origin === DEPLOYED_DEMO_ORIGIN ||
      scanned.origin === currentOrigin
    );
  } catch {
    return false;
  }
}
