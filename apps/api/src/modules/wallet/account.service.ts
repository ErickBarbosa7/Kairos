import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../lib/errors.js";

/**
 * Fusiona un invitado en una cuenta existente (spec wallet-login §5.3). Una sola transacción.
 * El libro `point_transactions` es inmutable: nunca se edita. Si la cuenta no tiene billetera en el
 * negocio, la del invitado pasa a la cuenta con su historial; si la tiene, se suma el saldo con un
 * movimiento EARN nuevo y los cupones y QR se reasignan.
 */
export async function mergeGuestIntoAccount(guestId: string, accountId: string): Promise<void> {
  if (guestId === accountId) return;
  await prisma.$transaction(async (tx) => {
    const guest = await tx.consumer.findFirst({ where: { id: guestId, deletedAt: null, isGuest: true } });
    if (!guest) return; // ya fusionado o no es invitado: nada que hacer
    // Bloqueo en orden de id para que dos fusiones cruzadas no se interbloqueen.
    await tx.$queryRaw`SELECT id FROM wallets WHERE consumer_id IN (${guestId}::uuid, ${accountId}::uuid) ORDER BY id FOR UPDATE`;
    const guestWallets = await tx.wallet.findMany({ where: { consumerId: guestId } });
    for (const gw of guestWallets) {
      const own = await tx.wallet.findUnique({ where: { tenantId_consumerId: { tenantId: gw.tenantId, consumerId: accountId } } });
      if (!own) {
        await tx.wallet.update({ where: { id: gw.id }, data: { consumerId: accountId } });
        continue;
      }
      if (gw.balance > 0) {
        const balanceAfter = own.balance + gw.balance;
        await tx.wallet.update({
          where: { id: own.id },
          data: { balance: balanceAfter, lifetimeEarned: { increment: gw.lifetimeEarned } },
        });
        await tx.pointTransaction.create({
          data: { tenantId: own.tenantId, walletId: own.id, type: "EARN", points: gw.balance, balanceAfter, note: "Puntos de tu sesión de invitado" },
        });
      } else if (gw.lifetimeEarned > 0) {
        await tx.wallet.update({ where: { id: own.id }, data: { lifetimeEarned: { increment: gw.lifetimeEarned } } });
      }
      await tx.coupon.updateMany({ where: { walletId: gw.id }, data: { walletId: own.id } });
      await tx.wallet.update({ where: { id: gw.id }, data: { balance: 0 } });
    }
    await tx.qrClaim.updateMany({ where: { consumerId: guestId }, data: { consumerId: accountId } });
    await tx.consumer.update({ where: { id: guestId }, data: { deletedAt: new Date() } });
  });
}

export const emailTaken = () => new HttpError(409, "Ese correo ya tiene una cuenta", "email_taken");
export const invalidCredentials = () => new HttpError(401, "Correo o contraseña incorrectos", "invalid_credentials");

export const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
