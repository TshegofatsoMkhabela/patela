// Explicit React import: vitest here uses the classic JSX transform (tsconfig jsx: "preserve").
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseUnits } from "viem";
import { NETWORK, NETWORK_LABEL } from "@/lib/escrow-chain";
import { BalancePanelView, formatZarp, startBalancePolling } from "./BalancePanel";

void React;

const addresses = {
  buyer: "0xb0b0000000000000000000000000000000000003",
  supplier: "0x5050000000000000000000000000000000000004",
  driver: undefined,
  escrow: "0xE5c0000000000000000000000000000000000001",
} as const;

describe("formatZarp", () => {
  it("Given wei amounts, Then shows ZARP with thousands separators and at most 2 decimals", () => {
    expect(formatZarp(parseUnits("1000", 18))).toBe("1,000.00");
    expect(formatZarp(parseUnits("12.345", 18))).toBe("12.34");
    expect(formatZarp(0n)).toBe("0.00");
    expect(formatZarp(null)).toBe("—");
  });
});

describe("BalancePanelView", () => {
  const html = renderToStaticMarkup(
    <BalancePanelView
      addresses={addresses}
      balances={{
        buyer: parseUnits("900", 18),
        supplier: 0n,
        driver: null,
        escrow: parseUnits("100", 18),
      }}
    />,
  );

  it("Given four parties, Then each wallet card is labelled", () => {
    for (const label of ["Buyer", "Supplier", "Driver", "Escrow"]) expect(html).toContain(label);
  });

  it("Given balances, Then amounts render in the network token", () => {
    expect(html).toContain("900.00");
    expect(html).toContain("100.00");
    expect(html).toContain(NETWORK.tokenSymbol);
  });

  it("Given a driver not yet assigned, Then it shows a placeholder instead of an address", () => {
    expect(html).toContain("Not assigned yet");
  });

  it("Given known addresses, Then they show shortened", () => {
    expect(html).toContain("0xb0b0…0003");
  });

  it("Given the configured chain, Then the panel shows its network label", () => {
    expect(html).toContain(NETWORK_LABEL);
  });

  it("Given a read error, Then the panel shows it", () => {
    const withError = renderToStaticMarkup(
      <BalancePanelView addresses={addresses} balances={null} error="RPC unavailable" />,
    );
    expect(withError).toContain("RPC unavailable");
  });
});

describe("startBalancePolling", () => {
  afterEach(() => vi.useRealTimers());

  it("Given a reader, When polling every 2s, Then it reads immediately and on each tick until stopped", async () => {
    vi.useFakeTimers();
    const read = vi.fn(async () => ({ buyer: 1n }));
    const onUpdate = vi.fn();
    const stop = startBalancePolling(read, onUpdate, () => {}, 2000);
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ buyer: 1n });
    await vi.advanceTimersByTimeAsync(4000);
    expect(read).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("Given a read fails, Then onError is called and polling continues", async () => {
    vi.useFakeTimers();
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error("rpc down"))
      .mockResolvedValue({ buyer: 2n });
    const onUpdate = vi.fn();
    const onError = vi.fn();
    const stop = startBalancePolling(read, onUpdate, onError, 2000);
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith("rpc down");
    await vi.advanceTimersByTimeAsync(2000);
    expect(onUpdate).toHaveBeenCalledWith({ buyer: 2n });
    stop();
  });
});
