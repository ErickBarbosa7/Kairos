import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { signConsumerToken } from "../src/lib/consumer-tokens.js";
import { app, loginTenant, makeStaff, prisma, resetDb } from "./helpers.js";
import { qr, type Rig, setup } from "./qr-helpers.js";

let consumerId: string;
let auth: { Authorization: string };

const claim = (token: string, headers = auth) => request(app).post("/wallet/claims").set(headers).send({ qr: token });
const reward = (tenantId: string, data: { title?: string; stock?: number | null; isActive?: boolean; deletedAt?: Date } = {}) =>
  prisma.reward.create({ data: { tenantId, title: data.title ?? "Café gratis", pointsCost: 200, ...data } });
/** QR de premio: el mismo QR de siempre, con la recompensa que salió en la ruleta. */
const prize = (rig: Rig, rewardId: string, over: Record<string, unknown> = {}) => qr(rig, { reward_id: rewardId, ...over });

beforeEach(async () => {
  await resetDb();
  const consumer = await prisma.consumer.create({ data: { email: "cliente@example.com" } });
  consumerId = consumer.id;
  auth = { Authorization: `Bearer ${await signConsumerToken(consumerId)}` };
});

describe("QR de premio (ruleta)", () => {
  it("entrega un cupón PENDING con la recompensa, sin mover puntos", async () => {
    const rig = await setup();
    const r = await reward(rig.tenant.id, { title: "Galleta de avena", stock: 3 });
    const res = await claim(await prize(rig, r.id));

    expect(res.status).toBe(201);
    expect(res.body.pointsAwarded).toBe(0);
    expect(res.body.reward).toMatchObject({ id: r.id, title: "Galleta de avena" });
    expect(res.body.coupon.code).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);

    const coupon = await prisma.coupon.findFirstOrThrow();
    expect(coupon).toMatchObject({ tenantId: rig.tenant.id, rewardId: r.id, rewardTitle: "Galleta de avena", pointsCost: 0, status: "PENDING" });
    const days = (coupon.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);

    const claimRow = await prisma.qrClaim.findFirstOrThrow();
    expect(claimRow).toMatchObject({ rewardId: r.id, pointsAwarded: 0 });
    expect(coupon.qrClaimId).toBe(claimRow.id);
    expect(await prisma.pointTransaction.count()).toBe(0);
    expect((await prisma.wallet.findFirstOrThrow()).balance).toBe(0);
    expect((await prisma.reward.findUniqueOrThrow({ where: { id: r.id } })).stock).toBe(2);
  });

  it("el cupón se canjea en caja con el flujo que ya existe", async () => {
    const rig = await setup();
    const r = await reward(rig.tenant.id);
    const won = await claim(await prize(rig, r.id));
    const staff = await makeStaff(rig.tenant.id, "aurora");
    expect(staff.id).toBeTruthy();
    const caja = await loginTenant("aurora", "staff@aurora.test");
    const code = won.body.coupon.code as string;

    const look = await request(app).get(`/tenant/coupons/by-code/${code}`).set(caja.h);
    expect(look.status).toBe(200);
    expect(look.body).toMatchObject({ status: "PENDING", rewardTitle: "Café gratis" });
    const done = await request(app).post(`/tenant/coupons/by-code/${code}/redeem`).set(caja.h);
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("REDEEMED");
    expect((await request(app).post(`/tenant/coupons/by-code/${code}/redeem`).set(caja.h)).status).toBe(409);
  });

  it("sin stock limitado no descuenta nada", async () => {
    const rig = await setup();
    const r = await reward(rig.tenant.id, { stock: null });
    await claim(await prize(rig, r.id));
    expect((await prisma.reward.findUniqueOrThrow({ where: { id: r.id } })).stock).toBeNull();
  });
});

