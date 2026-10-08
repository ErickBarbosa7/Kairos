import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { env } from "../config/env.js";

const key = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const ISSUER = "kairos";
// Audiencia distinta a la del panel: un token de panel no sirve en la Wallet y viceversa.
const AUDIENCE = "kairos-wallet";

const claimsSchema = z.object({ sub: z.string().uuid(), role: z.literal("consumer") });

/**
 * Token de acceso de un cliente final (Wallet). El inicio de sesión del cliente (OTP por teléfono
 * o correo) todavía no existe; hoy los tokens salen del script `seed:consumer` y de las pruebas.
 */
export function signConsumerToken(consumerId: string, ttlSeconds: number = env.ACCESS_TOKEN_TTL_SECONDS): Promise<string> {
  return new SignJWT({ role: "consumer" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(consumerId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key);
}

export async function verifyConsumerToken(token: string): Promise<{ consumerId: string }> {
  const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
  return { consumerId: claimsSchema.parse(payload).sub };
}
