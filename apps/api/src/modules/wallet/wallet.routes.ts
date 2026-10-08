import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireConsumer } from "../../middleware/consumer.js";
import { claimQr } from "./qr-claim.service.js";

/** Rutas del cliente final (Wallet). Autenticadas con token de cliente, no de panel. */
export function walletRouter(opts: { rateLimit: boolean }) {
  const r = Router();

  if (opts.rateLimit) {
    r.use("/claims", rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false }));
  }
  r.use(requireConsumer);

  // Acredita los puntos de un QR firmado por una máquina Arcade.
  r.post("/claims", async (req, res) => {
    const { qr } = z.object({ qr: z.string().min(20).max(2000) }).strict().parse(req.body);
    res.status(201).json(await claimQr(req.consumerId!, qr));
  });

  // Saldo del cliente en cada negocio donde tiene billetera.
  r.get("/balances", async (req, res) => {
    const wallets = await prisma.wallet.findMany({
      where: { consumerId: req.consumerId!, tenant: { status: "ACTIVE", deletedAt: null } },
      orderBy: { updatedAt: "desc" },
      include: { tenant: { select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true } } },
    });
    res.json({
      data: wallets.map((w) => ({ tenant: w.tenant, balance: w.balance, lifetimeEarned: w.lifetimeEarned })),
    });
  });

  return r;
}
