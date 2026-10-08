import type { SubjectType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { unauthorized } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { subscriptionState } from "../../lib/subscription.js";
import { hashToken, newRefreshToken, type Role, signAccessToken } from "../../lib/tokens.js";

interface Subject {
  type: SubjectType;
  id: string;
  role: Role;
  tenantId?: string;
}

export interface Session {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

async function issueSession(subject: Subject, familyId: string = randomUUID()): Promise<Session> {
  const refresh = newRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  await prisma.refreshToken.create({
    data: {
      subjectType: subject.type,
      subjectId: subject.id,
      tokenHash: refresh.hash,
      familyId,
      expiresAt: refreshExpiresAt,
    },
  });
  const accessToken = await signAccessToken({ sub: subject.id, role: subject.role, tid: subject.tenantId });
  return { accessToken, expiresIn: env.ACCESS_TOKEN_TTL_SECONDS, refreshToken: refresh.token, refreshExpiresAt };
}

const revokeFamily = (familyId: string) =>
  prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });

export async function loginSuperAdmin(email: string, password: string) {
  const admin = await prisma.superAdmin.findUnique({ where: { email: email.toLowerCase() } });
  const ok = await verifyPassword(admin?.passwordHash, password);
  if (!admin || !ok || !admin.isActive) throw unauthorized("Credenciales inválidas");
  const session = await issueSession({ type: "SUPER_ADMIN", id: admin.id, role: "super_admin" });
  return { session, user: { id: admin.id, email: admin.email, name: admin.name, role: "super_admin" as const } };
}

export async function loginTenantUser(tenantSlug: string, email: string, password: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  const user = tenant
    ? await prisma.tenantUser.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email: email.toLowerCase() } } })
    : null;
  const ok = await verifyPassword(user?.passwordHash, password);
  if (!tenant || !user || !ok || !user.isActive || tenant.deletedAt) throw unauthorized("Credenciales inválidas");
  if (tenant.status !== "ACTIVE") throw unauthorized("Cuenta suspendida. Contacta al administrador");
  const role: Role = user.role === "TENANT_ADMIN" ? "tenant_admin" : "tenant_staff";
  const session = await issueSession({ type: "TENANT_USER", id: user.id, role, tenantId: tenant.id });
  return {
    session,
    user: { id: user.id, email: user.email, name: user.name, role, tenantId: tenant.id, storeId: user.storeId },
  };
}

/** "Café Aurora" → "cafe-aurora". Siempre devuelve un identificador válido de 3 a 34 caracteres. */
export function slugFromName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 34)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : "negocio";
}

async function freeSlug(name: string): Promise<string> {
  const base = slugFromName(name);
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 34)}-${randomUUID().slice(0, 4)}`;
    if (!(await prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  throw new Error("No se pudo generar un identificador libre");
}

/**
 * Alta de un negocio por su cuenta: queda en prueba gratis (TRIAL) por TRIAL_DAYS días y el que lo
 * registra es su administrador. Al terminar la prueba el panel pide elegir un plan.
 */
export async function registerTenant(input: { businessName: string; adminName: string; email: string; password: string }, ip?: string) {
  const passwordHash = await hashPassword(input.password);
  const slug = await freeSlug(input.businessName);
  const trialEndsAt = new Date(Date.now() + env.TRIAL_DAYS * 86_400_000);
  const { tenant, user } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: input.businessName, slug, plan: "TRIAL", status: "ACTIVE", subscriptionEndsAt: trialEndsAt },
    });
    const user = await tx.tenantUser.create({
      data: { tenantId: tenant.id, email: input.email.toLowerCase(), name: input.adminName, passwordHash, role: "TENANT_ADMIN" },
    });
    await tx.auditLog.create({
      data: { tenantId: tenant.id, actorType: "TENANT_USER", actorId: user.id, action: "tenant.self_register", targetType: "tenant", targetId: tenant.id, ip },
    });
    return { tenant, user };
  });
  const session = await issueSession({ type: "TENANT_USER", id: user.id, role: "tenant_admin", tenantId: tenant.id });
  return {
    session,
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    trialEndsAt,
    user: { id: user.id, email: user.email, name: user.name, role: "tenant_admin" as const, tenantId: tenant.id, storeId: user.storeId },
  };
}

async function loadSubject(type: SubjectType, id: string): Promise<Subject | null> {
  if (type === "SUPER_ADMIN") {
    const a = await prisma.superAdmin.findUnique({ where: { id } });
    return a?.isActive ? { type, id, role: "super_admin" } : null;
  }
  if (type === "TENANT_USER") {
    const u = await prisma.tenantUser.findUnique({ where: { id }, include: { tenant: true } });
    if (!u || !u.isActive || u.tenant.status !== "ACTIVE" || u.tenant.deletedAt) return null;
    return { type, id, role: u.role === "TENANT_ADMIN" ? "tenant_admin" : "tenant_staff", tenantId: u.tenantId };
  }
  return null;
}

/** Rota el refresh token. Reutilizar uno ya rotado revoca toda la familia. */
export async function refreshSession(token: string): Promise<Session> {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row) throw unauthorized("Sesión inválida");

  if (row.revokedAt) {
    await revokeFamily(row.familyId);
    throw unauthorized("Sesión inválida");
  }
  if (row.expiresAt <= new Date()) throw unauthorized("Sesión expirada");

  const claimed = await prisma.refreshToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (claimed.count === 0) {
    await revokeFamily(row.familyId);
    throw unauthorized("Sesión inválida");
  }

  const subject = await loadSubject(row.subjectType, row.subjectId);
  if (!subject) {
    await revokeFamily(row.familyId);
    throw unauthorized("Sesión inválida");
  }
  return issueSession(subject, row.familyId);
}

export async function logout(token: string | undefined) {
  if (!token) return;
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (row) await revokeFamily(row.familyId);
}

export async function getProfile(userId: string, role: Role) {
  if (role === "super_admin") {
    const a = await prisma.superAdmin.findUnique({ where: { id: userId } });
    if (!a || !a.isActive) throw unauthorized();
    return { id: a.id, email: a.email, name: a.name, role };
  }
  const u = await prisma.tenantUser.findUnique({ where: { id: userId }, include: { tenant: true } });
  if (!u || !u.isActive || u.tenant.status !== "ACTIVE") throw unauthorized();
  const t = u.tenant;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role,
    storeId: u.storeId,
    tenant: {
      id: t.id,
      name: t.name,
      slug: t.slug,
      logoUrl: t.logoUrl,
      primaryColor: t.primaryColor,
      secondaryColor: t.secondaryColor,
      themeMode: t.themeMode,
    },
    subscription: subscriptionState(t),
  };
}
