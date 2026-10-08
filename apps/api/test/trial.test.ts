import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { slugFromName } from "../src/modules/auth/auth.service.js";
import { agent, app, loginTenant, makeStaff, makeSuperAdmin, PASSWORD, prisma, refreshCookie, resetDb } from "./helpers.js";
import { qr, setup } from "./qr-helpers.js";
import { signConsumerToken } from "../src/lib/consumer-tokens.js";

const body = (over: Record<string, unknown> = {}) => ({
  businessName: "Café Aurora",
  adminName: "Ana Pérez",
  email: "ana@aurora.test",
  password: "una-clave-larga-123",
  ...over,
});
const register = (over: Record<string, unknown> = {}) => request(app).post("/auth/register").send(body(over));
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const expire = (slug: string) => prisma.tenant.update({ where: { slug }, data: { subscriptionEndsAt: new Date(Date.now() - 1000) } });

beforeEach(resetDb);

describe("registro con prueba gratis", () => {
  it("crea el negocio en TRIAL, a su administrador y abre sesión", async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.tenant).toMatchObject({ name: "Café Aurora", slug: "cafe-aurora" });
    expect(res.body.user).toMatchObject({ email: "ana@aurora.test", role: "tenant_admin" });
    expect(refreshCookie(res)).toBeTruthy();

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "cafe-aurora" } });
    expect(tenant).toMatchObject({ plan: "TRIAL", status: "ACTIVE", requestedPlan: null });
    const days = ((tenant.subscriptionEndsAt?.getTime() ?? 0) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThan(14.1);
    expect(await prisma.tenantUser.count({ where: { tenantId: tenant.id, role: "TENANT_ADMIN" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "tenant.self_register", tenantId: tenant.id } })).toBe(1);
  });

  it("la sesión devuelta ya sirve para entrar al panel y para /auth/me", async () => {
    const res = await register();
    const h = bearer(res.body.accessToken);
    expect((await request(app).get("/tenant/stores").set(h)).status).toBe(200);
    const me = await request(app).get("/auth/me").set(h);
    expect(me.body.subscription).toMatchObject({ plan: "TRIAL", expired: false, onTrial: true, requestedPlan: null });
    expect(me.body.subscription.daysLeft).toBe(14);
  });

  it("después puede iniciar sesión con su identificador, correo y contraseña", async () => {
    const res = await register();
    const login = await request(app).post("/auth/tenant/login").send({ tenantSlug: res.body.tenant.slug, email: "ana@aurora.test", password: "una-clave-larga-123" });
    expect(login.status).toBe(200);
  });

  it("dos negocios con el mismo nombre reciben identificadores distintos", async () => {
    const a = await register();
    const b = await register({ email: "otro@aurora.test" });
    expect(a.body.tenant.slug).toBe("cafe-aurora");
    expect(b.status).toBe(201);
    expect(b.body.tenant.slug).not.toBe("cafe-aurora");
    expect(b.body.tenant.slug).toMatch(/^cafe-aurora-[0-9a-f]{4}$/);
  });

  it("rechaza datos inválidos y campos de más", async () => {
    for (const bad of [
      { password: "corta" },
      { email: "no-es-correo" },
      { businessName: "A" },
      { adminName: "" },
      { plan: "PRO" },
      { tenantId: "x" },
    ]) {
      expect((await register(bad)).status).toBe(400);
    }
    expect(await prisma.tenant.count()).toBe(0);
  });

  it("limita los registros por conexión", async () => {
    const limited = createApp({ rateLimit: true });
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      statuses.push((await request(limited).post("/auth/register").send(body({ businessName: `Negocio ${i}`, email: `n${i}@x.test` }))).status);
    }
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });

  it("slugFromName siempre da un identificador válido", () => {
    expect(slugFromName("Café Aurora")).toBe("cafe-aurora");
    expect(slugFromName("  ¡Tacos El Güero!  ")).toBe("tacos-el-guero");
    expect(slugFromName("A")).toBe("negocio");
    expect(slugFromName("🎮🎮🎮")).toBe("negocio");
    const long = slugFromName("x".repeat(80));
    expect(long.length).toBeLessThanOrEqual(34);
    expect(long).toMatch(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/);
  });
});

