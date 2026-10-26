import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../../config/index.js";
import crypto from "node:crypto";
import { UnauthorizedError } from "@syncstream/shared-utils";

export type AccessPayload = {
  sub: string;
  typ: "access";
};

export function signAccessToken(userId: string): string {
  return jwt.sign(
    { sub: userId, typ: "access" } satisfies AccessPayload,
    config.JWT_ACCESS_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"] },
  );
}


export function verifyAccessToken(token: string): AccessPayload {
  try {
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessPayload;
    if (payload.typ !== "access" || !payload.sub) {
      throw new UnauthorizedError("Invalid access token");
    }
    return payload;
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

/** Opaque refresh token (not a JWT) — store only the hash. */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshExpiresAt(): Date {
  const match = /^(\d+)([dhms])$/.exec(config.JWT_REFRESH_EXPIRES_IN);
  const now = Date.now();
  if (!match) {
    return new Date(now + 7 * 24 * 60 * 60 * 1000);
  }
  const n = Number(match[1]);
  const unit = match[2];
  const ms =
    unit === "d" ? n * 86400000 :
    unit === "h" ? n * 3600000 :
    unit === "m" ? n * 60000 :
    n * 1000;
  return new Date(now + ms);
}