import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { retention, roi } from "../src/modules/tenant/analytics.service.js";
import { app, loginTenant, prisma, resetDb } from "./helpers.js";
import { setup } from "./qr-helpers.js";

const TODAY = "2026-11-17";
beforeEach(resetDb);

async function customer() {
  return (await prisma.consumer.create({ data: { isGuest: true } })).id;
}
/** Una acreditación a las 12:00 hora de México (18:00 UTC), o a la hora UTC indicada. */
async function visit(rig: Awaited<ReturnType<typeof setup>>, consumerId: string, day: string, hourUtc = 18) {
  await prisma.qrClaim.create({
    data: {
      jti: randomUUID().replaceAll("-", ""),
      tenantId: rig.tenant.id,
      machineId: rig.machine.id,
      consumerId,
      score: 100,
      pointsAwarded: 10,
      qrIssuedAt: new Date(`${day}T${String(hourUtc).padStart(2, "0")}:00:00Z`),
      createdAt: new Date(`${day}T${String(hourUtc).padStart(2, "0")}:00:00Z`),
    },
  });
}

/** Cohorte de 7 días: c1 vuelve a los 5 días, c2 nunca, c3 juega dos veces el mismo día, c4 vuelve a los 8. */
async function scenario(rig: Awaited<ReturnType<typeof setup>>) {
  const [c1, c2, c3, c4, c5, c6] = await Promise.all([customer(), customer(), customer(), customer(), customer(), customer()]);
  await visit(rig, c1, "2026-11-04");
  await visit(rig, c1, "2026-11-09");
  await visit(rig, c2, "2026-11-05");
  await visit(rig, c3, "2026-11-06", 18);
  await visit(rig, c3, "2026-11-06", 19);
  await visit(rig, c4, "2026-11-04");
  await visit(rig, c4, "2026-11-12");
  await visit(rig, c5, "2026-10-01");
  await visit(rig, c5, "2026-10-20");
  await visit(rig, c6, "2026-10-02");
  return { c1, c2, c3, c4, c5, c6 };
}

describe("Retención", () => {
  it("cuenta nuevos, recurrentes y retorno a 7 y 30 días con casos de borde", async () => {
    const rig = await setup();
    await scenario(rig);
    const r = await retention(prisma, rig.tenant.id, "2026-11-01", "2026-11-17", TODAY);
    expect(r.newCustomers).toBe(4);
    expect(r.returningCustomers).toBe(2); // c1 y c4; c3 jugó dos veces el mismo día = una visita
    expect(r.return7).toBe(25); // cohorte c1,c2,c3,c4: solo c1 volvió en ≤7 días
    expect(r.return30).toBe(50); // cohorte c5,c6: solo c5 volvió en ≤30 días
  });

  it("agrupa visitas por día local y por hora local", async () => {
    const rig = await setup();
    await scenario(rig);
    const r = await retention(prisma, rig.tenant.id, "2026-11-01", "2026-11-17", TODAY);
    expect(r.visitsByDay.find((d) => d.date === "2026-11-06")?.visits).toBe(1);
    expect(r.visitsByDay.find((d) => d.date === "2026-11-04")?.visits).toBe(2);
    expect(r.visitsByHour.find((h) => h.hour === 12)?.visits).toBe(6); // 18:00 UTC = 12:00 en México
    expect(r.visitsByHour.find((h) => h.hour === 18)).toBeUndefined();
    expect(r.visitsByHour.find((h) => h.hour === 13)?.visits).toBe(1);
  });

  it("sin clientes en la cohorte, el retorno es null y no 0", async () => {
    const rig = await setup();
    const r = await retention(prisma, rig.tenant.id, "2026-11-01", "2026-11-17", TODAY);
    expect(r).toMatchObject({ newCustomers: 0, returningCustomers: 0, return7: null, return30: null });
  });

  it("no mezcla negocios", async () => {
    const a = await setup({ slug: "uno" });
    const b = await setup({ slug: "dos" });
    await scenario(a);
    const r = await retention(prisma, b.tenant.id, "2026-11-01", "2026-11-17", TODAY);
    expect(r.newCustomers).toBe(0);
    expect(r.visitsByDay).toEqual([]);
  });
});

