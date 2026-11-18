import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, loginTenant, prisma, resetDb } from "./helpers.js";
import { setup } from "./qr-helpers.js";

beforeEach(resetDb);

// Zócalo de CDMX como punto de consulta.
const HERE = { lat: 19.4326, lng: -99.1332 };
const near = (q: Partial<Record<"lat" | "lng" | "radius", number>> = {}) =>
  request(app).get("/public/stores/nearby").query({ ...HERE, ...q });

async function place(slug: string, lat: number | null, lng: number | null, extra: Record<string, unknown> = {}) {
  const rig = await setup({ slug });
  await prisma.store.update({ where: { id: rig.store.id }, data: { latitude: lat, longitude: lng, ...extra } });
  return rig;
}

describe("GET /public/stores/nearby", () => {
  it("ordena por distancia y limita por radio", async () => {
    await place("lejos", 19.5, -99.2); // ~10 km
    await place("cerca", 19.434, -99.134); // ~0.2 km
    await place("fuera", 20.5, -100.5); // >100 km
    const res = await near({ radius: 15 });
    expect(res.status).toBe(200);
    expect(res.body.data.map((x: { name: string }) => x.name.toLowerCase())).toHaveLength(2);
    expect(res.body.data[0].distanceKm).toBeLessThan(res.body.data[1].distanceKm);
    expect(res.body.data[0].distanceKm).toBeLessThan(1);
  });

  it("oculta sucursales inactivas, sin ubicación, no listadas y negocios suspendidos o vencidos", async () => {
    await place("ok", 19.434, -99.134);
    await place("inactiva", 19.434, -99.134, { isActive: false });
    await place("sin-coords", null, null);
    await place("oculta", 19.434, -99.134, { listedNearby: false });
    const sus = await place("suspendido", 19.434, -99.134);
    await prisma.tenant.update({ where: { id: sus.tenant.id }, data: { status: "SUSPENDED" } });
    const exp = await place("vencido", 19.434, -99.134);
    await prisma.tenant.update({ where: { id: exp.tenant.id }, data: { subscriptionEndsAt: new Date(Date.now() - 1000) } });
    const res = await near();
    expect(res.body.data).toHaveLength(1);
  });

  it("incluye premios destacados (máximo 3, los más baratos) y no expone datos internos", async () => {
    const rig = await place("ok", 19.434, -99.134);
    for (const [title, pointsCost] of [["A", 400], ["B", 100], ["C", 300], ["D", 200]] as const) {
      await prisma.reward.create({ data: { tenantId: rig.tenant.id, title, pointsCost } });
    }
    await prisma.reward.create({ data: { tenantId: rig.tenant.id, title: "Oculto", pointsCost: 1, isActive: false } });
    const item = (await near()).body.data[0];
    expect(item.rewards.map((r: { title: string }) => r.title)).toEqual(["B", "D", "C"]);
    expect(Object.keys(item).sort()).toEqual(["address", "distanceKm", "logoUrl", "name", "primaryColor", "rewards", "storeId", "storeName", "tenantId"]);
  });

  it("valida parámetros y respeta el tope de resultados", async () => {
    expect((await request(app).get("/public/stores/nearby")).status).toBe(400);
    expect((await near({ lat: 91 })).status).toBe(400);
    expect((await near({ radius: 500 })).status).toBe(400);
    for (let i = 0; i < 22; i++) await place(`n${i}`, 19.434 + i * 0.0001, -99.134);
    expect((await near()).body.data).toHaveLength(20);
  });
});

describe("Ubicación de la sucursal en el panel", () => {
  it("guarda coordenadas juntas y rechaza una sola", async () => {
    const rig = await setup({ slug: "aurora" });
    const a = await loginTenant("aurora");
    const url = `/tenant/stores/${rig.store.id}`;
    const ok = await request(app).patch(url).set(a.h).send({ latitude: 19.4, longitude: -99.1, listedNearby: false });
    expect(ok.status).toBe(200);
    expect(ok.body.listedNearby).toBe(false);
    expect((await request(app).patch(url).set(a.h).send({ latitude: 19.4 })).status).toBe(400);
    expect((await request(app).patch(url).set(a.h).send({ latitude: 120, longitude: 0 })).status).toBe(400);
    expect((await request(app).patch(url).set(a.h).send({ latitude: null, longitude: null })).status).toBe(200);
  });
});
