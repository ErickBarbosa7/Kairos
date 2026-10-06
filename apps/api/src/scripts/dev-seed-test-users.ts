import "../config/env.js";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "../lib/password.js";

// SOLO DESARROLLO. Crea (o restablece) un usuario de prueba por rol. No toca usuarios existentes.
// Uso: TENANT_SLUG=cafeteria-aurora pnpm --filter @kairos/api seed:test-users
if (process.env.NODE_ENV === "production") throw new Error("No usar en producción");
const slug = process.env.TENANT_SLUG ?? "cafeteria-aurora";
const password = "Kairos-Test-2026!";
const passwordHash = await hashPassword(password);

await prisma.superAdmin.upsert({
  where: { email: "qa-super@kairos.local" },
  update: { passwordHash },
  create: { email: "qa-super@kairos.local", name: "QA Super Admin", passwordHash },
});

const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
for (const [email, name, role] of [
  ["qa-admin@kairos.local", "QA Tenant Admin", "TENANT_ADMIN"],
  ["qa-staff@kairos.local", "QA Tenant Staff", "TENANT_STAFF"],
] as const) {
  await prisma.tenantUser.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: { passwordHash, isActive: true },
    create: { tenantId: tenant.id, email, name, role, passwordHash },
  });
}
console.log(`Usuarios de prueba listos (tenant ${slug})`);
await prisma.$disconnect();
