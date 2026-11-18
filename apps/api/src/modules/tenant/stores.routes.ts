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
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  listedNearby: z.boolean(),
};

/** Latitud y longitud van juntas o ninguna. */
const pairOk = (b: { latitude?: number | null; longitude?: number | null }) =>
  b.latitude === undefined && b.longitude === undefined ? true : (b.latitude === null) === (b.longitude === null) && (b.latitude === undefined) === (b.longitude === undefined);
const pairMsg = { message: "Latitud y longitud van juntas", path: ["latitude"] };

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
  const body = z
    .object({ name: fields.name, address: fields.address.optional(), latitude: fields.latitude.optional(), longitude: fields.longitude.optional(), listedNearby: fields.listedNearby.optional() })
    .strict()
    .refine(pairOk, pairMsg)
    .parse(req.body);
  await assertStoreRoom(req);
  res.status(201).json(await req.db!.store.create({ data: body as never }));
});

storesRouter.patch("/stores/:id", tenantAdminOnly, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = z.object(fields).partial().strict().refine(pairOk, pairMsg).parse(req.body);
  const store = await req.db!.store.findFirst({ where: { id } });
  if (!store) throw notFound("Sucursal no encontrada");
  // Reactivar una sucursal cuenta como agregar una.
  if (body.isActive === true && !store.isActive) await assertStoreRoom(req);
  res.json(await req.db!.store.update({ where: { id }, data: body }));
});
