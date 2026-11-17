import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { isRunning } from "../src/modules/tenant/campaigns.service.js";
import { buildWeeklyReport, generateWeeklyReports, judge, lastWeekStart } from "../src/modules/tenant/weekly.service.js";
import { app, loginTenant, prisma, resetDb } from "./helpers.js";
import { qr, setup, type Rig } from "./qr-helpers.js";

beforeEach(async () => {
  await resetDb();
  env.PRIZE_UNLOCK_HOURS = 0;
});

const guest = async () => {
  const res = await request(app).post("/wallet/guest");
  return { id: res.body.consumerId as string, h: { Authorization: `Bearer ${res.body.token}` } };
};
const claim = async (rig: Rig, h: Record<string, string>, extra: Record<string, unknown> = {}) =>
  request(app).post("/wallet/claims").set(h).send({ qr: await qr(rig, { score: 1000, ...extra }) });
async function asPlan(plan: "TRIAL" | "BASIC" | "PRO", slug = "aurora") {
  const rig = await setup({ slug });
  await prisma.tenant.update({ where: { id: rig.tenant.id }, data: { plan, scorePerPoint: 10, maxPointsPerGame: 50 } });
  return { rig, ...(await loginTenant(slug)) };
}
const mult = (over: Record<string, unknown> = {}) => ({ name: "Doble", type: "MULTIPLIER", multiplierPct: 200, ...over });

describe("isRunning (hora de México = UTC-6)", () => {
  const base = { isActive: true, startsAt: null, endsAt: null, weekdays: [] as number[], startHour: null, endHour: null };
  it("respeta horario, día y vigencia", () => {
    const lunes12 = new Date("2026-11-16T18:00:00Z"); // lunes 12:00 local
    expect(isRunning(base, lunes12)).toBe(true);
    expect(isRunning({ ...base, startHour: 14, endHour: 17 }, lunes12)).toBe(false);
    expect(isRunning({ ...base, startHour: 12, endHour: 13 }, lunes12)).toBe(true);
    expect(isRunning({ ...base, startHour: 11, endHour: 12 }, lunes12)).toBe(false); // fin exclusivo
    expect(isRunning({ ...base, weekdays: [1] }, lunes12)).toBe(true);
    expect(isRunning({ ...base, weekdays: [0, 6] }, lunes12)).toBe(false);
    expect(isRunning({ ...base, endsAt: new Date("2026-11-16T17:00:00Z") }, lunes12)).toBe(false);
    expect(isRunning({ ...base, isActive: false }, lunes12)).toBe(false);
  });
});

describe("Campañas: CRUD y planes", () => {
  it("TRIAL no puede activar campañas; BASIC 1; PRO 5", async () => {
    const trial = await asPlan("TRIAL");
    const res = await request(app).post("/tenant/campaigns").set(trial.h).send(mult());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("plan_limit");
    await resetDb();
    const basic = await asPlan("BASIC");
    expect((await request(app).post("/tenant/campaigns").set(basic.h).send(mult())).status).toBe(201);
    const second = await request(app).post("/tenant/campaigns").set(basic.h).send(mult({ name: "Otra" }));
    expect(second.status).toBe(403);
    // Una inactiva sí se puede guardar, pero no reactivar por encima del límite.
    const draft = await request(app).post("/tenant/campaigns").set(basic.h).send(mult({ name: "Borrador", isActive: false }));
    expect(draft.status).toBe(201);
    expect((await request(app).patch(`/tenant/campaigns/${draft.body.id}`).set(basic.h).send({ isActive: true })).status).toBe(403);
  });

  it("valida los campos de cada tipo y los horarios", async () => {
    const t = await asPlan("PRO");
    const post = (b: object) => request(app).post("/tenant/campaigns").set(t.h).send(b);
    expect((await post({ name: "X1", type: "MULTIPLIER" })).status).toBe(400); // sin multiplierPct
    expect((await post(mult({ multiplierPct: 100 }))).status).toBe(400); // debe ser > ×1
    expect((await post(mult({ startHour: 17, endHour: 14 }))).status).toBe(400);
    expect((await post(mult({ startHour: 14 }))).status).toBe(400);
    expect((await post({ name: "Bono", type: "FIRST_VISIT_BONUS", bonusPoints: 20 })).status).toBe(201);
    expect((await post({ name: "Vuelve", type: "COMEBACK_UNLOCK", unlockHours: 12 })).status).toBe(201);
  });

  it("un negocio no ve ni toca campañas de otro", async () => {
    const a = await asPlan("PRO", "uno");
    const b = await asPlan("PRO", "dos");
    const c = await request(app).post("/tenant/campaigns").set(a.h).send(mult());
    expect((await request(app).get("/tenant/campaigns").set(b.h)).body.data).toEqual([]);
    expect((await request(app).patch(`/tenant/campaigns/${c.body.id}`).set(b.h).send({ isActive: false })).status).toBe(404);
    expect((await request(app).delete(`/tenant/campaigns/${c.body.id}`).set(b.h)).status).toBe(404);
    expect((await request(app).delete(`/tenant/campaigns/${c.body.id}`).set(a.h)).status).toBe(204);
  });

  it("el personal de caja no puede crear campañas", async () => {
    const t = await asPlan("PRO");
    await prisma.tenantUser.update({ where: { tenantId_email: { tenantId: t.rig.tenant.id, email: "owner@aurora.test" } }, data: { role: "TENANT_STAFF" } });
    const staff = await loginTenant("aurora");
    expect((await request(app).post("/tenant/campaigns").set(staff.h).send(mult())).status).toBe(403);
  });
});

