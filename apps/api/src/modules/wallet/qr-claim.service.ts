import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { decodeJwt, errors as joseErrors, importSPKI, jwtVerify } from "jose";
import { env } from "../../config/env.js";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { conflict, HttpError } from "../../lib/errors.js";

/** El QR de la máquina vive 60 s como máximo (ARQUITECTURA.md 4.2). */
const QR_MAX_LIFETIME_SECONDS = 60;
/** Margen para relojes un poco desfasados entre la máquina y el servidor. */
const CLOCK_TOLERANCE_SECONDS = 5;
const MAX_IAT_IN_FUTURE_SECONDS = 30;
const MAX_SCORE = 100_000_000;
/** El tope diario cuenta las acreditaciones de las últimas 24 horas. */
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Un premio de la ruleta se puede canjear en caja durante este tiempo. */
const PRIZE_COUPON_DAYS = 7;
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // sin 0/O/1/I
const newCouponCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

const claimsSchema = z.object({
  store_id: z.uuid(),
  machine_id: z.uuid(),
  score: z.number().int().min(0).max(MAX_SCORE),
  iat: z.number().int(),
  exp: z.number().int(),
  jti: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  // Recompensa que salió en la ruleta de la terminal. Sin ella, el QR es de puntos.
  reward_id: z.uuid().optional(),
});

const invalid = () => new HttpError(400, "Código QR no válido", "qr_invalid");

/** Lee el machine_id SIN verificar la firma: solo sirve para saber qué llave pública usar. */
function peekMachineId(token: string): string {
  try {
    const parsed = z.uuid().safeParse(decodeJwt(token).machine_id);
    if (parsed.success) return parsed.data;
  } catch {
    /* no es un JWT */
  }
  throw invalid();
}

/**
 * Acredita los puntos de un QR firmado por una máquina (ESQUEMA.md 5.1).
 *
 * El tenant sale de la máquina verificada, nunca de lo que mande el cliente. Esta ruta no es de
 * tenant (el cliente no pertenece a uno), por eso usa el `prisma` global y escribe `tenantId`
 * de forma explícita en cada fila.
 */
export async function claimQr(consumerId: string, token: string) {
  const machine = await prisma.machine.findUnique({
    where: { id: peekMachineId(token) },
    include: { tenant: true, store: true },
  });
  if (!machine) throw invalid();

  const alg = machine.authMode === "WEB_SESSION" ? "HS256" : machine.keyAlgorithm === "EDDSA" ? "EdDSA" : "ES256";
  let payload;
  try {
    const verificationKey = machine.authMode === "WEB_SESSION"
      ? new TextEncoder().encode(env.JWT_ACCESS_SECRET)
      : await importSPKI(machine.publicKey!, alg);
    ({ payload } = await jwtVerify(token, verificationKey, {
      algorithms: [alg],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      requiredClaims: ["exp", "iat", "jti"],
    }));
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new HttpError(400, "El código QR venció. Juega otra vez para ganar uno nuevo", "qr_expired");
    }
    throw invalid();
  }

  const claims = claimsSchema.safeParse(payload);
  if (!claims.success) throw invalid();
  const c = claims.data;
  const now = Math.floor(Date.now() / 1000);
  if (
    c.machine_id !== machine.id ||
    c.store_id !== machine.storeId ||
    c.exp <= c.iat ||
    c.exp - c.iat > QR_MAX_LIFETIME_SECONDS ||
    c.iat > now + MAX_IAT_IN_FUTURE_SECONDS
  ) {
    throw invalid();
  }

  const { tenant } = machine;
  if (tenant.subscriptionEndsAt && tenant.subscriptionEndsAt.getTime() <= Date.now()) {
    throw new HttpError(403, "Este negocio no tiene un plan vigente", "subscription_expired");
  }
  if (machine.status !== "ACTIVE" || machine.revokedAt || tenant.status !== "ACTIVE" || tenant.deletedAt || !machine.store.isActive) {
    throw new HttpError(403, "Esta máquina no está activa", "machine_inactive");
  }

  // Respuesta rápida y clara para el caso común de repetir un QR ya usado.
  if (await prisma.qrClaim.findUnique({ where: { jti: c.jti }, select: { id: true } })) {
    throw conflict("Este código QR ya se usó");
  }

  const ctx = { consumerId, tenant, machine, claims: c };
  try {
    return c.reward_id ? await claimPrize(ctx, c.reward_id) : await claimPoints(ctx);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("Este código QR ya se usó");
    }
    throw err;
  }
}

type Machine = Prisma.MachineGetPayload<{ include: { tenant: true; store: true } }>;
interface Ctx {
  consumerId: string;
  tenant: Machine["tenant"];
  machine: Machine;
  claims: z.infer<typeof claimsSchema>;
}

/**
 * Crea la billetera si no existe y la bloquea. El bloqueo serializa las acreditaciones de un mismo
 * cliente en un mismo negocio (saldo, stock y tope diario sin carreras). Después comprueba el tope diario.
 */
