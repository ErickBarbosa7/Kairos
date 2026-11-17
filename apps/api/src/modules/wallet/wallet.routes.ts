import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { HttpError } from "../../lib/errors.js";
import { signConsumerToken, verifyConsumerToken } from "../../lib/consumer-tokens.js";
import { requireConsumer } from "../../middleware/consumer.js";
import { emailTaken, invalidCredentials, isUniqueViolation, mergeGuestIntoAccount } from "./account.service.js";
import { claimQr } from "./qr-claim.service.js";
import { redeemReward } from "./redeem.service.js";

/** Rutas del cliente final (Wallet). Autenticadas con token de cliente, no de panel. */
export function walletRouter(opts: { rateLimit: boolean }) {
  const r = Router();

  if (opts.rateLimit) {
    r.use("/claims", rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false }));
    r.use(["/register", "/login"], rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false }));
    r.use("/guest", rateLimit({ windowMs: 60 * 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false }));
  }

  // Sin fricción: quien escanea su primer QR recibe una cuenta de invitado al instante, sin
  // teléfono ni contraseña. El token vive en su dispositivo; los puntos se acumulan ahí.
  r.post("/guest", async (_req, res) => {
    const consumer = await prisma.consumer.create({ data: { isGuest: true } });
    const token = await signConsumerToken(consumer.id, env.GUEST_TOKEN_DAYS * 24 * 60 * 60);
    res.status(201).json({ token, consumerId: consumer.id });
  });

  const credentials = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(8).max(200) });
  const meSelect = { id: true, displayName: true, isGuest: true, email: true } as const;
  const sessionTtl = env.GUEST_TOKEN_DAYS * 24 * 60 * 60;

  // Inicio de sesión. Si llega el token de un invitado, sus puntos se fusionan en la cuenta.
  r.post("/login", async (req, res) => {
    const { email, password } = credentials.strict().parse(req.body);
    const account = await prisma.consumer.findFirst({ where: { email, deletedAt: null, isGuest: false } });
    if (!(await verifyPassword(account?.passwordHash, password)) || !account) throw invalidCredentials();
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      try {
        const { consumerId } = await verifyConsumerToken(header.slice(7));
        await mergeGuestIntoAccount(consumerId, account.id);
      } catch {
        // Token ausente o inválido: se inicia sesión sin fusionar.
      }
    }
    const me = await prisma.consumer.findUniqueOrThrow({ where: { id: account.id }, select: meSelect });
    res.json({ token: await signConsumerToken(account.id, sessionTtl), me });
  });

  r.use(requireConsumer);

  // Convierte al invitado actual en cuenta: conserva su id, y con él puntos, cupones y movimientos.
  r.post("/register", async (req, res) => {
    const { email, password, displayName } = credentials.extend({ displayName: z.string().trim().min(1).max(40).optional() }).strict().parse(req.body);
    const current = await prisma.consumer.findUniqueOrThrow({ where: { id: req.consumerId! } });
    if (!current.isGuest) throw new HttpError(409, "Ya tienes una cuenta", "already_registered");
    try {
      const me = await prisma.consumer.update({
        where: { id: current.id },
        data: { email, passwordHash: await hashPassword(password), isGuest: false, ...(displayName ? { displayName } : {}) },
        select: meSelect,
      });
      res.json({ token: await signConsumerToken(current.id, sessionTtl), me });
    } catch (e) {
      if (isUniqueViolation(e)) throw emailTaken();
      throw e;
    }
  });

  r.get("/me", async (req, res) => {
    const me = await prisma.consumer.findUniqueOrThrow({ where: { id: req.consumerId! }, select: meSelect });
    res.json(me);
  });

  r.patch("/me", async (req, res) => {
    const { displayName } = z.object({ displayName: z.string().trim().min(1).max(40) }).strict().parse(req.body);
    const me = await prisma.consumer.update({ where: { id: req.consumerId! }, data: { displayName }, select: meSelect });
    res.json(me);
  });

  // Acredita los puntos de un QR firmado por una máquina Arcade.
  r.post("/claims", async (req, res) => {
    const { qr } = z.object({ qr: z.string().min(20).max(2000) }).strict().parse(req.body);
    res.status(201).json(await claimQr(req.consumerId!, qr));
  });

  // Saldo del cliente en cada negocio donde tiene billetera.
  r.get("/balances", async (req, res) => {
    const wallets = await prisma.wallet.findMany({
      where: { consumerId: req.consumerId!, tenant: { status: "ACTIVE", deletedAt: null } },
      orderBy: { updatedAt: "desc" },
      include: { tenant: { select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true } } },
    });
    const now = new Date();
    const data = await Promise.all(
      wallets.map(async (w) => {
        const redeemable = { tenantId: w.tenantId, isActive: true, deletedAt: null, OR: [{ stock: null }, { stock: { gt: 0 } }] };
        // Progreso: el premio más barato que aún no le alcanza, y cuántos ya puede canjear.
        const [next, affordable, readyCoupons] = await Promise.all([
          prisma.reward.findFirst({
            where: { ...redeemable, pointsCost: { gt: w.balance } },
            orderBy: [{ pointsCost: "asc" }, { createdAt: "asc" }],
            select: { id: true, title: true, imageUrl: true, pointsCost: true },
          }),
          prisma.reward.count({ where: { ...redeemable, pointsCost: { lte: w.balance, gt: 0 } } }),
          prisma.coupon.count({ where: { walletId: w.id, status: "PENDING", validFrom: { lte: now }, expiresAt: { gt: now } } }),
        ]);
        return {
          tenant: w.tenant,
          balance: w.balance,
          lifetimeEarned: w.lifetimeEarned,
          nextReward: next && { ...next, missing: next.pointsCost - w.balance },
          affordableRewards: affordable,
          readyCoupons,
        };
      }),
    );
    res.json({ data });
  });

  // Canjea puntos por un premio: descuenta el saldo y entrega un cupón para caja (ESQUEMA.md 5.2).
  r.post("/redeem", async (req, res) => {
    const { rewardId } = z.object({ rewardId: z.uuid() }).strict().parse(req.body);
    res.status(201).json(await redeemReward(req.consumerId!, rewardId));
  });

  // Catálogo canjeable de un negocio.
  r.get("/rewards", async (req, res) => {
    const { tenantId } = z.object({ tenantId: z.uuid() }).parse(req.query);
    const rewards = await prisma.reward.findMany({
      where: { tenantId, isActive: true, deletedAt: null, OR: [{ stock: null }, { stock: { gt: 0 } }], tenant: { status: "ACTIVE", deletedAt: null } },
      orderBy: [{ pointsCost: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, description: true, imageUrl: true, pointsCost: true },
    });
    res.json({ data: rewards });
  });

  // Cupones del cliente (el vencimiento se calcula al leer: un PENDING pasado de fecha se ve EXPIRED).
  r.get("/coupons", async (req, res) => {
    const rows = await prisma.coupon.findMany({
      where: { wallet: { consumerId: req.consumerId! } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { tenant: { select: { id: true, name: true, logoUrl: true, primaryColor: true } } },
    });
    const now = Date.now();
    res.json({
      data: rows.map((c) => ({
        id: c.id,
        code: c.code,
        rewardTitle: c.rewardTitle,
        pointsCost: c.pointsCost,
        status: c.status === "PENDING" && c.expiresAt.getTime() <= now ? "EXPIRED" : c.status,
        validFrom: c.validFrom,
        expiresAt: c.expiresAt,
        redeemedAt: c.redeemedAt,
        tenant: c.tenant,
      })),
    });
  });

  // Libro de movimientos del cliente en un negocio.
  r.get("/transactions", async (req, res) => {
    const { tenantId } = z.object({ tenantId: z.uuid() }).parse(req.query);
    const rows = await prisma.pointTransaction.findMany({
      where: { tenantId, wallet: { consumerId: req.consumerId! } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, type: true, points: true, balanceAfter: true, createdAt: true, coupon: { select: { rewardTitle: true } } },
    });
    res.json({ data: rows });
  });

  return r;
}