describe("ROI", () => {
  async function redeem(rig: Awaited<ReturnType<typeof setup>>, consumerId: string, unitCost: number | null, day: string) {
    const reward = await prisma.reward.create({ data: { tenantId: rig.tenant.id, title: "Café", pointsCost: 10, unitCost } });
    const wallet = await prisma.wallet.upsert({
      where: { tenantId_consumerId: { tenantId: rig.tenant.id, consumerId } },
      update: {},
      create: { tenantId: rig.tenant.id, consumerId },
    });
    await prisma.coupon.create({
      data: {
        tenantId: rig.tenant.id, walletId: wallet.id, rewardId: reward.id, rewardTitle: "Café", pointsCost: 10,
        code: randomUUID().slice(0, 8), status: "REDEEMED", expiresAt: new Date(`${day}T23:00:00Z`), redeemedAt: new Date(`${day}T18:00:00Z`),
      },
    });
  }

  it("estima ingreso con clientes recurrentes y calcula el ROI", async () => {
    const rig = await setup();
    const c = await scenario(rig);
    await redeem(rig, c.c1, 20, "2026-11-10");
    await redeem(rig, c.c4, 20, "2026-11-13");
    const r = await roi(prisma, rig.tenant.id, 50, "2026-11-01", "2026-11-17");
    expect(r).toMatchObject({ programCost: 40, attributedRevenue: 200, roi: 4, missing: [], estimated: true });
  });

  it("dice qué falta en vez de inventar un número", async () => {
    const rig = await setup();
    const c = await scenario(rig);
    await redeem(rig, c.c1, null, "2026-11-10");
    const noTicket = await roi(prisma, rig.tenant.id, null, "2026-11-01", "2026-11-17");
    expect(noTicket.roi).toBeNull();
    expect(noTicket.missing).toEqual(["avgTicket", "unitCost"]);
  });

  it("sin premios canjeados no hay ROI (costo 0)", async () => {
    const rig = await setup();
    await scenario(rig);
    expect((await roi(prisma, rig.tenant.id, 50, "2026-11-01", "2026-11-17")).roi).toBeNull();
  });
});

describe("Rutas de analítica y planes", () => {
  async function as(plan: "TRIAL" | "BASIC" | "PRO", slug = "aurora") {
    const rig = await setup({ slug });
    await prisma.tenant.update({ where: { id: rig.tenant.id }, data: { plan } });
    return { rig, ...(await loginTenant(slug)) };
  }

  it("retención de 30 días está en todos los planes", async () => {
    const t = await as("TRIAL");
    const res = await request(app).get("/tenant/analytics/retention").set(t.h);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("visitsByDay");
  });

  it("un rango mayor a 30 días exige PRO", async () => {
    const basic = await as("BASIC");
    const q = "?from=2026-01-01&to=2026-03-01";
    const res = await request(app).get(`/tenant/analytics/retention${q}`).set(basic.h);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("plan_limit");
    await resetDb();
    const pro = await as("PRO");
    expect((await request(app).get(`/tenant/analytics/retention${q}`).set(pro.h)).status).toBe(200);
  });

  it("rechaza rangos mayores a 365 días o fechas malas", async () => {
    const pro = await as("PRO");
    const big = await request(app).get("/tenant/analytics/retention?from=2020-01-01&to=2026-01-01").set(pro.h);
    expect(big.status).toBe(400);
    expect((await request(app).get("/tenant/analytics/retention?from=ayer").set(pro.h)).status).toBe(400);
  });

  it("ROI no está en TRIAL y sí en BASIC", async () => {
    const trial = await as("TRIAL");
    const res = await request(app).get("/tenant/analytics/roi").set(trial.h);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("plan_limit");
    await resetDb();
    const basic = await as("BASIC");
    const ok = await request(app).get("/tenant/analytics/roi").set(basic.h);
    expect(ok.status).toBe(200);
    expect(ok.body.missing).toContain("avgTicket");
  });

  it("el negocio no ve datos de otro aunque pida sus fechas", async () => {
    const a = await as("PRO", "uno");
    const b = await as("PRO", "dos");
    await scenario(a.rig);
    const res = await request(app).get("/tenant/analytics/retention?from=2026-11-01&to=2026-11-17").set(b.h);
    expect(res.body.newCustomers).toBe(0);
    const own = await request(app).get("/tenant/analytics/retention?from=2026-11-01&to=2026-11-17").set(a.h);
    expect(own.body.newCustomers).toBe(4);
  });

  it("el ticket promedio y el costo del premio se guardan desde el panel", async () => {
    const t = await as("BASIC");
    expect((await request(app).patch("/tenant/economy").set(t.h).send({ avgTicket: 85 })).body.avgTicket).toBe(85);
    const rw = await request(app).post("/tenant/rewards").set(t.h).send({ title: "Café", pointsCost: 50, unitCost: 18 });
    expect(rw.body.unitCost).toBe(18);
    expect((await request(app).patch("/tenant/economy").set(t.h).send({ avgTicket: -1 })).status).toBe(400);
  });
});
