import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app, makeSuperAdmin, makeTenant, PASSWORD, prisma, resetDb } from "./helpers.js";

let token: string;

beforeEach(async () => {
  await resetDb();
  await makeSuperAdmin();
  const res = await request(app).post("/auth/super-admin/login").send({ email: "root@kairos.test", password: PASSWORD });
  token = res.body.accessToken;
});
afterAll(() => prisma.$disconnect());

const auth = () => ({ Authorization: `Bearer ${token}` });

describe("CRUD de tenants (super admin)", () => {
  it("exige autenticación", async () => {
    expect((await request(app).get("/admin/tenants")).status).toBe(401);
  });

  it("crea un tenant con su administrador y puede iniciar sesión", async () => {
    const res = await request(app)
      .post("/admin/tenants")
      .set(auth())
      .send({
        name: "Cafetería X",
        slug: "cafeteria-x",
        primaryColor: "#112233",
        admin: { email: "Dueno@X.com", name: "Dueño", password: "una-clave-larga-123" },
      });
    expect(res.status).toBe(201);
    expect(res.body.primaryColor).toBe("#112233");

    const login = await request(app)
      .post("/auth/tenant/login")
      .send({ tenantSlug: "cafeteria-x", email: "dueno@x.com", password: "una-clave-larga-123" });
    expect(login.status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: "tenant.create" } })).toBe(1);
  });

  it("rechaza slug repetido, slug inválido y color inválido", async () => {
    await makeTenant("cafe");
    const dup = await request(app).post("/admin/tenants").set(auth()).send({ name: "Otro", slug: "cafe" });
    expect(dup.status).toBe(409);
    const badSlug = await request(app).post("/admin/tenants").set(auth()).send({ name: "Otro", slug: "Mal Slug!" });
    expect(badSlug.status).toBe(400);
    const badColor = await request(app).post("/admin/tenants").set(auth()).send({ name: "Otro", slug: "otro", primaryColor: "red" });
    expect(badColor.status).toBe(400);
  });

  it("lista con filtro y paginación", async () => {
    await makeTenant("uno");
    await makeTenant("dos", { status: "SUSPENDED" });
    const all = await request(app).get("/admin/tenants").set(auth());
    expect(all.body.total).toBe(2);
    const susp = await request(app).get("/admin/tenants?status=SUSPENDED").set(auth());
    expect(susp.body.data.map((t: { slug: string }) => t.slug)).toEqual(["dos"]);
  });

  it("edita campos permitidos y rechaza campos desconocidos", async () => {
    const { tenant } = await makeTenant("cafe");
    const ok = await request(app).patch(`/admin/tenants/${tenant.id}`).set(auth()).send({ name: "Nuevo nombre", plan: "PRO" });
    expect(ok.status).toBe(200);
    expect(ok.body.plan).toBe("PRO");
    const bad = await request(app).patch(`/admin/tenants/${tenant.id}`).set(auth()).send({ status: "ACTIVE", slug: "x" });
    expect(bad.status).toBe(400);
  });

  it("id inexistente devuelve 404 y id malformado 400", async () => {
    expect((await request(app).get("/admin/tenants/8f0f0c0e-0000-4000-8000-000000000000").set(auth())).status).toBe(404);
    expect((await request(app).get("/admin/tenants/no-uuid").set(auth())).status).toBe(400);
  });

  it("suspender revoca sesiones y bloquea el login; reactivar lo restaura", async () => {
    const { tenant } = await makeTenant("cafe");
    const creds = { tenantSlug: "cafe", email: "owner@cafe.test", password: PASSWORD };
    const a = request.agent(app);
    expect((await a.post("/auth/tenant/login").send(creds)).status).toBe(200);

    const susp = await request(app).post(`/admin/tenants/${tenant.id}/suspend`).set(auth());
    expect(susp.body.status).toBe("SUSPENDED");
    expect((await a.post("/auth/refresh")).status).toBe(401);
    expect((await request(app).post("/auth/tenant/login").send(creds)).status).toBe(401);

    const act = await request(app).post(`/admin/tenants/${tenant.id}/activate`).set(auth());
    expect(act.body.status).toBe("ACTIVE");
    expect((await request(app).post("/auth/tenant/login").send(creds)).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: { in: ["tenant.suspend", "tenant.activate"] } } })).toBe(2);
  });
});

describe("API general", () => {
  it("health, 404 y JSON inválido", async () => {
    expect((await request(app).get("/health")).body).toEqual({ status: "ok" });
    expect((await request(app).get("/nada")).status).toBe(404);
    const bad = await request(app).post("/auth/super-admin/login").set("Content-Type", "application/json").send("{mal");
    expect(bad.status).toBe(400);
  });

  it("CORS solo permite orígenes de la lista", async () => {
    const ok = await request(app).get("/health").set("Origin", "http://localhost:5173");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    const no = await request(app).get("/health").set("Origin", "https://evil.example");
    expect(no.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("incluye cabeceras de seguridad de helmet", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
