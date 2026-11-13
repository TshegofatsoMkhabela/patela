import { randomBytes, randomUUID } from "node:crypto";
import { isHex, verifyTypedData, type Address, type Hex } from "viem";
import type { Identity } from "./auth.js";
import type { Database } from "./db.js";
import { DomainError, requiredAddress, requiredUuid, utcSeconds } from "./validation.js";

export const CELO_CHAIN_ID = 42220;
export const CELO_SEPOLIA_CHAIN_ID = 11142220;
export const ZARM_CELO = "0x4c35853A3B4e647fD266f4de678dCc8fEC410BF6" as Address;
export const ZARM_CELO_SEPOLIA = "0x10CCfB235b0E1Ed394bACE4560C3ed016697687e" as Address;
export const ZARM_DECIMALS = 18;

type Row = Record<string, unknown>;

function nonce(): Hex {
  return `0x${randomBytes(32).toString("hex")}`;
}

/** EIP-712 data a wallet signs to prove it belongs to the signed-in user. */
export function walletLinkTypedData(
  chainId: number,
  userId: string,
  wallet: Address,
  challengeNonce: Hex,
  expiresAt: number,
) {
  return {
    domain: { name: "Patela Wallet Link", version: "1", chainId },
    types: {
      WalletLink: [
        { name: "userId", type: "string" },
        { name: "wallet", type: "address" },
        { name: "nonce", type: "bytes32" },
        { name: "expiresAt", type: "uint256" },
      ],
    },
    primaryType: "WalletLink" as const,
    message: { userId, wallet, nonce: challengeNonce, expiresAt: BigInt(expiresAt) },
  };
}

/** Profiles and wallet linking. Orders live in orders.ts. */
export class PatelaService {
  constructor(
    private readonly db: Database,
    private readonly chainId = CELO_SEPOLIA_CHAIN_ID,
  ) {}

  async ensureProfile(identity: Identity): Promise<Row> {
    const id = requiredUuid(identity.id, "user ID");
    if (!identity.email || !identity.email.includes("@"))
      throw new DomainError("Authenticated email required", 401);
    const result = await this.db.query<Row>(
      `insert into profiles (id, email) values ($1,$2)
       on conflict (id) do update set email=excluded.email, updated_at=now()
       returning id,email,full_name,role,wallet_address,created_at`,
      [id, identity.email.toLowerCase()],
    );
    return result.rows[0];
  }

  async profile(userId: string): Promise<Row> {
    const result = await this.db.query<Row>(
      "select id,email,full_name,role,wallet_address,created_at from profiles where id=$1",
      [requiredUuid(userId, "user ID")],
    );
    if (!result.rows[0]) throw new DomainError("Profile not found", 404);
    return result.rows[0];
  }

  async updateProfile(userId: string, fullName: unknown): Promise<Row> {
    if (typeof fullName !== "string" || fullName.trim().length < 2 || fullName.length > 120) {
      throw new DomainError("Full name must be 2 to 120 characters");
    }
    const result = await this.db.query<Row>(
      `update profiles set full_name=$2, updated_at=now() where id=$1
       returning id,email,full_name,role,wallet_address,created_at`,
      [requiredUuid(userId, "user ID"), fullName.trim()],
    );
    if (!result.rows[0]) throw new DomainError("Profile not found", 404);
    return result.rows[0];
  }

  async issueWalletChallenge(userId: string, walletInput: unknown) {
    const wallet = requiredAddress(walletInput);
    const challengeNonce = nonce();
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const id = randomUUID();
    await this.db.query(
      `insert into wallet_challenges (id,user_id,wallet_address,nonce,expires_at)
       values ($1,$2,$3,$4,$5)`,
      [
        id,
        requiredUuid(userId, "user ID"),
        wallet.toLowerCase(),
        challengeNonce,
        expiresAt.toISOString(),
      ],
    );
    const typedData = walletLinkTypedData(
      this.chainId,
      userId,
      wallet,
      challengeNonce,
      Math.floor(expiresAt.getTime() / 1000),
    );
    return {
      challengeId: id,
      expiresAt: expiresAt.toISOString(),
      typedData: {
        ...typedData,
        message: { ...typedData.message, expiresAt: typedData.message.expiresAt.toString() },
      },
    };
  }

  async linkWallet(
    userId: string,
    challengeIdInput: unknown,
    signatureInput: unknown,
  ): Promise<Row> {
    const challengeId = requiredUuid(challengeIdInput, "challenge ID");
    if (typeof signatureInput !== "string" || !isHex(signatureInput))
      throw new DomainError("Invalid signature");
    return this.db.transaction(async (db) => {
      const result = await db.query<Row>(
        "select * from wallet_challenges where id=$1 and user_id=$2 for update",
        [challengeId, userId],
      );
      const challenge = result.rows[0];
      if (
        !challenge ||
        challenge.used_at ||
        Date.now() >= new Date(String(challenge.expires_at)).getTime()
      ) {
        throw new DomainError("Wallet challenge expired or used", 409);
      }
      const wallet = requiredAddress(challenge.wallet_address);
      const typedData = walletLinkTypedData(
        this.chainId,
        userId,
        wallet,
        challenge.nonce as Hex,
        utcSeconds(challenge.expires_at),
      );
      const valid = await verifyTypedData({
        ...typedData,
        address: wallet,
        signature: signatureInput as Hex,
      });
      if (!valid) throw new DomainError("Wallet signature did not match", 403);
      await db.query("update wallet_challenges set used_at=now() where id=$1", [challengeId]);
      const updated = await db.query<Row>(
        `update profiles set wallet_address=$2, updated_at=now() where id=$1
         returning id,email,full_name,role,wallet_address,created_at`,
        [userId, wallet.toLowerCase()],
      );
      return updated.rows[0];
    });
  }
}
