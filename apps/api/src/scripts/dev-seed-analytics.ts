import "../config/env.js";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { buildWeeklyReport } from "../modules/tenant/weekly.service.js";

// SOLO DESARROLLO. Llena el negocio demo con ~200 clientes y ~1 500 visitas de los últimos 45 días,
// con horas pico y abandono tras la 2.ª visita, para que el panel Resultados muestre números creíbles.
// Uso: TENANT_SLUG=demo-arcade pnpm --filter @kairos/api seed:analytics   (corre antes seed:arcade)
// Repetirlo borra solo los datos que creó antes (clientes demo-analytics-*).
if (process.env.NODE_ENV === "production") throw new Error("No usar en producción");

const slug = process.env.TENANT_SLUG ?? "demo-arcade";
const tenant = await prisma.tenant.findUnique({ where: { slug } });
if (!tenant) throw new Error(`No existe el negocio ${slug}. Corre antes seed:arcade`);
const machine = await prisma.machine.findFirst({ where: { tenantId: tenant.id, status: "ACTIVE" } });
if (!machine) throw new Error("El negocio no tiene máquinas activas. Corre antes seed:arcade");

// Limpieza de una corrida anterior.
const old = await prisma.consumer.findMany({ where: { displayName: { startsWith: "demo-analytics-" } }, select: { id: true } });
if (old.length) {
  const ids = old.map((c) => c.id);
  await prisma.$executeRawUnsafe(`ALTER TABLE point_transactions DISABLE TRIGGER point_transactions_immutable`);
  try {
    await prisma.pointTransaction.deleteMany({ where: { wallet: { consumerId: { in: ids } } } });
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE point_transactions ENABLE TRIGGER point_transactions_immutable`);
  }
  await prisma.coupon.deleteMany({ where: { wallet: { consumerId: { in: ids } } } });
  await prisma.qrClaim.deleteMany({ where: { consumerId: { in: ids } } });
  await prisma.wallet.deleteMany({ where: { consumerId: { in: ids } } });
  await prisma.consumer.deleteMany({ where: { id: { in: ids } } });
}

// Generador con semilla: la misma corrida da los mismos números.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(weighted: [T, number][]) => {
  let r = rand() * weighted.reduce((n, [, w]) => n + w, 0);
  for (const [v, w] of weighted) if ((r -= w) <= 0) return v;
  return weighted[0]![0];
};
// Hora local (México) con picos al desayuno y a la tarde; UTC = local + 6.
const HOURS: [number, number][] = [[8, 5], [9, 9], [10, 6], [12, 4], [14, 3], [16, 9], [17, 10], [18, 6], [20, 2]];

const DAY = 86_400_000;
const rewards = await prisma.reward.findMany({ where: { tenantId: tenant.id, deletedAt: null } });
await prisma.tenant.update({ where: { id: tenant.id }, data: { avgTicket: tenant.avgTicket ?? 85 } });
for (const r of rewards) if (r.unitCost === null) await prisma.reward.update({ where: { id: r.id }, data: { unitCost: Math.max(5, Math.round(r.pointsCost / 6)) } });

let visits = 0;
for (let i = 0; i < 200; i++) {
  const consumer = await prisma.consumer.create({ data: { isGuest: true, displayName: `demo-analytics-${i}` } });
  const wallet = await prisma.wallet.create({ data: { tenantId: tenant.id, consumerId: consumer.id } });
  // Primera visita en los últimos 45 días; después, abandono: 55 % no vuelve, y quien vuelve rara vez pasa de 4 visitas.
  const first = Date.now() - Math.floor(rand() * 45) * DAY;
  const count = rand() < 0.55 ? 1 : 2 + Math.floor(rand() * rand() * 4);
  let balance = 0;
  let last = first;
  for (let v = 0; v < count; v++) {
    const when = v === 0 ? first : last + (2 + Math.floor(rand() * 9)) * DAY;
    if (when > Date.now()) break;
    last = when;
    const d = new Date(when);
    d.setUTCHours(pick(HOURS) + 6, Math.floor(rand() * 60), 0, 0);
    const score = 200 + Math.floor(rand() * 1200);
    const points = Math.min(Math.floor(score / tenant.scorePerPoint), tenant.maxPointsPerGame);
    const claim = await prisma.qrClaim.create({
      data: { jti: randomUUID().replaceAll("-", ""), tenantId: tenant.id, machineId: machine.id, consumerId: consumer.id, score, pointsAwarded: points, qrIssuedAt: d, createdAt: d },
    });
    balance += points;
    await prisma.pointTransaction.create({
      data: { tenantId: tenant.id, walletId: wallet.id, type: "EARN", points, balanceAfter: balance, qrClaimId: claim.id, createdAt: d },
    });
    // Algunos canjean un premio de caja.
    const prize = rewards[Math.floor(rand() * rewards.length)];
    if (prize && balance >= prize.pointsCost && rand() < 0.25) {
      balance -= prize.pointsCost;
      const redeemedAt = new Date(d.getTime() + 60_000);
      const coupon = await prisma.coupon.create({
        data: {
          tenantId: tenant.id, walletId: wallet.id, rewardId: prize.id, rewardTitle: prize.title, pointsCost: prize.pointsCost,
          code: randomUUID().slice(0, 6).toUpperCase(), status: "REDEEMED", validFrom: d, expiresAt: new Date(d.getTime() + 7 * DAY), redeemedAt, createdAt: d,
        },
      });
      await prisma.pointTransaction.create({
        data: { tenantId: tenant.id, walletId: wallet.id, type: "REDEEM", points: -prize.pointsCost, balanceAfter: balance, couponId: coupon.id, createdAt: redeemedAt },
      });
    }
    visits++;
  }
  await prisma.wallet.update({ where: { id: wallet.id }, data: { balance, lifetimeEarned: balance } });
}
await buildWeeklyReport(prisma, tenant.id);
console.log(`Listo: 200 clientes y ${visits} visitas en ${tenant.name} (${slug}). Plan ${tenant.plan}: para ver todo el panel, ponlo en PRO.`);
await prisma.$disconnect();
