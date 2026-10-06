import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app, loginTenant, makeCoupon, makeStaff, makeSuperAdmin, makeTenant, PASSWORD, PNG_1PX, prisma, resetDb } from "./helpers.js";

let A: { tenant: { id: string }; user: { id: string } };
let B: { tenant: { id: string }; user: { id: string } };
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

describe("acceso", () => {
  it("exige token de tenant; super admin no entra", async () => {
    expect((await request(app).get("/tenant/rewards")).status).toBe(401);
    await makeSuperAdmin();
    const sa = await request(app).post("/auth/super-admin/login").send({ email: "root@kairos.test", password: PASSWORD });
    expect((await request(app).get("/tenant/rewards").set("Authorization", `Bearer ${sa.body.accessToken}`)).status).toBe(403);
  });

  it("suspender bloquea al instante aunque el access token siga vigente", async () => {
    expect((await request(app).get("/tenant/rewards").set(a.h)).status).toBe(200);
    await prisma.tenant.update({ where: { id: A.tenant.id }, data: { status: "SUSPENDED" } });
    const res = await request(app).get("/tenant/rewards").set(a.h);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/suspendida/i);
  });

  it("staff lee pero no modifica marca ni premios", async () => {
    const staff = await makeStaff(A.tenant.id, "a");
    const s = await loginTenant("a", staff.email);
    expect((await request(app).get("/tenant/rewards").set(s.h)).status).toBe(200);
    expect((await request(app).get("/tenant/brand").set(s.h)).status).toBe(200);
    expect((await request(app).patch("/tenant/brand").set(s.h).send({ primaryColor: "#112233" })).status).toBe(403);
    expect((await request(app).post("/tenant/rewards").set(s.h).send({ title: "Hack", pointsCost: 1 })).status).toBe(403);
    expect((await request(app).post("/tenant/uploads").set(s.h).attach("file", PNG_1PX, "a.png")).status).toBe(403);
  });
});

