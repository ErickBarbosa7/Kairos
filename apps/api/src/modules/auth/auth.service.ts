import type { SubjectType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { unauthorized } from "../../lib/errors.js";
import { verifyPassword } from "../../lib/password.js";
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
  };
}
