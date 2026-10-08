import type { Plan } from "@prisma/client";
import type { RequestHandler } from "express";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../lib/errors.js";
import { limitOf } from "../../lib/plans.js";
import { subscriptionState } from "../../lib/subscription.js";
import { tenantAdminOnly } from "../../middleware/tenant.js";

const loadTenant = (id: string) =>
  prisma.tenant.findUniqueOrThrow({ where: { id }, select: { plan: true, subscriptionEndsAt: true, requestedPlan: true, planRequestedAt: true } });

/** Estado de la suscripción y plan pedido. Disponible aunque la prueba haya vencido. */
export const subscriptionRouter = Router();

/** Cuánto lleva usado el negocio de cada límite de su plan. */
async function usageOf(tenantId: string, plan: Plan) {
  const [stores, machines] = await Promise.all([
    prisma.store.count({ where: { tenantId, isActive: true } }),
    prisma.machine.count({ where: { tenantId, status: "ACTIVE" } }),
  ]);
  return {
    limits: { stores: limitOf(plan, "stores"), machines: limitOf(plan, "machines") },
    usage: { stores, machines },
  };
}

subscriptionRouter.get("/subscription", async (req, res) => {
  const tenant = await loadTenant(req.auth!.tid!);
  res.json({ ...subscriptionState(tenant), planRequestedAt: tenant.planRequestedAt, ...(await usageOf(req.auth!.tid!, tenant.plan)) });
});

// Todavía no hay cobro en línea: pedir un plan deja la solicitud para que el Super Admin lo active.
subscriptionRouter.post("/subscription/request", tenantAdminOnly, async (req, res) => {
  const { plan } = z.object({ plan: z.enum(["BASIC", "PRO"]) }).strict().parse(req.body);
  const tid = req.auth!.tid!;
  await prisma.tenant.update({ where: { id: tid }, data: { requestedPlan: plan, planRequestedAt: new Date() } });
  await prisma.auditLog.create({
    data: { tenantId: tid, actorType: "TENANT_USER", actorId: req.auth!.sub, action: "tenant.plan_request", targetType: "tenant", targetId: tid, metadata: { plan }, ip: req.ip },
  });
  const tenant = await loadTenant(tid);
  res.status(201).json({ ...subscriptionState(tenant), planRequestedAt: tenant.planRequestedAt });
});

/** Bloquea el resto del panel cuando la prueba o el plan ya vencieron. */
export const requireActiveSubscription: RequestHandler = async (req, _res, next) => {
  const tenant = await loadTenant(req.auth!.tid!);
  if (subscriptionState(tenant).expired) {
    throw new HttpError(402, "Tu prueba o plan terminó. Elige un plan para continuar", "subscription_required");
  }
  next();
};
