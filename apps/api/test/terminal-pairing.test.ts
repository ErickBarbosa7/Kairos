import { decodeJwt } from "jose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, loginTenant, makeTenant, prisma, resetDb } from "./helpers.js";

describe("terminal web", () => {
  beforeEach(resetDb);

  it("vincula una PWA con código temporal y emite un QR desde una cookie HttpOnly", async () => {
    const { tenant } = await makeTenant("pwa");
    const store = await prisma.store.create({ data: { tenantId: tenant.id, name: "Centro" } });
    const { h } = await loginTenant("pwa");

    const pairing = await request(app).post("/terminal/pairings").send({}).expect(201);
    expect(pairing.body.code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    expect(pairing.body.secret).toBeTruthy();

    await request(app)
      .post(`/tenant/terminal-pairings/${pairing.body.code}/approve`)
      .set(h)
      .send({ storeId: store.id, label: "iPad mostrador" })
      .expect(201);

    const terminal = request.agent(app);
    await terminal.post(`/terminal/pairings/${pairing.body.code}/complete`).send({ secret: pairing.body.secret }).expect(200);
    const config = await terminal.get("/terminal/config").expect(200);
    expect(config.body.machine.storeId).toBe(store.id);

    const issued = await terminal.post("/terminal/claims").send({ score: 900 }).expect(200);
    expect(decodeJwt(issued.body.token).machine_id).toBe(config.body.machine.id);
    expect(decodeJwt(issued.body.token).score).toBe(900);
  });

  it("no entrega sesión sin el secreto que solo conoce la tableta", async () => {
    const pairing = await request(app).post("/terminal/pairings").send({}).expect(201);
    await request(app).post(`/terminal/pairings/${pairing.body.code}/complete`).send({ secret: "x".repeat(43) }).expect(400);
  });

  it("vincula una terminal nativa con token Bearer y la revocación invalida su sesión", async () => {
    const { tenant } = await makeTenant("native");
    const store = await prisma.store.create({ data: { tenantId: tenant.id, name: "Norte" } });
    const { h } = await loginTenant("native");
    const pairing = await request(app).post("/terminal/pairings").send({}).expect(201);

    const machine = await request(app)
      .post(`/tenant/terminal-pairings/${pairing.body.code}/approve`)
      .set(h)
      .send({ storeId: store.id, label: "Arcade norte" })
      .expect(201);

    const completed = await request(app)
      .post(`/terminal/pairings/${pairing.body.code}/complete`)
      .send({ secret: pairing.body.secret, client: "native" })
      .expect(200);
    expect(completed.body.terminalToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(completed.body.expiresAt).toBeTruthy();

    const terminal = { Authorization: `Bearer ${completed.body.terminalToken}` };
    await request(app).get("/terminal/config").set(terminal).expect(200);
    await request(app).post("/terminal/claims").set(terminal).send({ score: 500 }).expect(200);
    await request(app).post(`/tenant/machines/${machine.body.id}/revoke`).set(h).expect(200);
    await request(app).get("/terminal/config").set(terminal).expect(401);
  });
});
