import "../config/env.js";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "../lib/password.js";

// SOLO DESARROLLO. Cliente demo con puntos, historial y cupones en varios negocios, más una campaña,
// para ver cómo la Wallet refleja lo que se configura en el panel.
// Acceso en la Wallet: demo@kairos.local / Kairos-Test-2026!
// Uso: pnpm --filter @kairos/api seed:demo   (es idempotente: reinicia solo los datos de este cliente)
if (process.env.NODE_ENV === "production") throw new Error("No usar en producción");

const EMAIL = "demo@kairos.local";
const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY);

// slug → puntos actuales, visitas (días atrás) y cupones.
const PLAN: Record<string, { balance: number; visits: number[]; coupons: { reward: string; status: "PENDING" | "REDEEMED"; daysAgo: number }[] }> = {
  "cafeteria-aurora": { balance: 120, visits: [28, 21, 14, 9, 4, 1], coupons: [{ reward: "Galleta gratis", status: "PENDING", daysAgo: 1 }, { reward: "Café americano", status: "REDEEMED", daysAgo: 12 }] },
  "demo-arcade": { balance: 340, visits: [20, 11, 3], coupons: [{ reward: "Café americano", status: "PENDING", daysAgo: 2 }] },
  "tacos-el-guero": { balance: 45, visits: [6, 2], coupons: [] },
  "snacks-pixel": { balance: 210, visits: [15, 8, 5, 0], coupons: [{ reward: "Refresco gratis", status: "REDEEMED", daysAgo: 7 }] },
};

const consumer = await prisma.consumer.upsert({
  where: { email: EMAIL },
  update: { passwordHash: await hashPassword("Kairos-Test-2026!"), displayName: "Cliente demo", isGuest: false },
  create: { email: EMAIL, displayName: "Cliente demo", passwordHash: await hashPassword("Kairos-Test-2026!") },
});

// Limpieza de una corrida anterior (el trigger bloquea borrar movimientos).
const old = await prisma.wallet.findMany({ where: { consumerId: consumer.id }, select: { id: true } });
if (old.length) {
  const ids = old.map((w) => w.id);
  await prisma.$executeRawUnsafe(`ALTER TABLE point_transactions DISABLE TRIGGER point_transactions_immutable`);
  try {
    await prisma.pointTransaction.deleteMany({ where: { walletId: { in: ids } } });
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE point_transactions ENABLE TRIGGER point_transactions_immutable`);
  }
  await prisma.coupon.deleteMany({ where: { walletId: { in: ids } } });
  await prisma.wallet.deleteMany({ where: { id: { in: ids } } });
}

let code = 410_000 + Math.floor(Math.random() * 400_000);
for (const [slug, plan] of Object.entries(PLAN)) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.log(`· ${slug}: no existe, se omite`);
    continue;
  }
  const tid = tenant.id;
  if ((await prisma.reward.count({ where: { tenantId: tid, deletedAt: null } })) === 0) {
    await prisma.reward.createMany({
      data: [
        { tenantId: tid, title: "Galleta gratis", pointsCost: 60 },
        { tenantId: tid, title: "Café americano", pointsCost: 150, stock: 20 },
        { tenantId: tid, title: "Refresco gratis", pointsCost: 200 },
        { tenantId: tid, title: "Pastel de la casa", pointsCost: 400, stock: 5 },
      ],
    });
  }
  const rewards = await prisma.reward.findMany({ where: { tenantId: tid, deletedAt: null } });

  // Historial: las visitas suman puntos; los cupones restan su costo; el saldo final es `plan.balance`.
  const spent = plan.coupons
    .map((c) => rewards.find((r) => r.title === c.reward) ?? rewards[0]!)
    .reduce((n, r) => n + r.pointsCost, 0);
  const earnedTotal = plan.balance + spent;
  const per = Math.floor(earnedTotal / plan.visits.length);
  const wallet = await prisma.wallet.create({
    data: { tenantId: tid, consumerId: consumer.id, balance: plan.balance, lifetimeEarned: earnedTotal },
  });
  const events: { at: Date; type: "EARN" | "REDEEM"; points: number; note: string; couponIdx?: number }[] = plan.visits.map((d, i) => ({
    at: ago(d), type: "EARN", points: i === plan.visits.length - 1 ? earnedTotal - per * (plan.visits.length - 1) : per, note: "Partida en la máquina Arcade",
  }));
  const couponRows: { id: string }[] = [];
  for (const [i, c] of plan.coupons.entries()) {
    const reward = rewards.find((r) => r.title === c.reward) ?? rewards[0]!;
    const row = await prisma.coupon.create({
      data: {
        tenantId: tid, walletId: wallet.id, rewardId: reward.id, rewardTitle: reward.title, pointsCost: reward.pointsCost,
        code: String(code++), status: c.status, createdAt: ago(c.daysAgo), validFrom: ago(c.daysAgo),
        expiresAt: new Date(Date.now() + 30 * DAY), redeemedAt: c.status === "REDEEMED" ? ago(c.daysAgo - 0.1) : null,
      },
    });
    couponRows.push(row);
    events.push({ at: ago(c.daysAgo), type: "REDEEM", points: -reward.pointsCost, note: `Canje: ${reward.title}`, couponIdx: i });
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  let running = 0;
  for (const e of events) {
    running += e.points;
    await prisma.pointTransaction.create({
      data: { tenantId: tid, walletId: wallet.id, type: e.type, points: e.points, balanceAfter: running, note: e.note, createdAt: e.at, couponId: e.couponIdx === undefined ? null : couponRows[e.couponIdx]!.id },
    });
  }
  console.log(`✔ ${tenant.name}: ${plan.balance} pts, ${plan.visits.length} visitas, ${plan.coupons.length} cupones`);
}

// Campaña activa para que la Wallet muestre el aviso en Cafetería Aurora.
const aurora = await prisma.tenant.findUnique({ where: { slug: "cafeteria-aurora" } });
if (aurora && !(await prisma.campaign.findFirst({ where: { tenantId: aurora.id, name: "Doble puntos de fin de semana" } }))) {
  await prisma.campaign.create({ data: { tenantId: aurora.id, name: "Doble puntos de fin de semana", type: "MULTIPLIER", multiplierPct: 200, weekdays: [0, 6] } });
  console.log("✔ Campaña ×2 fines de semana en Cafetería Aurora");
}
console.log(`\nWallet: ${EMAIL} / Kairos-Test-2026!`);
await prisma.$disconnect();
