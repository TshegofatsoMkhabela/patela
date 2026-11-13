// Client for the Patela Fastify backend (backend/src/app.ts).
// Sessions live in HTTP-only cookies set by the backend, so every request
// sends credentials and nothing here stores or exposes tokens.

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
      call<{ queued: boolean; demo?: boolean; code?: string }>("/auth/otp/request", "POST", { email }),
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
  };
}

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const isOtpCode = (value: string) => /^\d{6}$/.test(value);

export const patelaApi = createPatelaApi({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000",
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
