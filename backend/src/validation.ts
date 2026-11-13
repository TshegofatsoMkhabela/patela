import { isAddress, type Address, type Hex } from "viem";

/** An expected, user-facing failure. The HTTP layer turns it into `{ error }` with this status. */
export class DomainError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requiredUuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new DomainError(`Invalid ${label}`);
  return value.toLowerCase();
}

export function requiredEmail(value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length > 254 || !EMAIL.test(trimmed)) throw new DomainError("Valid email required");
  return trimmed.toLowerCase();
}

export function requiredText(value: unknown, label: string, min: number, max: number): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length < min || trimmed.length > max) {
    throw new DomainError(`${label} must be ${min} to ${max} characters`);
  }
  return trimmed;
}

/** PostgreSQL unique_violation. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

const TX_HASH = /^0x[0-9a-f]{64}$/i;

export function requiredAddress(value: unknown, label = "wallet address"): Address {
  if (typeof value !== "string" || !isAddress(value)) throw new DomainError(`Invalid ${label}`);
  return value as Address;
}

export function requiredTx(value: unknown): Hex {
  if (typeof value !== "string" || !TX_HASH.test(value)) throw new DomainError("Invalid transaction hash");
  return value as Hex;
}

export function sameAddress(left: unknown, right: unknown): boolean {
  return typeof left === "string" && typeof right === "string" && left.toLowerCase() === right.toLowerCase();
}

export function utcSeconds(value: unknown): number {
  return Math.floor(new Date(String(value)).getTime() / 1000);
}
