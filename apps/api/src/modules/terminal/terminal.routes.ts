import { createHash, randomBytes, randomInt } from "node:crypto";
import type { CookieOptions, RequestHandler, Response } from "express";
import { Router } from "express";
import { SignJWT } from "jose";
import { z } from "zod";
import { env, isProd } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { HttpError, forbidden, notFound, unauthorized } from "../../lib/errors.js";
import { assertWithinPlan } from "../../lib/plans.js";
import { tenantAdminOnly } from "../../middleware/tenant.js";

const COOKIE = "kairos_terminal";
const PAIRING_TTL_MS = 10 * 60_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const QR_TTL_SECONDS = 60;
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const code = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const opaqueToken = () => randomBytes(32).toString("base64url");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const id = z.string().uuid();

const cookieBase: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
  path: "/terminal",
};

export interface TerminalContext {
  machine: { id: string; tenantId: string; storeId: string; label: string; status: "ACTIVE" | "REVOKED"; authMode: "DEVICE_KEY" | "WEB_SESSION" };
}

declare global {
  namespace Express {
    interface Request {
      terminal?: TerminalContext;
    }
  }
}

export const requireTerminal: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[COOKIE] as string | undefined;
  if (!token) throw unauthorized("Esta tableta no está vinculada");
  const session = await prisma.terminalSession.findUnique({
    where: { tokenHash: hash(token) },
    include: {
      machine: {
        select: {
          id: true, tenantId: true, storeId: true, label: true, status: true, revokedAt: true, authMode: true,
          tenant: { select: { status: true, deletedAt: true } },
          store: { select: { isActive: true } },
        },
      },
    },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.machine.status !== "ACTIVE" || session.machine.revokedAt || session.machine.authMode !== "WEB_SESSION" || session.machine.tenant.status !== "ACTIVE" || session.machine.tenant.deletedAt || !session.machine.store.isActive) {
    throw unauthorized("Esta tableta ya no está activa");
  }
  req.terminal = { machine: session.machine };
  next();
};

const pairingView = (pairing: { code: string; expiresAt: Date; approvedAt: Date | null; completedAt: Date | null; machine?: { label: string } | null }) => ({
  code: pairing.code,
  expiresAt: pairing.expiresAt,
  approved: Boolean(pairing.approvedAt),
  completed: Boolean(pairing.completedAt),
  machineLabel: pairing.machine?.label ?? null,
});

