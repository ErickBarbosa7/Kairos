import { randomInt } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { HttpError, notFound } from "../../lib/errors.js";

/** Un cupón se puede canjear en caja durante este tiempo (ESQUEMA.md 5.2). */
export const COUPON_DAYS = 7;
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // sin 0/O/1/I
const newCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

/**
 * Canjea puntos por un premio (ESQUEMA.md 5.2). El negocio sale del premio, y la billetera
 * debe ser del cliente que llama. Una sola transacción con la billetera bloqueada.
 */
export async function redeemReward(consumerId: string, rewardId: string) {
  const reward = await prisma.reward.findFirst({
    where: { id: rewardId, deletedAt: null, tenant: { status: "ACTIVE", deletedAt: null } },
    include: { tenant: { select: { id: true, name: true, subscriptionEndsAt: true } } },
  });
  if (!reward) throw notFound("Recompensa no encontrada");
  if (reward.tenant.subscriptionEndsAt && reward.tenant.subscriptionEndsAt.getTime() <= Date.now()) {
    throw new HttpError(403, "Este negocio no tiene un plan vigente", "subscription_expired");
  }
  if (!reward.isActive) throw new HttpError(409, "Esta recompensa ya no está disponible", "reward_unavailable");

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM wallets WHERE tenant_id = ${reward.tenantId}::uuid AND consumer_id = ${consumerId}::uuid FOR UPDATE`;
    const walletId = locked[0]?.id;
    if (!walletId) throw new HttpError(422, "No tienes puntos suficientes", "insufficient_points");

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } });
    if (wallet.balance < reward.pointsCost) {
      throw new HttpError(422, "No tienes puntos suficientes", "insufficient_points");
    }

    if (reward.stock !== null) {
      const taken = await tx.reward.updateMany({ where: { id: reward.id, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } });
      if (taken.count === 0) throw new HttpError(409, "Esta recompensa se agotó", "reward_sold_out");
    }

    let code = newCode();
    for (let i = 0; i < 5 && (await tx.coupon.findFirst({ where: { tenantId: reward.tenantId, code, status: "PENDING" }, select: { id: true } })); i++) {
      code = newCode();
    }
    const coupon = await tx.coupon.create({
      data: {
        tenantId: reward.tenantId,
        walletId,
        rewardId: reward.id,
        rewardTitle: reward.title,
        pointsCost: reward.pointsCost,
        code,
        expiresAt: new Date(Date.now() + COUPON_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    const updated = await tx.wallet.update({ where: { id: walletId }, data: { balance: { decrement: reward.pointsCost } } });
    await tx.pointTransaction.create({
      data: { tenantId: reward.tenantId, walletId, type: "REDEEM", points: -reward.pointsCost, balanceAfter: updated.balance, couponId: coupon.id },
    });
    return {
      coupon: { id: coupon.id, code: coupon.code, rewardTitle: coupon.rewardTitle, pointsCost: coupon.pointsCost, validFrom: coupon.validFrom, expiresAt: coupon.expiresAt },
      balance: updated.balance,
      tenant: { id: reward.tenant.id, name: reward.tenant.name },
    };
  });
}

/**
 * Vence los cupones PENDING pasados de fecha (ESQUEMA.md 5.4). Devuelve los puntos de los cupones
 * canjeados con puntos y repone el stock. Un cupón de ruleta (con `qrClaimId`) no costó puntos: no se reembolsa.
 */
export async function expireCoupons(now = new Date()): Promise<number> {
  const due = await prisma.coupon.findMany({ where: { status: "PENDING", expiresAt: { lte: now } }, select: { id: true }, take: 500 });
  let done = 0;
  for (const { id } of due) {
    const ok = await prisma.$transaction(async (tx) => {
      const moved = await tx.coupon.updateMany({ where: { id, status: "PENDING", expiresAt: { lte: now } }, data: { status: "EXPIRED" } });
      if (moved.count === 0) return false; // otro proceso ya lo tomó
      const c = await tx.coupon.findUniqueOrThrow({ where: { id } });
      if (c.pointsCost > 0 && !c.qrClaimId) {
        await tx.$queryRaw`SELECT id FROM wallets WHERE id = ${c.walletId}::uuid FOR UPDATE`;
        const w = await tx.wallet.update({ where: { id: c.walletId }, data: { balance: { increment: c.pointsCost } } });
        await tx.pointTransaction.create({
          data: { tenantId: c.tenantId, walletId: c.walletId, type: "REFUND", points: c.pointsCost, balanceAfter: w.balance, couponId: c.id },
        });
      }
      await tx.reward.updateMany({ where: { id: c.rewardId, stock: { not: null } }, data: { stock: { increment: 1 } } });
      return true;
    });
    if (ok) done++;
  }
  return done;
}
