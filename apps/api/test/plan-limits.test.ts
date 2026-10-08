import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, keyPair, loginTenant, makeTenant, prisma, resetDb } from "./helpers.js";

beforeEach(resetDb);

async function business(plan: "TRIAL" | "BASIC" | "PRO") {
  const { tenant } = await makeTenant("negocio");
  await prisma.tenant.update({ where: { id: tenant.id }, data: { plan } });
  const { h } = await loginTenant("negocio");
  return { tenant, h };
}

const newStore = (h: Record<string, string>, name = "Centro") => request(app).post("/tenant/stores").set(h).send({ name });
const newMachine = (h: Record<string, string>, storeId: string, label = "Mostrador") =>
  request(app).post("/tenant/machines").set(h).send({ storeId, label, keyAlgorithm: "ES256", publicKey: keyPair("ec").pub });

describe("GET /public/plans", () => {
  it("publica precios, límites y días de prueba, sin iniciar sesión", async () => {
    const res = await request(app).get("/public/plans");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ currency: "MXN", period: "month", trialDays: 14 });
    expect(res.body.plans).toEqual([
      { key: "TRIAL", priceMonthly: 0, limits: { stores: 1, machines: 1 } },
      { key: "BASIC", priceMonthly: 149, limits: { stores: 2, machines: 2 } },
      { key: "PRO", priceMonthly: 499, limits: { stores: 10, machines: 10 } },
    ]);
  });
});

describe("límite de sucursales", () => {
  it("la prueba permite 1 y rechaza la segunda con un mensaje claro", async () => {
    const { h } = await business("TRIAL");
    expect((await newStore(h)).status).toBe(201);
    const second = await newStore(h, "Otra");
    expect(second.status).toBe(403);
    expect(second.body.error.code).toBe("plan_limit");
    expect(second.body.error.message).toContain("hasta 1 sucursal");
    expect(await prisma.store.count()).toBe(1);
  });

  it("Básico permite 2 y Pro permite más", async () => {
    const basic = await business("BASIC");
    expect((await newStore(basic.h, "Sucursal A")).status).toBe(201);
    expect((await newStore(basic.h, "Sucursal B")).status).toBe(201);
    expect((await newStore(basic.h, "Sucursal C")).status).toBe(403);

    await resetDb();
    const pro = await business("PRO");
    for (let i = 0; i < 10; i++) expect((await newStore(pro.h, `S${i}`)).status).toBe(201);
    expect((await newStore(pro.h, "S10")).status).toBe(403);
  });

  it("subir de plan libera el tope", async () => {
    const { tenant, h } = await business("TRIAL");
    await newStore(h);
    expect((await newStore(h, "Otra")).status).toBe(403);
    await prisma.tenant.update({ where: { id: tenant.id }, data: { plan: "BASIC" } });
    expect((await newStore(h, "Otra")).status).toBe(201);
  });

  it("las sucursales desactivadas no cuentan, pero reactivarlas sí cuenta", async () => {
    const { h } = await business("TRIAL");
    const first = await newStore(h);
    await request(app).patch(`/tenant/stores/${first.body.id}`).set(h).send({ isActive: false });
    const second = await newStore(h, "Nueva");
    expect(second.status).toBe(201);
    const back = await request(app).patch(`/tenant/stores/${first.body.id}`).set(h).send({ isActive: true });
    expect(back.status).toBe(403);
    expect(back.body.error.code).toBe("plan_limit");
  });

  it("un negocio que ya pasaba el tope conserva lo que tiene y solo no puede crear más", async () => {
    const { tenant, h } = await business("PRO");
    for (let i = 0; i < 3; i++) await newStore(h, `S${i}`);
    await prisma.tenant.update({ where: { id: tenant.id }, data: { plan: "TRIAL" } });
    const list = await request(app).get("/tenant/stores").set(h);
    expect(list.body.data).toHaveLength(3);
    expect((await newStore(h, "Más")).status).toBe(403);
  });
});

describe("límite de máquinas", () => {
  it("la prueba permite 1 máquina activa; revocarla libera el lugar", async () => {
    const { h } = await business("TRIAL");
    const store = await newStore(h);
    const first = await newMachine(h, store.body.id);
    expect(first.status).toBe(201);
    const second = await newMachine(h, store.body.id, "Otra");
    expect(second.status).toBe(403);
    expect(second.body.error.code).toBe("plan_limit");
    expect(second.body.error.message).toContain("hasta 1 máquina");

    await request(app).post(`/tenant/machines/${first.body.id}/revoke`).set(h);
    expect((await newMachine(h, store.body.id, "Reemplazo")).status).toBe(201);
    expect(await prisma.machine.count({ where: { status: "ACTIVE" } })).toBe(1);
  });

  it("Básico permite 2 máquinas", async () => {
    const { h } = await business("BASIC");
    const store = await newStore(h);
    expect((await newMachine(h, store.body.id, "Máquina A")).status).toBe(201);
    expect((await newMachine(h, store.body.id, "Máquina B")).status).toBe(201);
    expect((await newMachine(h, store.body.id, "Máquina C")).status).toBe(403);
  });

  it("el límite de máquinas es independiente del de sucursales", async () => {
    const { h } = await business("BASIC");
    const a = await newStore(h, "Sucursal A");
    const b = await newStore(h, "Sucursal B");
    expect((await newMachine(h, a.body.id, "M1")).status).toBe(201);
    expect((await newMachine(h, b.body.id, "M2")).status).toBe(201);
    expect((await newMachine(h, a.body.id, "M3")).status).toBe(403);
  });

  it("los límites de un negocio no afectan a otro", async () => {
    const { h } = await business("TRIAL");
    await newStore(h);
    const { tenant: other } = await makeTenant("otro");
    await prisma.tenant.update({ where: { id: other.id }, data: { plan: "TRIAL" } });
    const otherH = (await loginTenant("otro")).h;
    expect((await newStore(otherH, "Propia")).status).toBe(201);
  });
});

describe("GET /tenant/subscription: límites y uso", () => {
  it("devuelve el tope del plan y lo que lleva usado", async () => {
    const { h } = await business("BASIC");
    const store = await newStore(h);
    await newMachine(h, store.body.id);
    const res = await request(app).get("/tenant/subscription").set(h);
    expect(res.body).toMatchObject({ plan: "BASIC", limits: { stores: 2, machines: 2 }, usage: { stores: 1, machines: 1 } });
  });

  it("sigue disponible aunque la prueba haya vencido", async () => {
    const { tenant, h } = await business("TRIAL");
    await prisma.tenant.update({ where: { id: tenant.id }, data: { subscriptionEndsAt: new Date(Date.now() - 1000) } });
    const res = await request(app).get("/tenant/subscription").set(h);
    expect(res.status).toBe(200);
    expect(res.body.limits).toEqual({ stores: 1, machines: 1 });
  });
});


