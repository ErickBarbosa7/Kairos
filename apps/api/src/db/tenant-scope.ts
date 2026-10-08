import { Prisma, type PrismaClient } from "@prisma/client";

/**
 * Modelos con columna `tenant_id` obligatoria. Toda consulta sobre ellos
 * pasa por el filtro de tenant (ARQUITECTURA.md 4.1).
 */
const TENANT_MODELS = new Set([
  "Store",
  "Machine",
  "TenantUser",
  "Wallet",
  "Reward",
  "QrClaim",
  "PointTransaction",
  "Coupon",
  "TerminalPairing",
  "TerminalSession",
]);

const WHERE_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

export class TenantScopeError extends Error {}

function withTenantData(data: Record<string, unknown>, tenantId: string) {
  if (data.tenantId !== undefined && data.tenantId !== tenantId) {
    throw new TenantScopeError("tenantId distinto al del contexto");
  }
  return { ...data, tenantId };
}

/** Devuelve un cliente cuyas consultas quedan limitadas a un tenant. */
export function forTenant(prisma: PrismaClient, tenantId: string) {
  if (!tenantId) throw new TenantScopeError("tenantId requerido");

  return prisma.$extends(
    Prisma.defineExtension({
      name: "tenant-scope",
      query: {
        $allModels: {
          $allOperations({ model, operation, args, query }) {
            if (!TENANT_MODELS.has(model)) return query(args);
            const a = args as Record<string, any>;

            if (WHERE_OPS.has(operation)) {
              a.where = { ...a.where, tenantId };
            } else if (operation === "create") {
              a.data = withTenantData(a.data, tenantId);
            } else if (operation === "createMany" || operation === "createManyAndReturn") {
              const rows = Array.isArray(a.data) ? a.data : [a.data];
              a.data = rows.map((r: Record<string, unknown>) => withTenantData(r, tenantId));
            } else if (operation === "upsert") {
              a.where = { ...a.where, tenantId };
              a.create = withTenantData(a.create, tenantId);
            } else {
              throw new TenantScopeError(`operación no soportada en modelo con tenant: ${operation}`);
            }
            return query(a);
          },
        },
      },
    }),
  );
}
