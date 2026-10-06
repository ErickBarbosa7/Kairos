import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { agent, app, makeSuperAdmin, makeTenant, PASSWORD, prisma, refreshCookie, resetDb } from "./helpers.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("login", () => {
  it("super admin recibe access token y cookie HttpOnly", async () => {
    await makeSuperAdmin();
    const res = await request(app).post("/auth/super-admin/login").send({ email: "root@kairos.test", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.role).toBe("super_admin");
    expect(refreshCookie(res)).toMatch(/HttpOnly/i);
    expect(JSON.stringify(res.body)).not.toMatch(/refresh|hash/i);
  });

  it("rechaza contraseña incorrecta y usuario inexistente con el mismo mensaje", async () => {
    await makeSuperAdmin();
    const bad = await request(app).post("/auth/super-admin/login").send({ email: "root@kairos.test", password: "x".repeat(12) });
    const none = await request(app).post("/auth/super-admin/login").send({ email: "nadie@kairos.test", password: "x".repeat(12) });
    expect(bad.status).toBe(401);
    expect(none.status).toBe(401);
    expect(bad.body).toEqual(none.body);
  });

  it("valida el cuerpo", async () => {
    const res = await request(app).post("/auth/super-admin/login").send({ email: "no-es-correo" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("tenant user inicia sesión con su slug", async () => {
    const { tenant } = await makeTenant("cafe");
    const res = await request(app).post("/auth/tenant/login").send({ tenantSlug: "cafe", email: "owner@cafe.test", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.tenantId).toBe(tenant.id);
    expect(res.body.user.role).toBe("tenant_admin");
  });

  it("no se puede entrar al tenant A con las credenciales de B", async () => {
    await makeTenant("a");
    await makeTenant("b");
    const res = await request(app).post("/auth/tenant/login").send({ tenantSlug: "a", email: "owner@b.test", password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it("tenant suspendido no puede iniciar sesión", async () => {
    await makeTenant("susp", { status: "SUSPENDED" });
    const res = await request(app).post("/auth/tenant/login").send({ tenantSlug: "susp", email: "owner@susp.test", password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/suspendida/i);
  });

  it("limita intentos fallidos de login", async () => {
    const limited = createApp({ rateLimit: true });
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await request(limited).post("/auth/super-admin/login").send({ email: "a@b.com", password: "x".repeat(12) })).status;
    }
    expect(last).toBe(429);
  });
});

describe("/auth/me y roles", () => {
  it("exige token", async () => {
    expect((await request(app).get("/auth/me")).status).toBe(401);
    expect((await request(app).get("/auth/me").set("Authorization", "Bearer basura")).status).toBe(401);
  });

  it("devuelve el perfil con la marca del tenant", async () => {
    await makeTenant("cafe");
    const a = agent();
    const login = await a.post("/auth/tenant/login").send({ tenantSlug: "cafe", email: "owner@cafe.test", password: PASSWORD });
    const me = await a.get("/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.tenant.slug).toBe("cafe");
    expect(me.body.tenant.primaryColor).toBe("#7C3AED");
  });

  it("tenant no accede a rutas de super admin", async () => {
    await makeTenant("cafe");
    const login = await request(app).post("/auth/tenant/login").send({ tenantSlug: "cafe", email: "owner@cafe.test", password: PASSWORD });
    const res = await request(app).get("/admin/tenants").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe("refresh y logout", () => {
  async function loggedAdmin() {
    await makeSuperAdmin();
    const a = agent();
    const login = await a.post("/auth/super-admin/login").send({ email: "root@kairos.test", password: PASSWORD });
    return { a, login };
  }

  it("rota el refresh token y entrega un access nuevo", async () => {
    const { a, login } = await loggedAdmin();
    const first = refreshCookie(login);
    const res = await a.post("/auth/refresh");
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(refreshCookie(res)).not.toBe(first);
  });

  it("reutilizar un refresh ya rotado revoca toda la familia", async () => {
    const { a, login } = await loggedAdmin();
    const stolen = refreshCookie(login)!.split(";")[0]!;
    expect((await a.post("/auth/refresh")).status).toBe(200); // uso legítimo
    const replay = await request(app).post("/auth/refresh").set("Cookie", stolen); // atacante
    expect(replay.status).toBe(401);
    expect((await a.post("/auth/refresh")).status).toBe(401); // el legítimo también cae
  });

  it("logout invalida el refresh token", async () => {
    const { a } = await loggedAdmin();
    expect((await a.post("/auth/logout")).status).toBe(204);
    expect((await a.post("/auth/refresh")).status).toBe(401);
  });

  it("sin cookie no hay refresh", async () => {
    expect((await request(app).post("/auth/refresh")).status).toBe(401);
  });

  it("guarda el hash, no el token", async () => {
    const { login } = await loggedAdmin();
    const raw = refreshCookie(login)!.split(";")[0]!.replace("kairos_rt=", "");
    expect(await prisma.refreshToken.count({ where: { tokenHash: raw } })).toBe(0);
  });
});
