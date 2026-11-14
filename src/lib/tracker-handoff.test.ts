import { describe, expect, it } from "vitest";
import { isApprovedTrackerQr } from "./tracker-handoff";

describe("tracker handoff QR allowlist", () => {
  const local = "http://localhost:3001";

  it("accepts the deployed Patella site and the current local origin", () => {
    expect(isApprovedTrackerQr("https://myqrcode.mobi/12d2dccd", local)).toBe(true);
    expect(isApprovedTrackerQr("https://demo.d3qsd88bzmzh35.amplifyapp.com/", local)).toBe(true);
    expect(isApprovedTrackerQr("https://demo.d3qsd88bzmzh35.amplifyapp.com/handoff/1", local)).toBe(
      true,
    );
    expect(isApprovedTrackerQr("http://localhost:3001/", local)).toBe(true);
  });

  it("blocks random text, unrelated sites and lookalike subdomains", () => {
    expect(isApprovedTrackerQr("hello", local)).toBe(false);
    expect(isApprovedTrackerQr("https://example.com/", local)).toBe(false);
    expect(
      isApprovedTrackerQr("https://demo.d3qsd88bzmzh35.amplifyapp.com.evil.example/", local),
    ).toBe(false);
  });
});
