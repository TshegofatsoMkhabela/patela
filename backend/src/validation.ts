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
