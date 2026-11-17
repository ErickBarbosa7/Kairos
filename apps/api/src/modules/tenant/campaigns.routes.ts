import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { notFound } from "../../lib/errors.js";
import { assertCampaignSlot } from "../../lib/plans.js";
import { tenantAdminOnly } from "../../middleware/tenant.js";

const idParam = z.object({ id: z.uuid() });
const hour = z.number().int();
const base = z.object({
  name: z.string().trim().min(2).max(60),
  type: z.enum(["MULTIPLIER", "FIRST_VISIT_BONUS", "COMEBACK_UNLOCK"]),
  isActive: z.boolean().default(true),
  multiplierPct: z.number().int().min(101).max(500).nullable().default(null),
  bonusPoints: z.number().int().min(1).max(100_000).nullable().default(null),
  unlockHours: z.number().int().min(0).max(720).nullable().default(null),
  startsAt: z.coerce.date().nullable().default(null),
  endsAt: z.coerce.date().nullable().default(null),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  startHour: hour.min(0).max(23).nullable().default(null),
  endHour: hour.min(1).max(24).nullable().default(null),
});

/** Cada tipo exige su propio campo; los demás se descartan. */
const shape = base.strict().superRefine((c, ctx) => {
  const need = { MULTIPLIER: "multiplierPct", FIRST_VISIT_BONUS: "bonusPoints", COMEBACK_UNLOCK: "unlockHours" } as const;
  if (c[need[c.type]] === null) ctx.addIssue({ code: "custom", path: [need[c.type]], message: "Obligatorio para este tipo de campaña" });
  if ((c.startHour === null) !== (c.endHour === null)) ctx.addIssue({ code: "custom", path: ["endHour"], message: "Indica hora de inicio y de fin" });
  if (c.startHour !== null && c.endHour !== null && c.startHour >= c.endHour) ctx.addIssue({ code: "custom", path: ["endHour"], message: "La hora de fin debe ser mayor" });
  if (c.startsAt && c.endsAt && c.startsAt >= c.endsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "El fin debe ser posterior al inicio" });
});

function clean<T extends z.infer<typeof base>>(c: T) {
  return {
    ...c,
    multiplierPct: c.type === "MULTIPLIER" ? c.multiplierPct : null,
    bonusPoints: c.type === "FIRST_VISIT_BONUS" ? c.bonusPoints : null,
    unlockHours: c.type === "COMEBACK_UNLOCK" ? c.unlockHours : null,
    weekdays: [...new Set(c.weekdays)].sort(),
  };
}

export const campaignsRouter = Router();

campaignsRouter.get("/campaigns", async (req, res) => {
  const [data, tenant] = await Promise.all([
    req.db!.campaign.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.tenant.findUniqueOrThrow({ where: { id: req.auth!.tid! }, select: { plan: true } }),
  ]);
  res.json({ data, plan: tenant.plan });
});

async function planAndActive(req: { db?: any; auth?: { tid?: string } }, excludeId?: string) {
  const tid = req.auth!.tid!;
  const [{ plan }, active] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tid }, select: { plan: true } }),
    req.db!.campaign.count({ where: { isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) } }) as Promise<number>,
  ]);
  return { plan, active };
}

campaignsRouter.post("/campaigns", tenantAdminOnly, async (req, res) => {
  const body = clean(shape.parse(req.body));
  if (body.isActive) {
    const { plan, active } = await planAndActive(req);
    assertCampaignSlot(plan, active);
  }
  res.status(201).json(await req.db!.campaign.create({ data: body as never }));
});

campaignsRouter.patch("/campaigns/:id", tenantAdminOnly, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const e = await req.db!.campaign.findFirst({ where: { id } });
  if (!e) throw notFound("Campaña no encontrada");
  const current = {
    name: e.name, type: e.type, isActive: e.isActive, multiplierPct: e.multiplierPct, bonusPoints: e.bonusPoints,
    unlockHours: e.unlockHours, startsAt: e.startsAt, endsAt: e.endsAt, weekdays: e.weekdays, startHour: e.startHour, endHour: e.endHour,
  };
  const body = clean(shape.parse({ ...current, ...(req.body as object) }));
  // Solo ocupa lugar al activarla: reactivar una campaña pausada respeta el límite del plan.
  if (body.isActive && !e.isActive) {
    const { plan, active } = await planAndActive(req, id);
    assertCampaignSlot(plan, active);
  }
  res.json(await req.db!.campaign.update({ where: { id }, data: body as never }));
});

campaignsRouter.delete("/campaigns/:id", tenantAdminOnly, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const existing = await req.db!.campaign.findFirst({ where: { id } });
  if (!existing) throw notFound("Campaña no encontrada");
  await req.db!.campaign.delete({ where: { id } });
  res.status(204).end();
});
