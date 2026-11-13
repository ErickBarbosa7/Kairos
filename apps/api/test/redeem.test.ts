import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { signConsumerToken } from "../src/lib/consumer-tokens.js";
import { expireCoupons } from "../src/modules/wallet/redeem.service.js";
import { app, prisma, resetDb } from "./helpers.js";
import { qr, type Rig, setup as baseSetup } from "./qr-helpers.js";

/** Negocio con tope por partida alto para poder juntar puntos en un solo QR. */
const setup = async (opts: { slug?: string } = {}) => {
  const rig = await baseSetup(opts);
  await prisma.tenant.update({ where: { id: rig.tenant.id }, data: { maxPointsPerGame: 100_000 } });
  return rig;
};

let consumerId: string;
let auth: { Authorization: string };

const claim = (token: string) => request(app).post("/wallet/claims").set(auth).send({ qr: token });
const redeem = (rewardId: string, headers = auth) => request(app).post("/wallet/redeem").set(headers).send({ rewardId });
const reward = (rig: Rig, data: { cost?: number; stock?: number | null; isActive?: boolean } = {}) =>
  prisma.reward.create({
    data: { tenantId: rig.tenant.id, title: "Café gratis", pointsCost: data.cost ?? 200, stock: data.stock ?? null, isActive: data.isActive ?? true },
  });
/** Deja `n` puntos en la billetera con un QR de puntos (score = n * 10). */
const earn = (rig: Rig, n: number) => qr(rig, { score: n * 10 }).then(claim);

beforeEach(async () => {
  await resetDb();
  consumerId = (await prisma.consumer.create({ data: { email: "cliente@example.com" } })).id;
  auth = { Authorization: `Bearer ${await signConsumerToken(consumerId)}` };
});

describe("canje de puntos (POST /wallet/redeem)", () => {
  it("descuenta el saldo, crea el cupón y deja REDEEM en el libro", async () => {
    const rig = await setup();
    const r = await reward(rig, { cost: 200, stock: 5 });
    await earn(rig, 500);
    const res = await redeem(r.id);

    expect(res.status).toBe(201);
    expect(res.body.balance).toBe(300);
    expect(res.body.coupon.code).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);
    const coupon = await prisma.coupon.findFirstOrThrow();
    expect(coupon).toMatchObject({ pointsCost: 200, status: "PENDING", qrClaimId: null, rewardTitle: "Café gratis" });
    const tx = await prisma.pointTransaction.findFirstOrThrow({ where: { type: "REDEEM" } });
    expect(tx).toMatchObject({ points: -200, balanceAfter: 300, couponId: coupon.id });
    const wallet = await prisma.wallet.findFirstOrThrow();
    expect(wallet).toMatchObject({ balance: 300, lifetimeEarned: 500 });
    expect((await prisma.reward.findUniqueOrThrow({ where: { id: r.id } })).stock).toBe(4);
  });

  it("rechaza sin puntos suficientes y no cambia nada", async () => {
    const rig = await setup();
    const r = await reward(rig, { cost: 200, stock: 5 });
    await earn(rig, 100);
    const res = await redeem(r.id);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("insufficient_points");
    expect(await prisma.coupon.count()).toBe(0);
    expect((await prisma.reward.findUniqueOrThrow({ where: { id: r.id } })).stock).toBe(5);
  });

  it("rechaza si el cliente no tiene billetera en ese negocio", async () => {
    const rig = await setup();
    const r = await reward(rig);
    const res = await redeem(r.id);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("insufficient_points");
  });

  it("agotado: revierte los puntos", async () => {
    const rig = await setup();
    const r = await reward(rig, { cost: 100, stock: 0 });
    await earn(rig, 500);
    const res = await redeem(r.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("reward_sold_out");
    expect((await prisma.wallet.findFirstOrThrow()).balance).toBe(500);
    expect(await prisma.pointTransaction.count({ where: { type: "REDEEM" } })).toBe(0);
  });

  it("recompensa desactivada, borrada o inexistente", async () => {
    const rig = await setup();
    await earn(rig, 500);
    const off = await reward(rig, { isActive: false });
    expect((await redeem(off.id)).body.error.code).toBe("reward_unavailable");
    const del = await reward(rig);
    await prisma.reward.update({ where: { id: del.id }, data: { deletedAt: new Date() } });
    expect((await redeem(del.id)).status).toBe(404);
    expect((await redeem(randomUUID())).status).toBe(404);
  });

  it("no usa puntos de otro negocio", async () => {
    const a = await setup({ slug: "aurora" });
    const b = await setup({ slug: "brisa" });
    await earn(a, 500);
    const r = await reward(b, { cost: 100 });
    expect((await redeem(r.id)).body.error.code).toBe("insufficient_points");
  });

  it("peticiones simultáneas: no gasta más de lo que hay", async () => {
    const rig = await setup();
    const r = await reward(rig, { cost: 200 });
    await earn(rig, 500);
    const results = await Promise.all([1, 2, 3, 4].map(() => redeem(r.id)));
    expect(results.filter((x) => x.status === 201)).toHaveLength(2);
    expect((await prisma.wallet.findFirstOrThrow()).balance).toBe(100);
    expect(await prisma.coupon.count()).toBe(2);
  });

  it("exige token de cliente", async () => {
    const rig = await setup();
    const r = await reward(rig);
    expect((await redeem(r.id, {} as typeof auth)).status).toBe(401);
  });
});