describe("marca", () => {
  it("lee y actualiza colores; valida hex", async () => {
    const ok = await request(app).patch("/tenant/brand").set(a.h).send({ primaryColor: "#112233", themeMode: "DARK", secondaryColor: null });
    expect(ok.status).toBe(200);
    expect(ok.body.primaryColor).toBe("#112233");
    expect((await request(app).get("/tenant/brand").set(a.h)).body.themeMode).toBe("DARK");
    expect((await request(app).patch("/tenant/brand").set(a.h).send({ primaryColor: "rojo" })).status).toBe(400);
    expect((await request(app).patch("/tenant/brand").set(a.h).send({ status: "ACTIVE" })).status).toBe(400);
  });

  it("no toca la marca de otro tenant", async () => {
    await request(app).patch("/tenant/brand").set(a.h).send({ primaryColor: "#111111" });
    expect((await request(app).get("/tenant/brand").set(b.h)).body.primaryColor).toBe("#7C3AED");
  });

  it("sube un logo PNG y lo asocia; rechaza URL ajenas", async () => {
    const up = await request(app).post("/tenant/uploads").set(a.h).attach("file", PNG_1PX, { filename: "logo.png", contentType: "image/png" });
    expect(up.status).toBe(201);
    expect(up.body.url).toContain(`/uploads/${A.tenant.id}/`);

    const set = await request(app).patch("/tenant/brand").set(a.h).send({ logoUrl: up.body.url });
    expect(set.status).toBe(200);
    // URL de otro tenant o externa
    expect((await request(app).patch("/tenant/brand").set(b.h).send({ logoUrl: up.body.url })).status).toBe(400);
    expect((await request(app).patch("/tenant/brand").set(a.h).send({ logoUrl: "https://evil.example/x.png" })).status).toBe(400);

    const path = new URL(up.body.url).pathname;
    const file = await request(app).get(path);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toBe("image/png");
    expect(file.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  it("rechaza SVG, archivos que fingen ser imagen y archivos grandes", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect((await request(app).post("/tenant/uploads").set(a.h).attach("file", svg, { filename: "x.svg", contentType: "image/svg+xml" })).status).toBe(415);
    expect((await request(app).post("/tenant/uploads").set(a.h).attach("file", svg, { filename: "x.png", contentType: "image/png" })).status).toBe(415);
    const big = Buffer.concat([PNG_1PX, Buffer.alloc(1024 * 1024 + 10)]);
    expect((await request(app).post("/tenant/uploads").set(a.h).attach("file", big, { filename: "big.png", contentType: "image/png" })).status).toBe(413);
    expect((await request(app).post("/tenant/uploads").set(a.h)).status).toBe(400);
  });
});

describe("premios", () => {
  it("crea, lista, edita y borra (lógico)", async () => {
    const created = await request(app).post("/tenant/rewards").set(a.h).send({ title: "Galleta", pointsCost: 80, stock: 5, description: "Recién horneada" });
    expect(created.status).toBe(201);
    expect(created.body.tenantId).toBe(A.tenant.id);
    expect(created.body.isActive).toBe(true);

    const id = created.body.id;
    const upd = await request(app).patch(`/tenant/rewards/${id}`).set(a.h).send({ pointsCost: 90, stock: null, isActive: false });
    expect(upd.body).toMatchObject({ pointsCost: 90, stock: null, isActive: false });

    expect((await request(app).delete(`/tenant/rewards/${id}`).set(a.h)).status).toBe(204);
    expect((await request(app).get("/tenant/rewards").set(a.h)).body.data).toEqual([]);
    expect(await prisma.reward.count({ where: { id } })).toBe(1); // sigue en la base
    expect((await request(app).patch(`/tenant/rewards/${id}`).set(a.h).send({ title: "x1" })).status).toBe(404);
  });

  it("valida costo, stock y título", async () => {
    for (const bad of [{ title: "x", pointsCost: 10 }, { title: "Ok", pointsCost: 0 }, { title: "Ok", pointsCost: 1.5 }, { title: "Ok", pointsCost: 5, stock: -1 }, { title: "Ok", pointsCost: 5, tenantId: B.tenant.id }]) {
      expect((await request(app).post("/tenant/rewards").set(a.h).send(bad)).status).toBe(400);
    }
  });

  it("el tenant B no ve, edita ni borra premios de A", async () => {
    const r = (await request(app).post("/tenant/rewards").set(a.h).send({ title: "Solo de A", pointsCost: 10 })).body;
    expect((await request(app).get("/tenant/rewards").set(b.h)).body.data).toEqual([]);
    expect((await request(app).patch(`/tenant/rewards/${r.id}`).set(b.h).send({ title: "Robado" })).status).toBe(404);
    expect((await request(app).delete(`/tenant/rewards/${r.id}`).set(b.h)).status).toBe(404);
    expect((await prisma.reward.findUniqueOrThrow({ where: { id: r.id } })).title).toBe("Solo de A");
  });

  it("la imagen del premio debe ser propia", async () => {
    const up = await request(app).post("/tenant/uploads").set(a.h).attach("file", PNG_1PX, { filename: "p.png", contentType: "image/png" });
    const ok = await request(app).post("/tenant/rewards").set(a.h).send({ title: "Con foto", pointsCost: 10, imageUrl: up.body.url });
    expect(ok.status).toBe(201);
    const bad = await request(app).post("/tenant/rewards").set(b.h).send({ title: "Foto ajena", pointsCost: 10, imageUrl: up.body.url });
    expect(bad.status).toBe(400);
  });
});

describe("caja: cupones", () => {
  it("consulta un cupón sin exponer al cliente y lo canjea", async () => {
    await makeCoupon(A.tenant.id, "ABC234");
    const look = await request(app).get("/tenant/coupons/by-code/abc-234").set(a.h);
    expect(look.status).toBe(200);
    expect(look.body).toMatchObject({ code: "ABC234", status: "PENDING", rewardTitle: "Café gratis" });
    expect(JSON.stringify(look.body)).not.toMatch(/cliente@example|consumer|wallet/i);

    const red = await request(app).post("/tenant/coupons/by-code/ABC234/redeem").set(a.h);
    expect(red.status).toBe(200);
    expect(red.body.status).toBe("REDEEMED");
    const row = await prisma.coupon.findFirstOrThrow({ where: { code: "ABC234" } });
    expect(row.redeemedById).toBe(A.user.id);
  });

  it("segundo canje da 409 con motivo", async () => {
    await makeCoupon(A.tenant.id, "ABC234");
    await request(app).post("/tenant/coupons/by-code/ABC234/redeem").set(a.h);
    const again = await request(app).post("/tenant/coupons/by-code/ABC234/redeem").set(a.h);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("coupon_redeemed");
  });

  it("dos cajeros a la vez: solo uno canjea", async () => {
    await makeCoupon(A.tenant.id, "RACE22");
    const staff = await makeStaff(A.tenant.id, "a");
    const s = await loginTenant("a", staff.email);
    const results = await Promise.all([
      request(app).post("/tenant/coupons/by-code/RACE22/redeem").set(a.h),
      request(app).post("/tenant/coupons/by-code/RACE22/redeem").set(s.h),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("cupón vencido se ve como EXPIRED y no se canjea", async () => {
    await makeCoupon(A.tenant.id, "OLD234", { expiresInMs: -1000 });
    expect((await request(app).get("/tenant/coupons/by-code/OLD234").set(a.h)).body.status).toBe("EXPIRED");
    const red = await request(app).post("/tenant/coupons/by-code/OLD234/redeem").set(a.h);
    expect(red.status).toBe(409);
    expect(red.body.error.code).toBe("coupon_expired");
  });

  it("código inexistente da 404", async () => {
    expect((await request(app).get("/tenant/coupons/by-code/NOPE999").set(a.h)).status).toBe(404);
    expect((await request(app).post("/tenant/coupons/by-code/NOPE999/redeem").set(a.h)).status).toBe(404);
  });

  it("un cupón de A no se consulta ni canjea desde B", async () => {
    await makeCoupon(A.tenant.id, "ONLYA2");
    expect((await request(app).get("/tenant/coupons/by-code/ONLYA2").set(b.h)).status).toBe(404);
    expect((await request(app).post("/tenant/coupons/by-code/ONLYA2/redeem").set(b.h)).status).toBe(404);
    expect((await prisma.coupon.findFirstOrThrow({ where: { code: "ONLYA2" } })).status).toBe("PENDING");
  });

  it("lista canjes recientes con quién los entregó", async () => {
    await makeCoupon(A.tenant.id, "ABC234");
    await request(app).post("/tenant/coupons/by-code/ABC234/redeem").set(a.h);
    const list = await request(app).get("/tenant/coupons?status=REDEEMED").set(a.h);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].redeemedBy).toBe("Owner");
    expect((await request(app).get("/tenant/coupons?status=REDEEMED").set(b.h)).body.data).toEqual([]);
  });
});
