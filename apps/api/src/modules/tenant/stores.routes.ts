import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { notFound } from "../../lib/errors.js";
import { assertWithinPlan } from "../../lib/plans.js";
import { tenantAdminOnly } from "../../middleware/tenant.js";

const idParam = z.object({ id: z.uuid() });
const fields = {
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).nullable(),
  isActive: z.boolean(),
};

export const storesRouter = Router();

/** Sucursales activas contra el tope del plan. */
async function assertStoreRoom(req: import("express").Request) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: req.auth!.tid! }, select: { plan: true } });
  assertWithinPlan(tenant.plan, "stores", await req.db!.store.count({ where: { isActive: true } }));
}

storesRouter.get("/stores", async (req, res) => {
  res.json({ data: await req.db!.store.findMany({ orderBy: { createdAt: "asc" } }) });
});

storesRouter.post("/stores", tenantAdminOnly, async (req, res) => {
  const body = z.object({ name: fields.name, address: fields.address.optional() }).strict().parse(req.body);
  await assertStoreRoom(req);
  res.status(201).json(await req.db!.store.create({ data: body as never }));
});

storesRouter.patch("/stores/:id", tenantAdminOnly, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = z.object(fields).partial().strict().parse(req.body);
  const store = await req.db!.store.findFirst({ where: { id } });
  if (!store) throw notFound("Sucursal no encontrada");
  // Reactivar una sucursal cuenta como agregar una.
  if (body.isActive === true && !store.isActive) await assertStoreRoom(req);
  res.json(await req.db!.store.update({ where: { id }, data: body }));
});