describe("vencimiento de cupones", () => {
  const expire = (couponId: string) =>
    prisma.coupon.update({ where: { id: couponId }, data: { expiresAt: new Date(Date.now() - 1000) } });

  it("devuelve los puntos y repone el stock de un cupón canjeado con puntos", async () => {
    const rig = await setup();
    const r = await reward(rig, { cost: 200, stock: 5 });
    await earn(rig, 500);
    await redeem(r.id);
    await expire((await prisma.coupon.findFirstOrThrow()).id);

    expect(await expireCoupons()).toBe(1);
    expect((await prisma.coupon.findFirstOrThrow()).status).toBe("EXPIRED");
    const wallet = await prisma.wallet.findFirstOrThrow();
    expect(wallet).toMatchObject({ balance: 500, lifetimeEarned: 500 });
    expect(await prisma.pointTransaction.findFirstOrThrow({ where: { type: "REFUND" } })).toMatchObject({ points: 200, balanceAfter: 500 });
    expect((await prisma.reward.findUniqueOrThrow({ where: { id: r.id } })).stock).toBe(5);
    expect(await expireCoupons()).toBe(0); // idempotente
    expect((await prisma.wallet.findFirstOrThrow()).balance).toBe(500);
  });

  it("un cupón de ruleta vence sin reembolsar puntos, pero repone el stock", async () => {
    const rig = await setup();
    const r = await reward(rig, { stock: 2 });
    const won = await claim(await qr(rig, { reward_id: r.id, score: 1000 }));
    expect(won.body.balance).toBe(100);
    await expire((await prisma.coupon.findFirstOrThrow()).id);

    expect(await expireCoupons()).toBe(1);
    expect((await prisma.wallet.findFirstOrThrow()).balance).toBe(100);
    expect(await prisma.pointTransaction.count({ where: { type: "REFUND" } })).toBe(0);
    expect((await prisma.reward.findUniqueOrThrow({ where: { id: r.id } })).stock).toBe(2);
  });

  it("no toca cupones vigentes ni ya canjeados", async () => {
    const rig = await setup();
    const r = await reward(rig, { cost: 100 });
    await earn(rig, 500);
    await redeem(r.id);
    expect(await expireCoupons()).toBe(0);
  });
});

describe("consulta del cliente", () => {
  it("lista cupones (vencidos se ven EXPIRED), catálogo y movimientos", async () => {
    const rig = await setup();
    const r = await reward(rig, { cost: 100 });
    await reward(rig, { cost: 50, isActive: false });
    await earn(rig, 300);
    await redeem(r.id);

    const rewards = await request(app).get(`/wallet/rewards?tenantId=${rig.tenant.id}`).set(auth);
    expect(rewards.body.data).toHaveLength(1);
    expect(rewards.body.data[0]).toMatchObject({ id: r.id, pointsCost: 100 });

    const coupons = await request(app).get("/wallet/coupons").set(auth);
    expect(coupons.body.data[0]).toMatchObject({ status: "PENDING", pointsCost: 100 });
    await prisma.coupon.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).get("/wallet/coupons").set(auth)).body.data[0].status).toBe("EXPIRED");

    const tx = await request(app).get(`/wallet/transactions?tenantId=${rig.tenant.id}`).set(auth);
    expect(tx.body.data.map((t: { type: string }) => t.type).sort()).toEqual(["EARN", "REDEEM"]);
  });
});
