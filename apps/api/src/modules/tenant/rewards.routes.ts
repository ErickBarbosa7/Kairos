import { Router } from "express";
import { z } from "zod";
import { notFound } from "../../lib/errors.js";
import { tenantAdminOnly } from "../../middleware/tenant.js";
import { ownedImageUrl } from "./brand.routes.js";

const idParam = z.object({ id: z.uuid() });

const fields = (tid: string) => ({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).nullable(),
  imageUrl: ownedImageUrl(tid).nullable(),
  pointsCost: z.number().int().min(1).max(1_000_000),
  stock: z.number().int().min(0).max(1_000_000).nullable(),
  isActive: z.boolean(),
});

export const rewardsRouter = Router();

rewardsRouter.get("/rewards", async (req, res) => {
  const data = await req.db!.reward.findMany({
    where: { deletedAt: null },
    orderBy: [{ pointsCost: "asc" }, { createdAt: "asc" }],
  });
  res.json({ data });
});

rewardsRouter.post("/rewards", tenantAdminOnly, async (req, res) => {
  const f = fields(req.auth!.tid!);
  const body = z
    .object({ title: f.title, pointsCost: f.pointsCost })
    .extend({
      description: f.description.optional(),
      imageUrl: f.imageUrl.optional(),
      stock: f.stock.optional(),
      isActive: f.isActive.optional(),
    })
    .strict()
    .parse(req.body);
  const reward = await req.db!.reward.create({ data: body as never });
  res.status(201).json(reward);
});

rewardsRouter.patch("/rewards/:id", tenantAdminOnly, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = z.object(fields(req.auth!.tid!)).partial().strict().parse(req.body);
  const existing = await req.db!.reward.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw notFound("Premio no encontrado");
  res.json(await req.db!.reward.update({ where: { id }, data: body }));
});

// Borrado lógico: los cupones ya emitidos conservan su copia del título y costo
rewardsRouter.delete("/rewards/:id", tenantAdminOnly, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const existing = await req.db!.reward.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw notFound("Premio no encontrado");
  await req.db!.reward.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  res.status(204).end();
});
