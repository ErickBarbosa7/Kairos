import "../config/env.js";
import { randomInt } from "node:crypto";
import { prisma } from "../db/prisma.js";

// SOLO DESARROLLO. Crea un cupón PENDING para probar la caja antes de que exista la Wallet.
// Uso: TENANT_SLUG=cafeteria-aurora pnpm --filter @kairos/api seed:coupon
const slug = process.env.TENANT_SLUG;
if (!slug) throw new Error("Define TENANT_SLUG");
if (process.env.NODE_ENV === "production") throw new Error("No usar en producción");

const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
const consumer = await prisma.consumer.upsert({
  where: { email: "demo@kairos.local" },
  update: {},
  create: { email: "demo@kairos.local", displayName: "Cliente demo" },
});
const wallet = await prisma.wallet.upsert({
  where: { tenantId_consumerId: { tenantId: tenant.id, consumerId: consumer.id } },
  update: {},
  create: { tenantId: tenant.id, consumerId: consumer.id, balance: 500 },
});
const reward =
  (await prisma.reward.findFirst({ where: { tenantId: tenant.id, deletedAt: null } })) ??
  (await prisma.reward.create({ data: { tenantId: tenant.id, title: "Café gratis", pointsCost: 100 } }));

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // sin 0/O/1/I
const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

await prisma.coupon.create({
  data: {
    tenantId: tenant.id,
    walletId: wallet.id,
    rewardId: reward.id,
    rewardTitle: reward.title,
    pointsCost: reward.pointsCost,
    code,
    expiresAt: new Date(Date.now() + 60 * 60_000),
  },
});
console.log(`Cupón para ${tenant.name}: ${code.slice(0, 3)}-${code.slice(3)} (vence en 1 h)`);
await prisma.$disconnect();