async function lockWalletAndCheckLimit(tx: Prisma.TransactionClient, { consumerId, tenant }: Ctx): Promise<string> {
  await tx.$executeRaw`
    INSERT INTO wallets (id, tenant_id, consumer_id, balance, lifetime_earned, created_at, updated_at)
    VALUES (gen_random_uuid(), ${tenant.id}::uuid, ${consumerId}::uuid, 0, 0, now(), now())
    ON CONFLICT (tenant_id, consumer_id) DO NOTHING`;
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM wallets WHERE tenant_id = ${tenant.id}::uuid AND consumer_id = ${consumerId}::uuid FOR UPDATE`;
  const walletId = locked[0]?.id;
  if (!walletId) throw new Error("No se pudo obtener la billetera");

  const recent = await tx.qrClaim.count({
    where: { consumerId, tenantId: tenant.id, createdAt: { gte: new Date(Date.now() - DAILY_WINDOW_MS) } },
  });
  if (recent >= tenant.maxGamesPerDay) {
    throw new HttpError(429, "Llegaste al límite de partidas con premio de hoy en este negocio", "daily_limit");
  }
  return walletId;
}

const placeOf = ({ tenant, machine }: Ctx) => ({
  tenant: { id: tenant.id, name: tenant.name },
  store: { id: machine.store.id, name: machine.store.name },
});

/** QR de puntos (ESQUEMA.md 5.1): suma `min(score / score_per_point, max_points_per_game)` al saldo. */
async function claimPoints(ctx: Ctx) {
  const { consumerId, tenant, machine, claims: c } = ctx;
  const points = Math.min(Math.floor(c.score / tenant.scorePerPoint), tenant.maxPointsPerGame);
  if (points <= 0) throw new HttpError(422, "El puntaje no alcanza para ganar puntos", "score_too_low");

  return prisma.$transaction(async (tx) => {
    const walletId = await lockWalletAndCheckLimit(tx, ctx);
    // UNIQUE (jti): la defensa real contra repetir un QR, incluso con peticiones simultáneas.
    const claim = await tx.qrClaim.create({
      data: {
        jti: c.jti,
        tenantId: tenant.id,
        machineId: machine.id,
        consumerId,
        score: c.score,
        pointsAwarded: points,
        qrIssuedAt: new Date(c.iat * 1000),
      },
    });
    const wallet = await tx.wallet.update({
      where: { id: walletId },
      data: { balance: { increment: points }, lifetimeEarned: { increment: points } },
    });
    await tx.pointTransaction.create({
      data: { tenantId: tenant.id, walletId, type: "EARN", points, balanceAfter: wallet.balance, qrClaimId: claim.id },
    });
    return {
      claimId: claim.id,
      pointsAwarded: points,
      score: c.score,
      balance: wallet.balance,
      lifetimeEarned: wallet.lifetimeEarned,
      ...placeOf(ctx),
    };
  });
}

/**
 * QR de premio (ruleta de la terminal): entrega la recompensa que salió como un cupón PENDING que se
 * canjea en caja con su código. No cuesta puntos ni mueve el libro de puntos. Descuenta el stock.
 */
async function claimPrize(ctx: Ctx, rewardId: string) {
  const { consumerId, tenant, machine, claims: c } = ctx;
  // La recompensa debe ser de ESTE negocio: el tenant sale de la máquina, no del QR.
  const reward = await prisma.reward.findFirst({ where: { id: rewardId, tenantId: tenant.id, deletedAt: null } });
  if (!reward) throw invalid();
  if (!reward.isActive) throw new HttpError(409, "Esta recompensa ya no está disponible", "reward_unavailable");

  return prisma.$transaction(async (tx) => {
    const walletId = await lockWalletAndCheckLimit(tx, ctx);
    const claim = await tx.qrClaim.create({
      data: {
        jti: c.jti,
        tenantId: tenant.id,
        machineId: machine.id,
        consumerId,
        score: c.score,
        pointsAwarded: 0,
        rewardId: reward.id,
        qrIssuedAt: new Date(c.iat * 1000),
      },
    });

    if (reward.stock !== null) {
      const taken = await tx.reward.updateMany({ where: { id: reward.id, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } });
      if (taken.count === 0) throw new HttpError(409, "Esta recompensa se agotó", "reward_sold_out");
    }

    let code = newCouponCode();
    for (let i = 0; i < 5 && (await tx.coupon.findFirst({ where: { tenantId: tenant.id, code, status: "PENDING" }, select: { id: true } })); i++) {
      code = newCouponCode();
    }
    const coupon = await tx.coupon.create({
      data: {
        tenantId: tenant.id,
        walletId,
        rewardId: reward.id,
        rewardTitle: reward.title,
        pointsCost: 0,
        code,
        qrClaimId: claim.id,
        expiresAt: new Date(Date.now() + PRIZE_COUPON_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } });

    return {
      claimId: claim.id,
      pointsAwarded: 0,
      score: c.score,
      balance: wallet.balance,
      lifetimeEarned: wallet.lifetimeEarned,
      reward: { id: reward.id, title: reward.title, imageUrl: reward.imageUrl },
      coupon: { id: coupon.id, code: coupon.code, expiresAt: coupon.expiresAt },
      ...placeOf(ctx),
    };
  });
}
