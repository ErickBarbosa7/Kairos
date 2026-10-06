import type { RequestHandler } from "express";
import { prisma } from "../db/prisma.js";
import { forTenant } from "../db/tenant-scope.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { requireAuth, requireRole } from "./auth.js";

declare global {
  namespace Express {
    interface Request {
      /** Cliente Prisma limitado al tenant del token */
      db?: ReturnType<typeof forTenant>;
    }
  }
}

/** Exige un usuario de tenant activo, con tenant activo, y deja `req.db` listo. Consulta el estado en cada petición para que suspender o desactivar surta efecto al instante. */
const tenantContext: RequestHandler = async (req, _res, next) => {
  const tid = req.auth?.tid;
  if (!tid) throw forbidden();
  const user = await prisma.tenantUser.findFirst({
    where: { id: req.auth!.sub, tenantId: tid },
    select: { isActive: true, tenant: { select: { status: true, deletedAt: true } } },
  });
  if (!user || !user.isActive || user.tenant.deletedAt) throw unauthorized();
  if (user.tenant.status !== "ACTIVE") throw forbidden("Cuenta suspendida. Contacta al administrador");
  req.db = forTenant(prisma, tid);
  next();
};

export const tenantAuth = [requireAuth, requireRole("tenant_admin", "tenant_staff"), tenantContext];
export const tenantAdminOnly = requireRole("tenant_admin");
