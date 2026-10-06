import { Router } from "express";
import { z } from "zod";
import { notFound } from "../../lib/errors.js";
import { tenantAdminOnly } from "../../middleware/tenant.js";

const idParam = z.object({ id: z.uuid() });
const fields = {
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).nullable(),
  isActive: z.boolean(),
};

export const storesRouter = Router();

storesRouter.get("/stores", async (req, res) => {
  res.json({ data: await req.db!.store.findMany({ orderBy: { createdAt: "asc" } }) });
});

storesRouter.post("/stores", tenantAdminOnly, async (req, res) => {
  const body = z.object({ name: fields.name, address: fields.address.optional() }).strict().parse(req.body);
  res.status(201).json(await req.db!.store.create({ data: body as never }));
});

storesRouter.patch("/stores/:id", tenantAdminOnly, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = z.object(fields).partial().strict().parse(req.body);
  if (!(await req.db!.store.findFirst({ where: { id } }))) throw notFound("Sucursal no encontrada");
  res.json(await req.db!.store.update({ where: { id }, data: body }));
});
