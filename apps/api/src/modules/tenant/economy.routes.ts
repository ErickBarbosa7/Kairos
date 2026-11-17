import { Router } from "express";
import { z } from "zod";
import { economyFields } from "../../lib/economy.js";
import { tenantAdminOnly } from "../../middleware/tenant.js";

const select = { scorePerPoint: true, maxPointsPerGame: true, maxGamesPerDay: true, avgTicket: true } as const;

export const economyRouter = Router();

// Cualquier usuario del negocio puede leer la economía; solo el administrador la cambia.
economyRouter.get("/economy", async (req, res) => {
  res.json(await req.db!.tenant.findUniqueOrThrow({ where: { id: req.auth!.tid! }, select }));
});

economyRouter.patch("/economy", tenantAdminOnly, async (req, res) => {
  const tid = req.auth!.tid!;
  const data = z.object({ ...economyFields, avgTicket: z.number().int().min(0).max(1_000_000).nullable() }).partial().strict().parse(req.body);
  const economy = await req.db!.$transaction(async (tx) => {
    const tenant = await tx.tenant.update({ where: { id: tid }, data, select });
    await tx.auditLog.create({
      data: {
        tenantId: tid,
        actorType: "TENANT_USER",
        actorId: req.auth!.sub,
        action: "tenant.economy_update",
        targetType: "tenant",
        targetId: tid,
        metadata: data,
        ip: req.ip,
      },
    });
    return tenant;
  });
  res.json(economy);
});