/** Rutas de la PWA. No aceptan tokens de administrador. */
export function terminalRouter(opts: { rateLimit: boolean }) {
  const r = Router();

  r.post("/pairings", async (_req, res) => {
    const secret = opaqueToken();
    const pairing = await prisma.terminalPairing.create({
      data: { code: code(), secretHash: hash(secret), expiresAt: new Date(Date.now() + PAIRING_TTL_MS) },
    });
    res.status(201).json({ ...pairingView(pairing), secret });
  });

  r.post("/pairings/:code/complete", async (req, res) => {
    const pairingCode = z.string().length(8).parse(req.params.code).toUpperCase();
    const body = z.object({ secret: z.string().min(40).max(100) }).strict().parse(req.body);
    const pairing = await prisma.terminalPairing.findUnique({ where: { code: pairingCode }, include: { machine: true } });
    if (!pairing || pairing.expiresAt <= new Date() || pairing.completedAt || pairing.secretHash !== hash(body.secret)) {
      throw new HttpError(400, "El código de vinculación no es válido o venció", "pairing_invalid");
    }
    if (!pairing.approvedAt || !pairing.machine) {
      throw new HttpError(409, "La vinculación todavía espera aprobación", "pairing_pending");
    }
    if (pairing.machine.status !== "ACTIVE") throw forbidden("La terminal no está activa");
    const token = opaqueToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.$transaction([
      prisma.terminalSession.create({ data: { tenantId: pairing.machine.tenantId, machineId: pairing.machine.id, tokenHash: hash(token), expiresAt } }),
      prisma.terminalPairing.update({ where: { id: pairing.id }, data: { completedAt: new Date() } }),
    ]);
    res.cookie(COOKIE, token, { ...cookieBase, expires: expiresAt });
    res.json({ machine: { id: pairing.machine.id, label: pairing.machine.label } });
  });

  r.get("/config", requireTerminal, async (req, res) => {
    const machine = req.terminal!.machine;
    await prisma.machine.update({ where: { id: machine.id }, data: { lastSeenAt: new Date() } });
    const [tenant, rewards] = await Promise.all([
      prisma.tenant.findUniqueOrThrow({ where: { id: machine.tenantId }, select: { name: true, logoUrl: true, primaryColor: true, secondaryColor: true, themeMode: true } }),
      prisma.reward.findMany({ where: { tenantId: machine.tenantId, deletedAt: null, isActive: true, OR: [{ stock: null }, { stock: { gt: 0 } }] }, select: { id: true, title: true, imageUrl: true }, orderBy: { createdAt: "asc" } }),
    ]);
    res.json({ machine: { id: machine.id, storeId: machine.storeId, label: machine.label }, tenant, rewards });
  });

  r.post("/claims", requireTerminal, async (req, res) => {
    const body = z.object({ score: z.number().int().min(0).max(100_000_000), rewardId: z.string().uuid().optional() }).strict().parse(req.body);
    const machine = req.terminal!.machine;
    if (body.rewardId) {
      const reward = await prisma.reward.findFirst({ where: { id: body.rewardId, tenantId: machine.tenantId, isActive: true, deletedAt: null, OR: [{ stock: null }, { stock: { gt: 0 } }] }, select: { id: true } });
      if (!reward) throw new HttpError(409, "Esta recompensa ya no está disponible", "reward_unavailable");
    }
    const now = Math.floor(Date.now() / 1000);
    const payload = { store_id: machine.storeId, machine_id: machine.id, score: body.score, iat: now, exp: now + QR_TTL_SECONDS, jti: opaqueToken() } as Record<string, string | number>;
    if (body.rewardId) payload.reward_id = body.rewardId;
    const token = await new SignJWT(payload).setProtectedHeader({ alg: "HS256", typ: "JWT" }).sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET));
    await prisma.machine.update({ where: { id: machine.id }, data: { lastSeenAt: new Date() } });
    res.json({ token, expiresAt: (now + QR_TTL_SECONDS) * 1000 });
  });

  r.post("/logout", requireTerminal, async (req, res) => {
    const token = req.cookies?.[COOKIE] as string;
    await prisma.terminalSession.updateMany({ where: { tokenHash: hash(token), machineId: req.terminal!.machine.id }, data: { revokedAt: new Date() } });
    res.clearCookie(COOKIE, cookieBase);
    res.status(204).end();
  });
  return r;
}

/** Aprobación desde el panel Tenant; crea la máquina web al consumir el código visible en la PWA. */
export const terminalTenantRouter = Router();
terminalTenantRouter.post("/terminal-pairings/:code/approve", tenantAdminOnly, async (req, res) => {
  const pairingCode = z.string().length(8).parse(req.params.code).toUpperCase();
  const body = z.object({ storeId: z.string().uuid(), label: z.string().trim().min(2).max(80) }).strict().parse(req.body);
  const pairing = await prisma.terminalPairing.findUnique({ where: { code: pairingCode } });
  if (!pairing || pairing.expiresAt <= new Date() || pairing.approvedAt || pairing.completedAt) throw notFound("Código de vinculación no encontrado o vencido");
  const store = await req.db!.store.findFirst({ where: { id: body.storeId, isActive: true } });
  if (!store) throw notFound("Sucursal no encontrada");
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: req.auth!.tid! }, select: { plan: true } });
  assertWithinPlan(tenant.plan, "machines", await req.db!.machine.count({ where: { status: "ACTIVE" } }));
  const machine = await prisma.$transaction(async (tx) => {
    const created = await tx.machine.create({ data: { tenantId: req.auth!.tid!, storeId: body.storeId, label: body.label, authMode: "WEB_SESSION" } });
    await tx.terminalPairing.update({ where: { id: pairing.id }, data: { tenantId: req.auth!.tid!, machineId: created.id, approvedAt: new Date() } });
    return created;
  });
  res.status(201).json({ id: machine.id, storeId: machine.storeId, label: machine.label, authMode: machine.authMode, status: machine.status, lastSeenAt: machine.lastSeenAt, revokedAt: machine.revokedAt, createdAt: machine.createdAt });
});
