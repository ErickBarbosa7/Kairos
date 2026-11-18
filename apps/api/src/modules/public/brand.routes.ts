import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { notFound } from "../../lib/errors.js";
import { isRunning } from "../tenant/campaigns.service.js";
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

  // Campañas vigentes del negocio: la terminal las muestra como gancho en el menú.
  r.get("/stores/:id/campaigns", async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const store = await prisma.store.findFirst({
      where: { id, isActive: true, tenant: { status: "ACTIVE", deletedAt: null } },
      select: { tenantId: true },
    });
    if (!store) throw notFound("Sucursal no encontrada");
    const now = new Date();
    const all = await prisma.campaign.findMany({ where: { tenantId: store.tenantId, isActive: true }, orderBy: { createdAt: "asc" }, take: 20 });
    res.json({ data: all.filter((c) => isRunning(c, now)).map((c) => ({ name: c.name, type: c.type })) });
  });

  // Negocios suscritos cerca de una ubicación. La ubicación del cliente solo se usa para esta consulta.
  r.get("/stores/nearby", async (req, res) => {
    const q = z
      .object({
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180),
        radius: z.coerce.number().min(0.5).max(NEARBY_MAX_KM).default(10),
      })
      .parse(req.query);
    const rows = await prisma.$queryRaw<NearbyRow[]>`
      SELECT * FROM (
        SELECT s.id AS "storeId", s.name AS "storeName", s.address, t.id AS "tenantId", t.name,
               t.logo_url AS "logoUrl", t.primary_color AS "primaryColor",
               2 * 6371 * asin(sqrt(
                 power(sin(radians(s.latitude - ${q.lat}) / 2), 2) +
                 cos(radians(${q.lat})) * cos(radians(s.latitude)) * power(sin(radians(s.longitude - ${q.lng}) / 2), 2)
               )) AS "distanceKm"
        FROM stores s JOIN tenants t ON t.id = s.tenant_id
        WHERE s.is_active AND s.listed_nearby AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
          AND t.status = 'ACTIVE' AND t.deleted_at IS NULL
          AND (t.subscription_ends_at IS NULL OR t.subscription_ends_at > now())
      ) x WHERE "distanceKm" <= ${q.radius}
      ORDER BY "distanceKm" ASC LIMIT ${NEARBY_LIMIT}`;
    const tenantIds = [...new Set(rows.map((r) => r.tenantId))];
    const rewards = tenantIds.length
      ? await prisma.reward.findMany({
          where: { tenantId: { in: tenantIds }, isActive: true, deletedAt: null, OR: [{ stock: null }, { stock: { gt: 0 } }] },
          orderBy: [{ pointsCost: "asc" }, { createdAt: "asc" }],
          select: { tenantId: true, title: true, pointsCost: true },
        })
      : [];
    res.json({
      data: rows.map((r) => ({
        ...r,
        // Redondeo a 100 m: no hace falta más precisión para decidir si ir.
        distanceKm: Math.round(Number(r.distanceKm) * 10) / 10,
        rewards: rewards.filter((w) => w.tenantId === r.tenantId).slice(0, 3).map((w) => ({ title: w.title, pointsCost: w.pointsCost })),
      })),
    });
  });

  return r;
}

const NEARBY_LIMIT = 20;
const NEARBY_MAX_KM = 25;
interface NearbyRow {
  storeId: string;
  storeName: string;
  address: string | null;
  tenantId: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  distanceKm: number;
}
