import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app, keyPair, loginTenant, makeStaff, makeTenant, PASSWORD, prisma, refreshCookie, resetDb } from "./helpers.js";

let A: Awaited<ReturnType<typeof makeTenant>>;
let B: Awaited<ReturnType<typeof makeTenant>>;
let a: { h: Record<string, string> };
let b: { h: Record<string, string> };

beforeEach(async () => {
  await resetDb();
  A = await makeTenant("a");
  B = await makeTenant("b");
  a = await loginTenant("a");
  b = await loginTenant("b");
});
afterAll(() => prisma.$disconnect());

const mkStore = async (h: Record<string, string>, name = "Sucursal Centro") =>
  (await request(app).post("/tenant/stores").set(h).send({ name, address: "Av. 1" })).body;

describe("sucursales", () => {
  it("crea, lista y edita; aislada por tenant", async () => {
    const s = await mkStore(a.h);
    expect(s.tenantId).toBe(A.tenant.id);
    expect((await request(app).get("/tenant/stores").set(a.h)).body.data).toHaveLength(1);
    expect((await request(app).get("/tenant/stores").set(b.h)).body.data).toEqual([]);
    const upd = await request(app).patch(`/tenant/stores/${s.id}`).set(a.h).send({ name: "Sucursal Norte", isActive: false });
    expect(upd.body).toMatchObject({ name: "Sucursal Norte", isActive: false });
    expect((await request(app).patch(`/tenant/stores/${s.id}`).set(b.h).send({ name: "Robada" })).status).toBe(404);
  });

  it("solo el administrador modifica", async () => {
    const staff = await makeStaff(A.tenant.id, "a");
    const s = await loginTenant("a", staff.email);
    expect((await request(app).get("/tenant/stores").set(s.h)).status).toBe(200);
    expect((await request(app).post("/tenant/stores").set(s.h).send({ name: "Otra" })).status).toBe(403);
  });
});

describe("máquinas", () => {
  it("registra una llave pública ES256 y no devuelve la llave", async () => {
    const store = await mkStore(a.h);
    const k = keyPair("ec");
    const res = await request(app).post("/tenant/machines").set(a.h).send({ storeId: store.id, label: "Arcade mostrador", publicKey: k.pub });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "ACTIVE", keyAlgorithm: "ES256", storeId: store.id });
    expect(JSON.stringify(res.body)).not.toMatch(/BEGIN|publicKey/);
    const row = await prisma.machine.findFirstOrThrow();
    expect(row.publicKey).toContain("BEGIN PUBLIC KEY");
  });

  it("acepta Ed25519 y rechaza llaves privadas, RSA, algoritmo cruzado y basura", async () => {
    const store = await mkStore(a.h);
    const send = (body: object) => request(app).post("/tenant/machines").set(a.h).send({ storeId: store.id, label: "M1", ...body });
    expect((await send({ keyAlgorithm: "EDDSA", publicKey: keyPair("ed25519").pub })).status).toBe(201);
    const priv = await send({ publicKey: keyPair("ec").priv });
    expect(priv.status).toBe(400);
    expect(priv.body.error.code).toBe("private_key_rejected");
    expect((await send({ publicKey: keyPair("rsa").pub })).status).toBe(400);
    expect((await send({ keyAlgorithm: "EDDSA", publicKey: keyPair("ec").pub })).status).toBe(400);
    expect((await send({ publicKey: "-----BEGIN PUBLIC KEY-----\nbasura-basura-basura-basura-basura\n-----END PUBLIC KEY-----" })).status).toBe(400);
  });

  it("no registra máquinas en sucursales de otro tenant", async () => {
    const storeB = await mkStore(b.h, "De B");
    const res = await request(app).post("/tenant/machines").set(a.h).send({ storeId: storeB.id, label: "M1", publicKey: keyPair("ec").pub });
    expect(res.status).toBe(404);
    expect(await prisma.machine.count()).toBe(0);
  });

  it("revoca (definitivo) y B no puede revocar la de A", async () => {
    const store = await mkStore(a.h);
    const m = (await request(app).post("/tenant/machines").set(a.h).send({ storeId: store.id, label: "M1", publicKey: keyPair("ec").pub })).body;
    expect((await request(app).post(`/tenant/machines/${m.id}/revoke`).set(b.h)).status).toBe(404);
    const rev = await request(app).post(`/tenant/machines/${m.id}/revoke`).set(a.h);
    expect(rev.body.status).toBe("REVOKED");
    expect(rev.body.revokedAt).toBeTruthy();
    expect((await request(app).get("/tenant/machines").set(b.h)).body.data).toEqual([]);
  });
});

