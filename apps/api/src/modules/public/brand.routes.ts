import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { notFound } from "../../lib/errors.js";

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

  return r;
}
