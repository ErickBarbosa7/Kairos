import type { CouponStatus } from "@prisma/client";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { HttpError, notFound } from "../../lib/errors.js";

const normalize = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
const codeParam = z.object({ code: z.string().min(4).max(20).transform(normalize) });

type Effective = CouponStatus;
const effective = (c: { status: CouponStatus; expiresAt: Date }): Effective =>
  c.status === "PENDING" && c.expiresAt <= new Date() ? "EXPIRED" : c.status;

const view = (c: {
  id: string;
  code: string;
  status: CouponStatus;
  rewardTitle: string;
  pointsCost: number;
  expiresAt: Date;
  redeemedAt: Date | null;
  createdAt: Date;
}) => ({
  id: c.id,
  code: c.code,
  status: effective(c),
  rewardTitle: c.rewardTitle,
  pointsCost: c.pointsCost,
  expiresAt: c.expiresAt,
  redeemedAt: c.redeemedAt,
  createdAt: c.createdAt,
});

export function couponsRouter(opts: { rateLimit: boolean }) {
  const r = Router();

  // Freno a la adivinación de códigos: por usuario, no por IP (varios cajeros pueden compartir red)
  if (opts.rateLimit) {
    r.use(
      "/coupons/by-code",
      rateLimit({
        windowMs: 60_000,
        limit: 30,
        keyGenerator: (req) => req.auth!.sub,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: { code: "rate_limited", message: "Demasiados intentos. Espera un minuto" } },
      }),
    );
  }

  r.get("/coupons", async (req, res) => {
    const q = z
      .object({
        status: z.enum(["PENDING", "REDEEMED", "EXPIRED", "CANCELLED"]).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(10),
      })
      .parse(req.query);
    const rows = await req.db!.coupon.findMany({
      where: { ...(q.status && q.status !== "EXPIRED" && { status: q.status }) },
      orderBy: q.status === "REDEEMED" ? { redeemedAt: "desc" } : { createdAt: "desc" },
      take: q.limit,
      include: { redeemedBy: { select: { name: true } } },
    });
    res.json({ data: rows.map((c) => ({ ...view(c), redeemedBy: c.redeemedBy?.name ?? null })) });
  });

  async function findByCode(req: import("express").Request, code: string) {
    const pending = await req.db!.coupon.findFirst({ where: { code, status: "PENDING" } });
    if (pending) return pending;
    return req.db!.coupon.findFirst({ where: { code }, orderBy: { createdAt: "desc" } });
  }

  r.get("/coupons/by-code/:code", async (req, res) => {
    const { code } = codeParam.parse(req.params);
    const coupon = await findByCode(req, code);
    if (!coupon) throw notFound("Código no encontrado");
    res.json(view(coupon));
  });

  r.post("/coupons/by-code/:code/redeem", async (req, res) => {
    const { code } = codeParam.parse(req.params);
    const user = await req.db!.tenantUser.findFirst({ where: { id: req.auth!.sub } });

    // Un solo UPDATE condicional: dos cajeros con el mismo código no pueden canjear ambos
    const claimed = await req.db!.coupon.updateMany({
      where: { code, status: "PENDING", expiresAt: { gt: new Date() } },
      data: {
        status: "REDEEMED",
        redeemedAt: new Date(),
        redeemedById: req.auth!.sub,
        redeemedStoreId: user?.storeId ?? null,
      },
    });

    if (claimed.count === 0) {
      const coupon = await findByCode(req, code);
      if (!coupon) throw notFound("Código no encontrado");
      const s = effective(coupon);
      const msg = {
        REDEEMED: "Este cupón ya fue canjeado",
        EXPIRED: "Este cupón está vencido",
        CANCELLED: "Este cupón fue cancelado",
        PENDING: "No se pudo canjear. Intenta de nuevo",
      }[s];
      throw new HttpError(409, msg, `coupon_${s.toLowerCase()}`);
    }

    const coupon = await req.db!.coupon.findFirstOrThrow({ where: { code, status: "REDEEMED" }, orderBy: { redeemedAt: "desc" } });
    res.json(view(coupon));
  });

  return r;
}
