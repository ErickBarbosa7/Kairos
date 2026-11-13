import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { app, loginTenant, makeStaff, prisma, resetDb } from "./helpers.js";
import { qr, setup } from "./qr-helpers.js";

beforeEach(async () => {
  await resetDb();
  env.PRIZE_UNLOCK_HOURS = 0;
});

async function guest() {
  const res = await request(app).post("/wallet/guest");
  expect(res.status).toBe(201);
  return { id: res.body.consumerId as string, h: { Authorization: `Bearer ${res.body.token}` } };
}

describe("Cliente invitado (sin fricción)", () => {
  it("crea una cuenta sin teléfono ni correo y su token funciona en la Wallet", async () => {
    const g = await guest();
    const row = await prisma.consumer.findUniqueOrThrow({ where: { id: g.id } });
    expect(row).toMatchObject({ isGuest: true, phone: null, email: null });
    const me = await request(app).get("/wallet/me").set(g.h);
    expect(me.body).toMatchObject({ id: g.id, isGuest: true });
    expect((await request(app).get("/wallet/balances").set(g.h)).body.data).toEqual([]);
  });

  it("puede ponerse un nombre", async () => {
    const g = await guest();
    const res = await request(app).patch("/wallet/me").set(g.h).send({ displayName: "  Ana  " });
    expect(res.body.displayName).toBe("Ana");
  });

  it("acredita un QR de puntos y ve su progreso hacia el siguiente premio", async () => {
    const rig = await setup();
    await prisma.reward.create({ data: { tenantId: rig.tenant.id, title: "Café", pointsCost: 80 } });
    await prisma.reward.create({ data: { tenantId: rig.tenant.id, title: "Pastel", pointsCost: 300 } });
    const g = await guest();

    const res = await request(app).post("/wallet/claims").set(g.h).send({ qr: await qr(rig) });
    expect(res.status).toBe(201);
    expect(res.body.balance).toBe(50);

    const bal = (await request(app).get("/wallet/balances").set(g.h)).body.data[0];
    expect(bal.balance).toBe(50);
    expect(bal.nextReward).toMatchObject({ title: "Café", pointsCost: 80, missing: 30 });
    expect(bal.affordableRewards).toBe(0);
  });

  it("sin premios por alcanzar, nextReward es null y cuenta los que ya puede canjear", async () => {
    const rig = await setup();
    await prisma.reward.create({ data: { tenantId: rig.tenant.id, title: "Galleta", pointsCost: 20 } });
    const g = await guest();
    await request(app).post("/wallet/claims").set(g.h).send({ qr: await qr(rig) });
    const bal = (await request(app).get("/wallet/balances").set(g.h)).body.data[0];
    expect(bal.nextReward).toBeNull();
    expect(bal.affordableRewards).toBe(1);
  });
});

describe("Premio de ruleta que se desbloquea después", () => {
  it("no se puede canjear antes de validFrom y sí después", async () => {
    env.PRIZE_UNLOCK_HOURS = 12;
    const rig = await setup();
    const r = await prisma.reward.create({ data: { tenantId: rig.tenant.id, title: "Café", pointsCost: 200 } });
    const g = await guest();
    const won = await request(app).post("/wallet/claims").set(g.h).send({ qr: await qr(rig, { reward_id: r.id }) });
    expect(won.status).toBe(201);

    const hours = (new Date(won.body.coupon.validFrom).getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(11.9);
    expect(hours).toBeLessThan(12.1);
    const days = (new Date(won.body.coupon.expiresAt).getTime() - new Date(won.body.coupon.validFrom).getTime()) / 86_400_000;
    expect(days).toBeCloseTo(7, 1);

    await makeStaff(rig.tenant.id, "aurora");
    const caja = await loginTenant("aurora", "staff@aurora.test");
    const code = won.body.coupon.code as string;

    const early = await request(app).post(`/tenant/coupons/by-code/${code}/redeem`).set(caja.h);
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe("coupon_not_yet_valid");

    // La Wallet no lo cuenta como listo todavía.
    expect((await request(app).get("/wallet/balances").set(g.h)).body.data[0].readyCoupons).toBe(0);

    await prisma.coupon.updateMany({ data: { validFrom: new Date(Date.now() - 1000) } });
    expect((await request(app).get("/wallet/balances").set(g.h)).body.data[0].readyCoupons).toBe(1);
    const ok = await request(app).post(`/tenant/coupons/by-code/${code}/redeem`).set(caja.h);
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe("REDEEMED");
  });
});
