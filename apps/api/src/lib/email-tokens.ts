import type { EmailTokenPurpose } from "@prisma/client";
import { randomBytes, randomInt } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { hashToken } from "./tokens.js";

const MIN = 60_000;
export const TTL = { TENANT_RESET: 60 * MIN, TENANT_VERIFY: 48 * 60 * MIN, CONSUMER_RESET: 30 * MIN } as const;

// Sin 0/O/1/I para que el código sea fácil de teclear desde el correo.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const shortCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/** Crea un token de un solo uso (y anula los anteriores del mismo tipo). Devuelve el valor en claro. */
export async function issueEmailToken(purpose: EmailTokenPurpose, subjectId: string, kind: "link" | "code" = "link"): Promise<string> {
  const value = kind === "code" ? shortCode() : randomBytes(32).toString("base64url");
  await prisma.emailToken.updateMany({ where: { purpose, subjectId, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.emailToken.create({
    data: { purpose, subjectId, tokenHash: hashToken(value), expiresAt: new Date(Date.now() + TTL[purpose]) },
  });
  return value;
}

// Los códigos cortos se teclean: se ignoran mayúsculas, espacios y guiones. Los enlaces (43 caracteres) van tal cual.
const normalize = (v: string) => (v.length <= 20 ? v.replace(/[\s-]/g, "").toUpperCase() : v.trim());

/** Consume el token si es válido y devuelve a quién pertenece. Un token solo sirve una vez. */
export async function consumeEmailToken(purpose: EmailTokenPurpose, value: string): Promise<string | null> {
  const tokenHash = hashToken(normalize(value));
  const row = await prisma.emailToken.findUnique({ where: { tokenHash } });
  if (!row || row.purpose !== purpose) return null;
  const res = await prisma.emailToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  return res.count === 1 ? row.subjectId : null;
}
