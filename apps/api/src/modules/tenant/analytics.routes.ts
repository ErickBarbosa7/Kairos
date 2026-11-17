import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../lib/errors.js";
import { assertFeature } from "../../lib/plans.js";
import { daysBetween, localDate, retention, roi, shift } from "./analytics.service.js";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(s)), "Fecha inválida");
const range = z.object({ from: iso.optional(), to: iso.optional() }).strict();

/** Rango pedido (por defecto, últimos 30 días). Máximo 365 días; más de 30 exige plan PRO. */
function resolveRange(query: unknown, plan: Parameters<typeof assertFeature>[0]) {
  const q = range.parse(query);
  const to = q.to ?? localDate(new Date());
  const from = q.from ?? shift(to, -29);
  const days = daysBetween(from, to);
  if (days < 1 || days > 365) throw new HttpError(400, "Rango inválido: de 1 a 365 días", "invalid_range");
  if (days > 30) assertFeature(plan, "long_range");
  return { from, to };
}

export const analyticsRouter = Router();

// Acotado al tenant del token: `tid` sale del JWT, nunca del cliente. El SQL crudo filtra por él.
analyticsRouter.get("/analytics/retention", async (req, res) => {
  const tid = req.auth!.tid!;
  const { plan } = await prisma.tenant.findUniqueOrThrow({ where: { id: tid }, select: { plan: true } });
  const { from, to } = resolveRange(req.query, plan);
  res.json(await retention(prisma, tid, from, to));
});

analyticsRouter.get("/analytics/roi", async (req, res) => {
  const tid = req.auth!.tid!;
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tid }, select: { plan: true, avgTicket: true } });
  assertFeature(t.plan, "roi");
  const { from, to } = resolveRange(req.query, t.plan);
  res.json(await roi(prisma, tid, t.avgTicket, from, to));
});
