import { Router } from "express";
import { z } from "zod";
import { HttpError, notFound } from "../../lib/errors.js";
import { tenantAdminOnly } from "../../middleware/tenant.js";

const idParam = z.object({ id: z.uuid() });

const consumerSelect = { id: true, displayName: true, email: true, isGuest: true, createdAt: true } as const;

export const customersRouter = Router();

// Clientes del negocio (billeteras). Búsqueda por nombre o correo; más recientes primero.
customersRouter.get("/customers", async (req, res) => {
  const { q, page, limit } = z
    .object({
      q: z.string().trim().max(80).optional(),
      page: z.coerce.number().int().min(1).max(10_000).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    })
    .parse(req.query);
  const where = q
    ? { consumer: { OR: [{ displayName: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } }
    : {};
  const [total, rows] = await Promise.all([
    req.db!.wallet.count({ where }),
    req.db!.wallet.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: { consumer: { select: consumerSelect } },
    }),
  ]);
  res.json({
    total,
    page,
    limit,
    data: rows.map((w) => ({
      id: w.id,
      balance: w.balance,
      lifetimeEarned: w.lifetimeEarned,
      lastActivityAt: w.updatedAt,
      joinedAt: w.createdAt,
      consumer: w.consumer,
    })),
  });
});

// Detalle: saldo, cupones por estado y últimos movimientos.
customersRouter.get("/customers/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const wallet = await req.db!.wallet.findFirst({ where: { id }, include: { consumer: { select: consumerSelect } } });
  if (!wallet) throw notFound("Cliente no encontrado");
  const [transactions, coupons] = await Promise.all([
    req.db!.pointTransaction.findMany({
      where: { walletId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, type: true, points: true, balanceAfter: true, note: true, createdAt: true },
    }),
    req.db!.coupon.groupBy({ by: ["status"], where: { walletId: id }, _count: { _all: true } }),
  ]);
  res.json({
    id: wallet.id,
    balance: wallet.balance,
    lifetimeEarned: wallet.lifetimeEarned,
    lastActivityAt: wallet.updatedAt,
    joinedAt: wallet.createdAt,
    consumer: wallet.consumer,
    coupons: Object.fromEntries(coupons.map((c) => [c.status, c._count._all])),
    transactions,
  });
});

// Ajuste manual de puntos (error o cortesía). No edita movimientos: agrega uno ADJUST con motivo.
customersRouter.post("/customers/:id/adjust", tenantAdminOnly, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = z
    .object({
      points: z.number().int().refine((n) => n !== 0, "El ajuste no puede ser cero").refine((n) => Math.abs(n) <= 100_000, "Máximo 100000 puntos"),
      note: z.string().trim().min(3).max(200),
    })
    .strict()
    .parse(req.body);
  const tid = req.auth!.tid!;
  const result = await req.db!.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM wallets WHERE id = ${id}::uuid AND tenant_id = ${tid}::uuid FOR UPDATE`;
    if (!locked[0]) throw notFound("Cliente no encontrado");
    const current = await tx.wallet.findFirstOrThrow({ where: { id } });
    if (current.balance + body.points < 0) throw new HttpError(422, "El saldo no puede quedar negativo", "insufficient_points");
    const wallet = await tx.wallet.update({ where: { id }, data: { balance: { increment: body.points } } });
    const movement = await tx.pointTransaction.create({
      data: { walletId: id, type: "ADJUST", points: body.points, balanceAfter: wallet.balance, note: body.note, createdById: req.auth!.sub } as never,
      select: { id: true, type: true, points: true, balanceAfter: true, note: true, createdAt: true },
    });
    await tx.auditLog.create({
      data: {
        tenantId: tid,
        actorType: "TENANT_USER",
        actorId: req.auth!.sub,
        action: "customer.points_adjust",
        targetType: "wallet",
        targetId: id,
        metadata: { points: body.points, note: body.note },
        ip: req.ip,
      },
    });
    return { balance: wallet.balance, transaction: movement };
  });
  res.status(201).json(result);
});
