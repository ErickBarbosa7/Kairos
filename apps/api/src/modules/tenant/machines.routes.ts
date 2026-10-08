import { createPublicKey } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { HttpError, notFound } from "../../lib/errors.js";
import { assertWithinPlan } from "../../lib/plans.js";
import { tenantAdminOnly } from "../../middleware/tenant.js";

const idParam = z.object({ id: z.uuid() });

/** Valida que sea una llave PÚBLICA del algoritmo declarado y la devuelve normalizada (SPKI PEM). */
export function normalizePublicKey(pem: string, alg: "ES256" | "EDDSA"): string {
  if (/PRIVATE/i.test(pem)) throw new HttpError(400, "Pegaste una llave privada. Solo se registra la pública", "private_key_rejected");
  let key;
  try {
    key = createPublicKey(pem);
  } catch {
    throw new HttpError(400, "Llave pública no válida (formato PEM)", "invalid_key");
  }
  const ok =
    alg === "ES256"
      ? key.asymmetricKeyType === "ec" && key.asymmetricKeyDetails?.namedCurve === "prime256v1"
      : key.asymmetricKeyType === "ed25519";
  if (!ok) throw new HttpError(400, `La llave no corresponde al algoritmo ${alg}`, "key_algorithm_mismatch");
  return key.export({ type: "spki", format: "pem" }).toString();
}

const view = (m: {
  id: string;
  storeId: string;
  label: string;
  keyAlgorithm: string;
  authMode: string;
  status: string;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) => ({
  id: m.id,
  storeId: m.storeId,
  label: m.label,
  keyAlgorithm: m.keyAlgorithm,
  authMode: m.authMode,
  status: m.status,
  lastSeenAt: m.lastSeenAt,
  revokedAt: m.revokedAt,
  createdAt: m.createdAt,
});

export const machinesRouter = Router();

machinesRouter.get("/machines", async (req, res) => {
  const rows = await req.db!.machine.findMany({ orderBy: { createdAt: "asc" } });
  res.json({ data: rows.map(view) });
});

machinesRouter.post("/machines", tenantAdminOnly, async (req, res) => {
  const body = z
    .object({
      storeId: z.uuid(),
      label: z.string().trim().min(2).max(80),
      keyAlgorithm: z.enum(["ES256", "EDDSA"]).default("ES256"),
      publicKey: z.string().min(40).max(2000),
    })
    .strict()
    .parse(req.body);

  const store = await req.db!.store.findFirst({ where: { id: body.storeId, isActive: true } });
  if (!store) throw notFound("Sucursal no encontrada");

  // Primero se valida la llave (400) y después el tope del plan (403).
  const publicKey = normalizePublicKey(body.publicKey, body.keyAlgorithm);

  // Máquinas activas contra el tope del plan (las revocadas no cuentan).
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: req.auth!.tid! }, select: { plan: true } });
  assertWithinPlan(tenant.plan, "machines", await req.db!.machine.count({ where: { status: "ACTIVE" } }));

  const machine = await req.db!.machine.create({
    data: { ...body, publicKey } as never,
  });
  res.status(201).json(view(machine));
});

machinesRouter.patch("/machines/:id", tenantAdminOnly, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = z.object({ label: z.string().trim().min(2).max(80) }).strict().parse(req.body);
  if (!(await req.db!.machine.findFirst({ where: { id } }))) throw notFound("Máquina no encontrada");
  res.json(view(await req.db!.machine.update({ where: { id }, data: body })));
});

// Revocar es definitivo: para reactivar se registra una llave nueva
machinesRouter.post("/machines/:id/revoke", tenantAdminOnly, async (req, res) => {
  const { id } = idParam.parse(req.params);
  if (!(await req.db!.machine.findFirst({ where: { id } }))) throw notFound("Máquina no encontrada");
  const machine = await req.db!.machine.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date() } });
  await prisma.terminalSession.updateMany({ where: { machineId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  res.json(view(machine));
});
