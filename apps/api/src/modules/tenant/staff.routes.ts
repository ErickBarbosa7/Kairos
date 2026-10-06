import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { HttpError, notFound } from "../../lib/errors.js";
import { hashPassword } from "../../lib/password.js";
import { tenantAdminOnly } from "../../middleware/tenant.js";

const idParam = z.object({ id: z.uuid() });
const password = z.string().min(10, "Mínimo 10 caracteres").max(128);

const view = (u: { id: string; email: string; name: string; role: string; storeId: string | null; isActive: boolean; createdAt: Date }) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  storeId: u.storeId,
  isActive: u.isActive,
  createdAt: u.createdAt,
});

export const staffRouter = Router();
staffRouter.use("/staff", tenantAdminOnly);

async function assertStore(req: import("express").Request, storeId: string | null | undefined) {
  if (storeId && !(await req.db!.store.findFirst({ where: { id: storeId } }))) throw notFound("Sucursal no encontrada");
}

staffRouter.get("/staff", async (req, res) => {
  const rows = await req.db!.tenantUser.findMany({ orderBy: [{ role: "asc" }, { createdAt: "asc" }] });
  res.json({ data: rows.map(view) });
});

// Solo se crea personal de caja; los administradores los da de alta el super admin
staffRouter.post("/staff", async (req, res) => {
  const body = z
    .object({
      name: z.string().trim().min(2).max(100),
      email: z.email().max(254),
      password,
      storeId: z.uuid().nullable().optional(),
    })
    .strict()
    .parse(req.body);
  await assertStore(req, body.storeId);
  const user = await req.db!.tenantUser.create({
    data: {
      name: body.name,
      email: body.email.toLowerCase(),
      passwordHash: await hashPassword(body.password),
      role: "TENANT_STAFF",
      storeId: body.storeId ?? null,
    } as never,
  });
  res.status(201).json(view(user));
});

staffRouter.patch("/staff/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = z
    .object({
      name: z.string().trim().min(2).max(100),
      storeId: z.uuid().nullable(),
      isActive: z.boolean(),
      password,
    })
    .partial()
    .strict()
    .parse(req.body);

  const target = await req.db!.tenantUser.findFirst({ where: { id } });
  if (!target) throw notFound("Empleado no encontrado");
  if (target.role !== "TENANT_STAFF") throw new HttpError(403, "Solo puedes editar personal de caja", "forbidden");
  await assertStore(req, body.storeId);

  const { password: newPassword, ...rest } = body;
  const updated = await req.db!.tenantUser.update({
    where: { id },
    data: { ...rest, ...(newPassword && { passwordHash: await hashPassword(newPassword) }) },
  });

  // Desactivar o cambiar la contraseña cierra sus sesiones
  if (body.isActive === false || newPassword) {
    await prisma.refreshToken.updateMany({
      where: { subjectType: "TENANT_USER", subjectId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.json(view(updated));
});