describe("existencias", () => {
  it("con la última unidad solo gana uno, aunque lleguen juntos", async () => {
    const rig = await setup();
    const r = await reward(rig.tenant.id, { stock: 1 });
    const other = await prisma.consumer.create({ data: { email: "otro@example.com" } });
    const otherAuth = { Authorization: `Bearer ${await signConsumerToken(other.id)}` };
    const [a, b] = await Promise.all([claim(await prize(rig, r.id)), claim(await prize(rig, r.id), otherAuth)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const lost = a.status === 409 ? a : b;
    expect(lost.body.error.code).toBe("reward_sold_out");
    expect((await prisma.reward.findUniqueOrThrow({ where: { id: r.id } })).stock).toBe(0);
    expect(await prisma.coupon.count()).toBe(1);
    expect(await prisma.qrClaim.count()).toBe(1); // el intento fallido se deshizo por completo
  });

  it("una recompensa agotada no consume el QR ni deja rastro", async () => {
    const rig = await setup();
    const r = await reward(rig.tenant.id, { stock: 0 });
    const res = await claim(await prize(rig, r.id));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("reward_sold_out");
    expect(await prisma.qrClaim.count()).toBe(0);
    expect(await prisma.coupon.count()).toBe(0);
  });
});

describe("recompensas que no se pueden entregar", () => {
  it("inactiva: 409 reward_unavailable", async () => {
    const rig = await setup();
    const r = await reward(rig.tenant.id, { isActive: false });
    const res = await claim(await prize(rig, r.id));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("reward_unavailable");
  });

  it("borrada, inexistente o de OTRO negocio: se rechaza como QR no válido", async () => {
    const a = await setup({ slug: "aurora" });
    const b = await setup({ slug: "pixel" });
    const deleted = await reward(a.tenant.id, { deletedAt: new Date() });
    const foreign = await reward(b.tenant.id, { title: "Premio de otro negocio" });
    for (const id of [deleted.id, randomUUID(), foreign.id]) {
      const res = await claim(await prize(a, id));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("qr_invalid");
    }
    expect(await prisma.coupon.count()).toBe(0);
    expect((await prisma.reward.findUniqueOrThrow({ where: { id: foreign.id } })).stock).toBeNull();
  });

  it("reward_id con formato inválido", async () => {
    const rig = await setup();
    expect((await claim(await prize(rig, "no-es-un-uuid"))).status).toBe(400);
  });
});

describe("las mismas defensas que el QR de puntos", () => {
  it("no se puede repetir, ni con peticiones simultáneas", async () => {
    const rig = await setup();
    const r = await reward(rig.tenant.id, { stock: 10 });
    const token = await prize(rig, r.id);
    const results = await Promise.all([claim(token), claim(token), claim(token)]);
    expect(results.map((x) => x.status).sort()).toEqual([201, 409, 409]);
    expect(await prisma.coupon.count()).toBe(1);
    expect((await prisma.reward.findUniqueOrThrow({ where: { id: r.id } })).stock).toBe(9);
  });

  it("respeta max_games_per_day", async () => {
    const rig = await setup();
    await prisma.tenant.update({ where: { id: rig.tenant.id }, data: { maxGamesPerDay: 1 } });
    const r = await reward(rig.tenant.id);
    expect((await claim(await prize(rig, r.id))).status).toBe(201);
    const second = await claim(await prize(rig, r.id));
    expect(second.status).toBe(429);
    expect(await prisma.coupon.count()).toBe(1);
  });

  it("una máquina revocada no entrega premios", async () => {
    const rig = await setup();
    const r = await reward(rig.tenant.id);
    await prisma.machine.update({ where: { id: rig.machine.id }, data: { status: "REVOKED", revokedAt: new Date() } });
    expect((await claim(await prize(rig, r.id))).status).toBe(403);
    expect(await prisma.coupon.count()).toBe(0);
  });

  it("un reward_id alterado sin volver a firmar se rechaza", async () => {
    const rig = await setup();
    const cheap = await reward(rig.tenant.id, { title: "Barato" });
    const dear = await reward(rig.tenant.id, { title: "Caro" });
    const [h, p, s] = (await prize(rig, cheap.id)).split(".");
    const forged = JSON.parse(Buffer.from(p!, "base64url").toString());
    forged.reward_id = dear.id;
    const res = await claim(`${h}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${s}`);
    expect(res.status).toBe(400);
    expect(await prisma.coupon.count()).toBe(0);
  });
});

describe("GET /public/stores/:id/rewards", () => {
  it("lista solo lo que puede ganar la ruleta", async () => {
    const rig = await setup();
    await reward(rig.tenant.id, { title: "Ilimitada", stock: null });
    await reward(rig.tenant.id, { title: "Con existencias", stock: 4 });
    await reward(rig.tenant.id, { title: "Agotada", stock: 0 });
    await reward(rig.tenant.id, { title: "Oculta", isActive: false });
    await reward(rig.tenant.id, { title: "Borrada", deletedAt: new Date() });
    const other = await setup({ slug: "pixel" });
    await reward(other.tenant.id, { title: "De otro negocio" });

    const res = await request(app).get(`/public/stores/${rig.store.id}/rewards`);
    expect(res.status).toBe(200);
    expect((res.body.data as { title: string }[]).map((x) => x.title)).toEqual(["Ilimitada", "Con existencias"]);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(["description", "id", "imageUrl", "pointsCost", "title"]);
  });

  it("404 si la sucursal no existe, está inactiva o el negocio está suspendido", async () => {
    const rig = await setup();
    expect((await request(app).get(`/public/stores/${randomUUID()}/rewards`)).status).toBe(404);
    expect((await request(app).get("/public/stores/no-uuid/rewards")).status).toBe(400);
    await prisma.store.update({ where: { id: rig.store.id }, data: { isActive: false } });
    expect((await request(app).get(`/public/stores/${rig.store.id}/rewards`)).status).toBe(404);
    await prisma.store.update({ where: { id: rig.store.id }, data: { isActive: true } });
    await prisma.tenant.update({ where: { id: rig.tenant.id }, data: { status: "SUSPENDED" } });
    expect((await request(app).get(`/public/stores/${rig.store.id}/rewards`)).status).toBe(404);
  });
});
