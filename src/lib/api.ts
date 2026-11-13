// Typed client for the backend routes the buyer uses (specs/INTERFACES.md §4, web core rows).
// Every call sends the session cookie; errors come back as `{ error: string }` with 4xx/5xx.

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the request never reached the server. */
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const apiOrigin = () => (process.env.NEXT_PUBLIC_API_ORIGIN ?? "").replace(/\/+$/, "");

// bigint is not JSON-serialisable; the API takes uint256 values as decimal strings.
const toJson = (body: unknown) =>
  JSON.stringify(body, (_key, value) => (typeof value === "bigint" ? value.toString() : value));

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "include", headers: { Accept: "application/json" } };
  if (body !== undefined) {
    init.headers = { ...init.headers, "Content-Type": "application/json" };
    init.body = toJson(body);
  }
  let response: Response;
  try {
    response = await fetch(`${apiOrigin()}${path}`, init);
  } catch {
    throw new ApiError("Could not reach the Patela API. Check your connection.", 0);
  }
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!response.ok) {
    const message =
      data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return data as T;
}

const id = (value: string) => encodeURIComponent(value);

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  wallet_address: string | null;
};

export type WalletChallenge = {
  challengeId: string;
  expiresAt: string;
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  };
};

export type CreateOrderInput = {
  supplierEmail: string;
  totalZarp: string;
  driverAtPickupZarp: string;
  supplierAtPickupZarp: string;
  supplierAtDeliveryZarp: string;
  refundAfterHours: number;
  agreementText: string;
};

export type CreatedOrder = {
  id: string;
  agreementHash: `0x${string}`;
  /** Unix seconds (becomes the contract's uint64 refundDeadline). */
  refundDeadline: number | string;
};

/**
 * GET /orders/:id returns "order + parties + timeline + balances"; §4 does not freeze field
 * names, so everything beyond `id` is optional and read defensively by the order page.
 */
export type TimelineEntry = { at?: string; label?: string; event?: string; status?: string; txHash?: string };
export type PartyInfo = { email?: string | null; wallet?: string | null; walletAddress?: string | null };
export type OrderDetail = {
  id: string;
  status?: string;
  chainOrderId?: string | null;
  agreementHash?: string;
  agreementText?: string;
  totalZarp?: string;
  supplierEmail?: string;
  parties?: { buyer?: PartyInfo; supplier?: PartyInfo; driver?: PartyInfo };
  timeline?: TimelineEntry[];
  balances?: Record<string, string>;
  [key: string]: unknown;
};

export const api = {
  requestOtp: (email: string) => request<{ queued: boolean }>("POST", "/auth/otp/request", { email }),
  verifyOtp: (email: string, code: string) => request<unknown>("POST", "/auth/otp/verify", { email, code }),
  logout: () => request<{ signedOut: boolean }>("POST", "/auth/logout", {}),
  me: () => request<Profile>("GET", "/me"),

  walletChallenge: (wallet: string) => request<WalletChallenge>("POST", "/wallet/challenge", { wallet }),
  walletLink: (challengeId: string, signature: string) =>
    request<Profile>("POST", "/wallet/link", { challengeId, signature }),

  createOrder: (input: CreateOrderInput) => request<CreatedOrder>("POST", "/orders", input),
  recordChainOrder: (orderId: string, body: { chainOrderId: bigint; createTxHash: string }) =>
    request<OrderDetail>("POST", `/orders/${id(orderId)}/chain`, body),
  verifyFunding: (orderId: string, txHash: string) =>
    request<OrderDetail>("POST", `/orders/${id(orderId)}/funding/verify`, { txHash }),
  getOrder: (orderId: string) => request<OrderDetail>("GET", `/orders/${id(orderId)}`),
};
