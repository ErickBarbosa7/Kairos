import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { notFound } from "../../lib/errors.js";
import { PLAN_CATALOG, PLAN_CURRENCY, PLAN_ORDER } from "../../lib/plans.js";

/**
 * Datos públicos para vestir la máquina Arcade al arrancar (DISENO.md 4.5).
 * Sin autenticación: solo expone marca, nada de negocio.
 */
export function publicRouter(opts: { rateLimit: boolean }) {
  const r = Router();
  if (opts.rateLimit) {
    r.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false }));
  }

  r.get("/stores/:id/brand", async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const store = await prisma.store.findFirst({
      where: { id, isActive: true, tenant: { status: "ACTIVE", deletedAt: null } },
      select: {
        id: true,
        name: true,
        tenant: {
          select: { name: true, logoUrl: true, primaryColor: true, secondaryColor: true, themeMode: true },
        },
      },
    });
    if (!store) throw notFound("Sucursal no encontrada");
    const { tenant: t } = store;
    res.json({
      storeId: store.id,
      storeName: store.name,
      name: t.name,
      logoUrl: t.logoUrl,
      primaryColor: t.primaryColor,
      secondaryColor: t.secondaryColor,
      themeMode: t.themeMode,
    });
  });

  // Precios y límites de los planes: los lee la landing y el panel.
  r.get("/plans", (_req, res) => {
    res.json({
      currency: PLAN_CURRENCY,
      period: "month",
      trialDays: env.TRIAL_DAYS,
      plans: PLAN_ORDER.map((key) => ({
        key,
        priceMonthly: PLAN_CATALOG[key].priceMonthly,
        limits: { stores: PLAN_CATALOG[key].maxStores, machines: PLAN_CATALOG[key].maxMachines },
      })),
    });
  });

  // Recompensas que puede ganar la ruleta de la terminal: activas y con existencias.
  r.get("/stores/:id/rewards", async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const store = await prisma.store.findFirst({
      where: { id, isActive: true, tenant: { status: "ACTIVE", deletedAt: null } },
      select: { tenantId: true },
    });
    if (!store) throw notFound("Sucursal no encontrada");
    const rewards = await prisma.reward.findMany({
      where: { tenantId: store.tenantId, isActive: true, deletedAt: null, OR: [{ stock: null }, { stock: { gt: 0 } }] },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { id: true, title: true, description: true, imageUrl: true, pointsCost: true },
    });
    res.json({ data: rewards });
  });

  return r;
}