describe("cuando termina la prueba", () => {
  it("el panel se bloquea con 402, pero la suscripción y /auth/me siguen disponibles", async () => {
    const res = await register();
    await expire("cafe-aurora");
    const h = bearer(res.body.accessToken);

    for (const path of ["/tenant/stores", "/tenant/rewards", "/tenant/machines", "/tenant/coupons"]) {
      const r = await request(app).get(path).set(h);
      expect(r.status).toBe(402);
      expect(r.body.error.code).toBe("subscription_required");
    }
    const sub = await request(app).get("/tenant/subscription").set(h);
    expect(sub.status).toBe(200);
    expect(sub.body).toMatchObject({ expired: true, daysLeft: 0, plan: "TRIAL" });
    const me = await request(app).get("/auth/me").set(h);
    expect(me.status).toBe(200);
    expect(me.body.subscription.expired).toBe(true);
  });

  it("el personal de caja también queda bloqueado", async () => {
    const res = await register();
    await makeStaff(res.body.tenant.id, "cafe-aurora");
    await expire("cafe-aurora");
    const caja = await loginTenant("cafe-aurora", "staff@cafe-aurora.test");
    expect((await request(app).get("/tenant/coupons").set(caja.h)).status).toBe(402);
  });

  it("pide un plan: queda registrado y se puede cambiar de opinión", async () => {
    const res = await register();
    await expire("cafe-aurora");
    const h = bearer(res.body.accessToken);
    const first = await request(app).post("/tenant/subscription/request").set(h).send({ plan: "BASIC" });
    expect(first.status).toBe(201);
    expect(first.body.requestedPlan).toBe("BASIC");
    const second = await request(app).post("/tenant/subscription/request").set(h).send({ plan: "PRO" });
    expect(second.body.requestedPlan).toBe("PRO");
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "cafe-aurora" } });
    expect(tenant.requestedPlan).toBe("PRO");
    expect(tenant.planRequestedAt).toBeTruthy();
    expect(await prisma.auditLog.count({ where: { action: "tenant.plan_request" } })).toBe(2);
  });

  it("no se puede pedir TRIAL ni un plan inventado, ni lo pide el personal de caja", async () => {
    const res = await register();
    const h = bearer(res.body.accessToken);
    expect((await request(app).post("/tenant/subscription/request").set(h).send({ plan: "TRIAL" })).status).toBe(400);
    expect((await request(app).post("/tenant/subscription/request").set(h).send({ plan: "GRATIS" })).status).toBe(400);
    await makeStaff(res.body.tenant.id, "cafe-aurora");
    const caja = await loginTenant("cafe-aurora", "staff@cafe-aurora.test");
    expect((await request(app).post("/tenant/subscription/request").set(caja.h).send({ plan: "BASIC" })).status).toBe(403);
  });

  it("el Super Admin activa el plan, se atiende la solicitud y el panel vuelve a funcionar", async () => {
    const res = await register();
    await expire("cafe-aurora");
    const h = bearer(res.body.accessToken);
    await request(app).post("/tenant/subscription/request").set(h).send({ plan: "BASIC" });

    await makeSuperAdmin();
    const sa = await agent().post("/auth/super-admin/login").send({ email: "root@kairos.test", password: PASSWORD });
    const sh = bearer(sa.body.accessToken);
    const list = await request(app).get("/admin/tenants").set(sh);
    expect(list.body.data[0]).toMatchObject({ slug: "cafe-aurora", requestedPlan: "BASIC" });

    const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString();
    const patch = await request(app).patch(`/admin/tenants/${res.body.tenant.id}`).set(sh).send({ plan: "BASIC", subscriptionEndsAt: nextYear });
    expect(patch.status).toBe(200);
    expect(patch.body).toMatchObject({ plan: "BASIC", requestedPlan: null, planRequestedAt: null });

    expect((await request(app).get("/tenant/stores").set(h)).status).toBe(200);
    const sub = await request(app).get("/tenant/subscription").set(h);
    expect(sub.body).toMatchObject({ plan: "BASIC", expired: false, onTrial: false });
  });

  it("los negocios sin fecha de vencimiento no vencen nunca", async () => {
    const res = await register();
    await prisma.tenant.update({ where: { slug: "cafe-aurora" }, data: { subscriptionEndsAt: null } });
    const h = bearer(res.body.accessToken);
    expect((await request(app).get("/tenant/stores").set(h)).status).toBe(200);
    expect((await request(app).get("/tenant/subscription").set(h)).body).toMatchObject({ expired: false, daysLeft: null, endsAt: null });
  });

  it("las máquinas dejan de entregar recompensas y puntos", async () => {
    const rig = await setup();
    const consumer = await prisma.consumer.create({ data: { email: "c@example.com" } });
    const auth = bearer(await signConsumerToken(consumer.id));
    await prisma.tenant.update({ where: { id: rig.tenant.id }, data: { subscriptionEndsAt: new Date(Date.now() - 1000) } });
    const res = await request(app).post("/wallet/claims").set(auth).send({ qr: await qr(rig) });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("subscription_expired");
    expect(await prisma.qrClaim.count()).toBe(0);
  });
});
