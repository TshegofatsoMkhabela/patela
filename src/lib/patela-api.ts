// Client for the Patela Fastify backend (backend/src/app.ts).
// Sessions live in HTTP-only cookies set by the backend, so every request
// sends credentials and nothing here stores or exposes tokens.
import type { Evidence, Stage } from "@/lib/handoff";
import type { OrderView } from "@/lib/order-flow";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  wallet_address: string | null;
  created_at: string;
};

export type WalletChallenge = {
  challengeId: string;
  expiresAt: string;
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  };
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createPatelaApi({
  baseUrl,
  fetch,
}: {
  baseUrl: string;
  fetch: typeof globalThis.fetch;
}) {
  const root = baseUrl.replace(/\/+$/, "");

  async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${root}${path}`, {
        method,
        credentials: "include",
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError("Could not reach the Patela server. Check your connection.", 0);
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        data && typeof data.error === "string" ? data.error : `Request failed (${response.status})`;
      throw new ApiError(message, response.status);
    }
    return data as T;
  }

  const me = () => call<Profile>("/me");

  return {
    me,
    requestOtp: (email: string) =>
      call<{ queued: boolean; demo?: boolean; code?: string }>("/auth/otp/request", "POST", {
        email,
      }),
    async verifyOtp(email: string, code: string): Promise<Profile> {
      // The verify response also carries the raw session tokens; the cookies it
      // sets are what we use, so the body is deliberately discarded.
      await call("/auth/otp/verify", "POST", { email, code });
      return me();
    },
    async googleSignIn(credential: string): Promise<Profile> {
      const result = await call<{ profile: Profile }>("/auth/google/id-token", "POST", {
        credential,
      });
      return result.profile;
    },
    updateName: (fullName: string) => call<Profile>("/me", "PATCH", { fullName }),
    walletChallenge: (wallet: string) =>
      call<WalletChallenge>("/wallet/challenge", "POST", { wallet }),
    walletLink: (challengeId: string, signature: string) =>
      call<Profile>("/wallet/link", "POST", { challengeId, signature }),

    // Orders (two-handoff escrow). Routes: backend/src/app.ts; shapes: specs/INTERFACES.md §4.
    listOrders: () => call<{ orders: OrderSummary[] }>("/orders"),
    order: (id: string) => call<OrderView>(`/orders/${seg(id)}`),
    createOrder: (body: Record<string, unknown>) =>
      call<{ id: string; acceptUrl?: string }>("/orders", "POST", body),
    invitation: (token: string) => call<Invitation>(`/invitations/${seg(token)}`),
    acceptInvitation: (token: string, walletAddress: string) =>
      call<OrderView>(`/invitations/${seg(token)}/accept`, "POST", { walletAddress }),
    linkChain: (id: string, chainOrderId: string, createTxHash: string) =>
      call<OrderView>(`/orders/${seg(id)}/chain`, "POST", { chainOrderId, createTxHash }),
    verifyTx: (id: string, step: "funding" | "acceptance" | "driver" | "refund", txHash: string) =>
      call<OrderView>(`/orders/${seg(id)}/${step}/verify`, "POST", { txHash }),
    inviteDriver: (id: string, email: string) =>
      call<{ invited: boolean; acceptUrl?: string }>(`/orders/${seg(id)}/driver-invite`, "POST", {
        email,
      }),
    openHandoff: (
      id: string,
      stage: Stage,
      body: { nonce: string; expiresAt: number; giverEvidence: Evidence },
    ) => call<{ sessionId: string }>(`/orders/${seg(id)}/handoffs/${stage}/session`, "POST", body),
    handoffState: (id: string, stage: Stage, sessionId: string) =>
      call<HandoffState>(`/orders/${seg(id)}/handoffs/${stage}/session/${seg(sessionId)}`),
    submitReceiver: (
      id: string,
      stage: Stage,
      sessionId: string,
      body: { receiverEvidence: Evidence; evidenceHash: string; receiverSig: string },
    ) =>
      call<{ ok: true }>(
        `/orders/${seg(id)}/handoffs/${stage}/session/${seg(sessionId)}/receiver`,
        "POST",
        body,
      ),
    verifyHandoff: (id: string, stage: Stage, txHash: string) =>
      call<OrderView>(`/orders/${seg(id)}/handoffs/${stage}/verify`, "POST", { txHash }),
  };
}

const seg = (value: string) => encodeURIComponent(value);

export type OrderSummary = {
  id: string;
  chainOrderId: string | null;
  totalWei: string;
  status: OrderView["status"];
  refundDeadline: string;
  createdAt: string;
};

export type Invitation = {
  orderId: string;
  role: "supplier" | "driver";
  email: string;
  agreementText: string | null;
  agreementHash: string;
};

/** Empty until the receiver has scanned the QR and countersigned. */
export type HandoffState = {
  receiverEvidence?: Evidence;
  evidenceHash?: string;
  receiverSig?: string;
};

const AFTER_SIGN_IN = "/orders";

/**
 * Where to go after sign-in. Only a same-site path is allowed ("/…", but not "//host" or
 * "/\host", which browsers treat as another site), so a crafted link cannot redirect elsewhere.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return AFTER_SIGN_IN;
  }
  return value;
}

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const isOtpCode = (value: string) => /^\d{6}$/.test(value);

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export const patelaApi = createPatelaApi({
  baseUrl: API_BASE_URL,
  fetch: (...args) => globalThis.fetch(...args),
});

/** Shape the UI already keeps in localStorage under patela_auth_user. */
export function toAuthUser(profile: Profile) {
  return {
    id: profile.id,
    fullName: profile.full_name || profile.email.split("@")[0],
    email: profile.email,
    // The backend has no marketplace role yet; signed-in users start as buyers.
    role: "buyer",
    roleTitle: "Commercial Buyer / Consignor",
    walletAddress: profile.wallet_address,
    verified: true,
    source: "backend" as const,
    signedInAt: new Date().toISOString(),
  };
}

export function saveAuthUser(user: Record<string, unknown>): boolean {
  try {
    localStorage.setItem("patela_auth_user", JSON.stringify(user));
    return true;
  } catch {
    return false;
  }
}