describe("personal de caja", () => {
  it("crea personal que puede iniciar sesión pero no administrar", async () => {
    const res = await request(app).post("/tenant/staff").set(a.h).send({ name: "Luis Caja", email: "Luis@A.test", password: "clave-larga-123" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ role: "TENANT_STAFF", email: "luis@a.test", isActive: true });
    expect(JSON.stringify(res.body)).not.toMatch(/hash|password/i);

    const login = await request(app).post("/auth/tenant/login").send({ tenantSlug: "a", email: "luis@a.test", password: "clave-larga-123" });
    expect(login.status).toBe(200);
    const h = { Authorization: `Bearer ${login.body.accessToken}` };
    expect((await request(app).get("/tenant/staff").set(h)).status).toBe(403);
    expect((await request(app).get("/tenant/rewards").set(h)).status).toBe(200);
  });

  it("no crea con correo repetido ni con sucursal ajena", async () => {
    const body = { name: "Luis Caja", email: "luis@a.test", password: "clave-larga-123" };
    expect((await request(app).post("/tenant/staff").set(a.h).send(body)).status).toBe(201);
    expect((await request(app).post("/tenant/staff").set(a.h).send(body)).status).toBe(409);
    const storeB = await mkStore(b.h, "De B");
    expect((await request(app).post("/tenant/staff").set(a.h).send({ ...body, email: "otro@a.test", storeId: storeB.id })).status).toBe(404);
  });

  it("solo lista y edita al personal de su tenant, nunca administradores", async () => {
    const staffB = await makeStaff(B.tenant.id, "b");
    expect((await request(app).get("/tenant/staff").set(a.h)).body.data.map((u: { email: string }) => u.email)).toEqual(["owner@a.test"]);
    expect((await request(app).patch(`/tenant/staff/${staffB.id}`).set(a.h).send({ name: "Robado" })).status).toBe(404);
    expect((await request(app).patch(`/tenant/staff/${A.user.id}`).set(a.h).send({ isActive: false })).status).toBe(403);
    expect((await prisma.tenantUser.findUniqueOrThrow({ where: { id: A.user.id } })).isActive).toBe(true);
  });

  it("desactivar cierra el acceso al instante, incluso con access token vigente", async () => {
    const staff = await makeStaff(A.tenant.id, "a");
    const agent = request.agent(app);
    const login = await agent.post("/auth/tenant/login").send({ tenantSlug: "a", email: staff.email, password: PASSWORD });
    const h = { Authorization: `Bearer ${login.body.accessToken}` };
    expect((await request(app).get("/tenant/rewards").set(h)).status).toBe(200);
    expect(refreshCookie(login)).toBeTruthy();

    const off = await request(app).patch(`/tenant/staff/${staff.id}`).set(a.h).send({ isActive: false });
    expect(off.body.isActive).toBe(false);
    expect((await request(app).get("/tenant/rewards").set(h)).status).toBe(401);
    expect((await agent.post("/auth/refresh")).status).toBe(401);
    expect((await request(app).post("/auth/tenant/login").send({ tenantSlug: "a", email: staff.email, password: PASSWORD })).status).toBe(401);
  });

  it("restablece la contraseña y cierra sesiones", async () => {
    const staff = await makeStaff(A.tenant.id, "a");
    const agent = request.agent(app);
    await agent.post("/auth/tenant/login").send({ tenantSlug: "a", email: staff.email, password: PASSWORD });
    await request(app).patch(`/tenant/staff/${staff.id}`).set(a.h).send({ password: "nueva-clave-segura-1" });
    expect((await agent.post("/auth/refresh")).status).toBe(401);
    expect((await request(app).post("/auth/tenant/login").send({ tenantSlug: "a", email: staff.email, password: PASSWORD })).status).toBe(401);
    expect((await request(app).post("/auth/tenant/login").send({ tenantSlug: "a", email: staff.email, password: "nueva-clave-segura-1" })).status).toBe(200);
    expect((await request(app).patch(`/tenant/staff/${staff.id}`).set(a.h).send({ password: "corta" })).status).toBe(400);
  });
});

describe("marca pública para la máquina", () => {
  it("devuelve solo marca, sin autenticación", async () => {
    await request(app).patch("/tenant/brand").set(a.h).send({ primaryColor: "#112233" });
    const s = await mkStore(a.h);
    const res = await request(app).get(`/public/stores/${s.id}/brand`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ storeName: "Sucursal Centro", name: "Tenant a", primaryColor: "#112233", themeMode: "AUTO" });
    expect(Object.keys(res.body).sort()).toEqual(["logoUrl", "name", "primaryColor", "secondaryColor", "storeId", "storeName", "themeMode"]);
  });

  it("404 si la sucursal no existe, está inactiva o el negocio está suspendido", async () => {
    const s = await mkStore(a.h);
    expect((await request(app).get("/public/stores/8f0f0c0e-0000-4000-8000-000000000000/brand")).status).toBe(404);
    expect((await request(app).get("/public/stores/no-uuid/brand")).status).toBe(400);
    await request(app).patch(`/tenant/stores/${s.id}`).set(a.h).send({ isActive: false });
    expect((await request(app).get(`/public/stores/${s.id}/brand`)).status).toBe(404);
    await request(app).patch(`/tenant/stores/${s.id}`).set(a.h).send({ isActive: true });
    await prisma.tenant.update({ where: { id: A.tenant.id }, data: { status: "SUSPENDED" } });
    expect((await request(app).get(`/public/stores/${s.id}/brand`)).status).toBe(404);
  });
});
