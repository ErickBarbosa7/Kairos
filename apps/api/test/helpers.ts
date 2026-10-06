import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/lib/password.js";

export const prisma = new PrismaClient();
export const PASSWORD = "correct-horse-battery";

export const app = createApp({ rateLimit: false });
export const agent = () => request.agent(app);

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE tenants, consumers, super_admins, refresh_tokens, audit_logs RESTART IDENTITY CASCADE`,
  );
}

export async function makeSuperAdmin(email = "root@kairos.test") {
  return prisma.superAdmin.create({
    data: { email, name: "Root", passwordHash: await hashPassword(PASSWORD) },
  });
}

export async function makeTenant(slug: string, opts: { status?: "ACTIVE" | "SUSPENDED"; role?: "TENANT_ADMIN" | "TENANT_STAFF" } = {}) {
  const tenant = await prisma.tenant.create({ data: { name: `Tenant ${slug}`, slug, status: opts.status ?? "ACTIVE" } });
  const user = await prisma.tenantUser.create({
    data: {
      tenantId: tenant.id,
      email: `owner@${slug}.test`,
      name: "Owner",
      passwordHash: await hashPassword(PASSWORD),
      role: opts.role ?? "TENANT_ADMIN",
    },
  });
  return { tenant, user };
}

export const refreshCookie = (res: request.Response) =>
  (res.headers["set-cookie"] as unknown as string[] | undefined)?.find((c) => c.startsWith("kairos_rt="));

export async function loginTenant(slug: string, email = `owner@${slug}.test`) {
  const res = await request(app).post("/auth/tenant/login").send({ tenantSlug: slug, email, password: PASSWORD });
  return { token: res.body.accessToken as string, h: { Authorization: `Bearer ${res.body.accessToken}` } };
}

export async function makeStaff(tenantId: string, slug: string) {
  return prisma.tenantUser.create({
    data: { tenantId, email: `staff@${slug}.test`, name: "Caja", passwordHash: await hashPassword(PASSWORD), role: "TENANT_STAFF" },
  });
}

/** Cupón PENDING listo para canjear (crea consumidor, billetera y premio si no existen). */
export async function makeCoupon(tenantId: string, code: string, opts: { status?: "PENDING" | "REDEEMED"; expiresInMs?: number } = {}) {
  const consumer = await prisma.consumer.upsert({
    where: { email: "cliente@example.com" },
    update: {},
    create: { email: "cliente@example.com" },
  });
  const wallet = await prisma.wallet.upsert({
    where: { tenantId_consumerId: { tenantId, consumerId: consumer.id } },
    update: {},
    create: { tenantId, consumerId: consumer.id, balance: 500 },
  });
  const reward =
    (await prisma.reward.findFirst({ where: { tenantId } })) ??
    (await prisma.reward.create({ data: { tenantId, title: "Café gratis", pointsCost: 100 } }));
  return prisma.coupon.create({
    data: {
      tenantId,
      walletId: wallet.id,
      rewardId: reward.id,
      rewardTitle: reward.title,
      pointsCost: reward.pointsCost,
      code,
      status: opts.status ?? "PENDING",
      expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 10 * 60_000)),
    },
  });
}

// PNG mínimo válido (1x1)
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

import { generateKeyPairSync, type KeyObject } from "node:crypto";

export function keyPair(kind: "ec" | "ed25519" | "rsa" = "ec") {
  const pair: { publicKey: KeyObject; privateKey: KeyObject } =
    kind === "ec"
      ? generateKeyPairSync("ec", { namedCurve: "P-256" })
      : kind === "rsa"
        ? generateKeyPairSync("rsa", { modulusLength: 2048 })
        : generateKeyPairSync("ed25519");
  return {
    pub: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
    priv: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}
