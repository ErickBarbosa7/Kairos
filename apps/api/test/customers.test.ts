import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, loginTenant, makeStaff, makeTenant, prisma, resetDb } from "./helpers.js";

beforeEach(resetDb);

async function customer(tenantId: string, name: string, balance: number, email: string | null = null) {
  const consumer = await prisma.consumer.create({ data: { displayName: name, email, isGuest: email === null } });
  return prisma.wallet.create({ data: { tenantId, consumerId: consumer.id, balance, lifetimeEarned: balance } });
}

async function rig() {
  const A = await makeTenant("a");
  const B = await makeTenant("b");
  return { A, B, a: await loginTenant("a") };
}

describe("Clientes", () => {
  it("lista, busca y no mezcla negocios", async () => {
    const { A, B, a } = await rig();
    await customer(A.tenant.id, "Ana", 10, "ana@x.com");
    await customer(A.tenant.id, "Beto", 20);
    await customer(B.tenant.id, "Ajena", 99, "ajena@x.com");

    const all = await request(app).get("/tenant/customers").set(a.h);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(2);
    expect(all.body.data.map((w: { consumer: { displayName: string } }) => w.consumer.displayName).sort()).toEqual(["Ana", "Beto"]);

    const found = await request(app).get("/tenant/customers?q=ANA@").set(a.h);
    expect(found.body.data).toHaveLength(1);
    expect(found.body.data[0].consumer.displayName).toBe("Ana");
    expect(Object.keys(found.body.data[0].consumer).sort()).toEqual(["createdAt", "displayName", "email", "id", "isGuest"]);
  });

  it("detalle propio sí; de otro negocio 404", async () => {
    const { A, B, a } = await rig();
    const mine = await customer(A.tenant.id, "Ana", 10, "ana@x.com");
    const theirs = await customer(B.tenant.id, "Ajena", 5, "ajena@x.com");
    const ok = await request(app).get(`/tenant/customers/${mine.id}`).set(a.h);
    expect(ok.status).toBe(200);
    expect(ok.body.balance).toBe(10);
    expect((await request(app).get(`/tenant/customers/${theirs.id}`).set(a.h)).status).toBe(404);
    expect((await request(app).post(`/tenant/customers/${theirs.id}/adjust`).set(a.h).send({ points: 5, note: "intento" })).status).toBe(404);
    expect((await prisma.wallet.findUniqueOrThrow({ where: { id: theirs.id } })).balance).toBe(5);
  });

  it("ajuste suma y resta con movimiento ADJUST y auditoría", async () => {
    const { A, a } = await rig();
    const w = await customer(A.tenant.id, "Ana", 10, "ana@x.com");
    const plus = await request(app).post(`/tenant/customers/${w.id}/adjust`).set(a.h).send({ points: 15, note: "Cortesía" });
    expect(plus.status).toBe(201);
    expect(plus.body.balance).toBe(25);
    const minus = await request(app).post(`/tenant/customers/${w.id}/adjust`).set(a.h).send({ points: -5, note: "Error de captura" });
    expect(minus.body.balance).toBe(20);

    const detail = await request(app).get(`/tenant/customers/${w.id}`).set(a.h);
    expect(detail.body.transactions.map((t: { type: string; points: number }) => [t.type, t.points])).toEqual([["ADJUST", -5], ["ADJUST", 15]]);
    expect(detail.body.lifetimeEarned).toBe(10);
    expect(await prisma.auditLog.count({ where: { action: "customer.points_adjust" } })).toBe(2);
  });

  it("rechaza saldo negativo, cero y nota vacía", async () => {
    const { A, a } = await rig();
    const w = await customer(A.tenant.id, "Ana", 10, "ana@x.com");
    const url = `/tenant/customers/${w.id}/adjust`;
    const neg = await request(app).post(url).set(a.h).send({ points: -11, note: "demasiado" });
    expect(neg.status).toBe(422);
    expect(neg.body.error.code).toBe("insufficient_points");
    expect((await request(app).post(url).set(a.h).send({ points: 0, note: "nada" })).status).toBe(400);
    expect((await request(app).post(url).set(a.h).send({ points: 1, note: " " })).status).toBe(400);
    expect((await prisma.wallet.findUniqueOrThrow({ where: { id: w.id } })).balance).toBe(10);
  });

  it("staff puede ver pero no ajustar", async () => {
    const { A } = await rig();
    const w = await customer(A.tenant.id, "Ana", 10, "ana@x.com");
    const staff = await makeStaff(A.tenant.id, "a");
    const s = await loginTenant("a", staff.email);
    expect((await request(app).get("/tenant/customers").set(s.h)).status).toBe(200);
    expect((await request(app).post(`/tenant/customers/${w.id}/adjust`).set(s.h).send({ points: 5, note: "no debe" })).status).toBe(403);
  });
});