describe("Campañas en la acreditación", () => {
  it("multiplicador dentro de horario suma el doble y respeta el tope; fuera de horario no cambia nada", async () => {
    const t = await asPlan("PRO");
    await request(app).post("/tenant/campaigns").set(t.h).send(mult());
    const g = await guest();
    const res = await claim(t.rig, g.h); // 1000 / 10 = 100 → ×2 = 200 → tope 50
    expect(res.body.pointsAwarded).toBe(50);
    const tx = await prisma.pointTransaction.findFirstOrThrow({ where: { qrClaimId: res.body.claimId } });
    expect(tx.note).toBe("Campaña: Doble");

    await prisma.tenant.update({ where: { id: t.rig.tenant.id }, data: { maxPointsPerGame: 500 } });
    const g2 = await guest();
    expect((await claim(t.rig, g2.h)).body.pointsAwarded).toBe(200);

    await prisma.campaign.updateMany({ data: { startHour: 0, endHour: 1 } });
    await prisma.campaign.updateMany({ data: { weekdays: [(new Date().getUTCDay() + 3) % 7] } });
    const g3 = await guest();
    expect((await claim(t.rig, g3.h)).body.pointsAwarded).toBe(100);
  });

  it("bono de primera visita solo en la primera", async () => {
    const t = await asPlan("PRO");
    await request(app).post("/tenant/campaigns").set(t.h).send({ name: "Bienvenida", type: "FIRST_VISIT_BONUS", bonusPoints: 25 });
    const g = await guest();
    expect((await claim(t.rig, g.h)).body.pointsAwarded).toBe(75); // tope 50 + 25 de bono
    expect((await claim(t.rig, g.h)).body.pointsAwarded).toBe(50);
  });

  it("un multiplicador pausado no se aplica y los puntos no cambian", async () => {
    const t = await asPlan("PRO");
    const c = await request(app).post("/tenant/campaigns").set(t.h).send(mult({ isActive: false }));
    expect(c.status).toBe(201);
    const g = await guest();
    expect((await claim(t.rig, g.h)).body.pointsAwarded).toBe(50);
  });

  it("desbloqueo de regreso cambia la espera del premio de la ruleta", async () => {
    const t = await asPlan("PRO");
    const reward = await prisma.reward.create({ data: { tenantId: t.rig.tenant.id, title: "Café", pointsCost: 100 } });
    await request(app).post("/tenant/campaigns").set(t.h).send({ name: "Vuelve", type: "COMEBACK_UNLOCK", unlockHours: 24 });
    const g = await guest();
    const res = await claim(t.rig, g.h, { reward_id: reward.id });
    expect(res.status).toBe(201);
    const wait = new Date(res.body.coupon.validFrom).getTime() - Date.now();
    expect(wait).toBeGreaterThan(23.9 * 3_600_000);
    expect(wait).toBeLessThan(24.1 * 3_600_000);
  });
});

describe("Resumen semanal", () => {
  it("lastWeekStart devuelve el lunes de la semana ya terminada", () => {
    expect(lastWeekStart("2026-11-17")).toBe("2026-11-09"); // martes → semana del lunes 9
    expect(lastWeekStart("2026-11-16")).toBe("2026-11-09"); // lunes
    expect(lastWeekStart("2026-11-15")).toBe("2026-11-02"); // domingo: la semana en curso aún es la del 9
  });

  it("las reglas se aplican en orden", () => {
    const hours = [{ hour: 9, visits: 30 }, { hour: 15, visits: 5 }];
    expect(judge({ roi: -0.5, return7: 5, visitsByHour: hours, weekVisits: 10 }).headline).toMatch(/cuesta más/);
    expect(judge({ roi: null, return7: 10, visitsByHour: hours, weekVisits: 10 }).headline).toMatch(/no vuelven/);
    expect(judge({ roi: null, return7: 50, visitsByHour: hours, weekVisits: 10 }).recommendation).toMatch(/15:00/);
    expect(judge({ roi: 2, return7: 50, visitsByHour: [{ hour: 9, visits: 5 }, { hour: 10, visits: 4 }], weekVisits: 9 }).headline).toBe("Programa estable");
    expect(judge({ roi: null, return7: null, visitsByHour: [], weekVisits: 0 }).headline).toBe("Semana sin visitas");
  });

  it("genera un resumen por negocio PRO y es idempotente", async () => {
    const pro = await asPlan("PRO", "uno");
    await asPlan("BASIC", "dos");
    expect(await generateWeeklyReports(prisma, "2026-11-17")).toBe(1);
    expect(await generateWeeklyReports(prisma, "2026-11-17")).toBe(0);
    const row = await prisma.weeklyReport.findFirstOrThrow({ where: { tenantId: pro.rig.tenant.id } });
    expect(row.weekStart.toISOString().slice(0, 10)).toBe("2026-11-09");
    expect(row.headline).toBe("Semana sin visitas");
    await buildWeeklyReport(prisma, pro.rig.tenant.id, "2026-11-17");
    expect(await prisma.weeklyReport.count()).toBe(1);
  });

  it("solo PRO consulta y refresca el resumen", async () => {
    const basic = await asPlan("BASIC");
    const res = await request(app).get("/tenant/analytics/weekly").set(basic.h);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("plan_limit");
    await resetDb();
    const pro = await asPlan("PRO");
    expect((await request(app).get("/tenant/analytics/weekly").set(pro.h)).body).toBeNull();
    const made = await request(app).post("/tenant/analytics/weekly/refresh").set(pro.h);
    expect(made.status).toBe(200);
    expect((await request(app).get("/tenant/analytics/weekly").set(pro.h)).body.headline).toBe(made.body.headline);
  });
});
