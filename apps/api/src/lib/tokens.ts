import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { env } from "../config/env.js";

const key = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const ISSUER = "kairos";
const AUDIENCE = "kairos-panel";

export const roleSchema = z.enum(["super_admin", "tenant_admin", "tenant_staff"]);
export type Role = z.infer<typeof roleSchema>;

const claimsSchema = z.object({
  sub: z.string().uuid(),
  role: roleSchema,
  tid: z.string().uuid().optional(),
});
export type AccessClaims = z.infer<typeof claimsSchema>;

export function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ role: claims.role, ...(claims.tid ? { tid: claims.tid } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
  return claimsSchema.parse(payload);
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function newRefreshToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
