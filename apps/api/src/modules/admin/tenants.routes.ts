import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { notFound } from "../../lib/errors.js";
import { hashPassword } from "../../lib/password.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color hex #RRGGBB");
const slug = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, "3-40 caracteres: minúsculas, números y guiones");
const password = z.string().min(10, "Mínimo 10 caracteres").max(128);

const createBody = z.object({
  name: z.string().trim().min(2).max(100),
  slug,
  plan: z.enum(["TRIAL", "BASIC", "PRO"]).optional(),
  subscriptionEndsAt: z.coerce.date().nullable().optional(),
  primaryColor: hex.optional(),
  secondaryColor: hex.nullable().optional(),
  themeMode: z.enum(["LIGHT", "DARK", "AUTO"]).optional(),
  admin: z
    .object({ email: z.email().max(254), name: z.string().trim().min(2).max(100), password })
    .optional(),
});

const updateBody = z
  .object({
    name: z.string().trim().min(2).max(100),
    plan: z.enum(["TRIAL", "BASIC", "PRO"]),
    subscriptionEndsAt: z.coerce.date().nullable(),
    primaryColor: hex,
    secondaryColor: hex.nullable(),
    themeMode: z.enum(["LIGHT", "DARK", "AUTO"]),
    scorePerPoint: z.number().int().positive(),
    maxPointsPerGame: z.number().int().positive(),
    maxGamesPerDay: z.number().int().positive(),
  })
  .partial()
  .strict();

const listQuery = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "CANCELLED"]).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const idParam = z.object({ id: z.string().uuid() });

export const tenantsRouter = Router();
tenantsRouter.use(requireAuth, requireRole("super_admin"));

tenantsRouter.get("/", async (req, res) => {
  const { status, q, page, limit } = listQuery.parse(req.query);
  const where: Prisma.TenantWhereInput = {
    deletedAt: null,
    ...(status && { status }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] }),
  };
  const [data, total] = await Promise.all([
    prisma.tenant.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.tenant.count({ where }),
  ]);
  res.json({ data, total, page, limit });
});

tenantsRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const tenant = await prisma.tenant.findFirst({ where: { id, deletedAt: null } });
  if (!tenant) throw notFound("Tenant no encontrado");
  res.json(tenant);
});

tenantsRouter.post("/", async (req, res) => {
  const { admin, ...data } = createBody.parse(req.body);
  const adminHash = admin ? await hashPassword(admin.password) : null;

  const tenant = await prisma.$transaction(async (tx) => {
    const t = await tx.tenant.create({ data });
    if (admin && adminHash) {
      await tx.tenantUser.create({
        data: {
          tenantId: t.id,
          email: admin.email.toLowerCase(),
          name: admin.name,
          passwordHash: adminHash,
          role: "TENANT_ADMIN",
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorType: "SUPER_ADMIN",
        actorId: req.auth!.sub,
        action: "tenant.create",
        targetType: "tenant",
        targetId: t.id,
        ip: req.ip,
      },
    });
    return t;
  });
  res.status(201).json(tenant);
});

tenantsRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = updateBody.parse(req.body);
  const existing = await prisma.tenant.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw notFound("Tenant no encontrado");

  const tenant = await prisma.$transaction(async (tx) => {
    const t = await tx.tenant.update({ where: { id }, data });
    await tx.auditLog.create({
      data: {
        actorType: "SUPER_ADMIN",
        actorId: req.auth!.sub,
        action: "tenant.update",
        targetType: "tenant",
        targetId: id,
        metadata: { fields: Object.keys(data) },
        ip: req.ip,
      },
    });
    return t;
  });
  res.json(tenant);
});

async function setStatus(req: import("express").Request, status: "ACTIVE" | "SUSPENDED") {
  const { id } = idParam.parse(req.params);
  const existing = await prisma.tenant.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw notFound("Tenant no encontrado");

  return prisma.$transaction(async (tx) => {
    const t = await tx.tenant.update({ where: { id }, data: { status } });
    if (status === "SUSPENDED") {
      const users = await tx.tenantUser.findMany({ where: { tenantId: id }, select: { id: true } });
      await tx.refreshToken.updateMany({
        where: { subjectType: "TENANT_USER", subjectId: { in: users.map((u) => u.id) }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await tx.auditLog.create({
      data: {
        actorType: "SUPER_ADMIN",
        actorId: req.auth!.sub,
        action: status === "SUSPENDED" ? "tenant.suspend" : "tenant.activate",
        targetType: "tenant",
        targetId: id,
        ip: req.ip,
      },
    });
    return t;
  });
}

tenantsRouter.post("/:id/suspend", async (req, res) => {
  res.json(await setStatus(req, "SUSPENDED"));
});

tenantsRouter.post("/:id/activate", async (req, res) => {
  res.json(await setStatus(req, "ACTIVE"));
});
