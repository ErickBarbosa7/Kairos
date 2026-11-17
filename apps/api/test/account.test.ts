import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { app, prisma, resetDb } from "./helpers.js";
import { qr, setup, type Rig } from "./qr-helpers.js";

beforeEach(async () => {
  await resetDb();
  env.PRIZE_UNLOCK_HOURS = 0;
});

async function guest() {
  const res = await request(app).post("/wallet/guest");
  return { id: res.body.consumerId as string, h: { Authorization: `Bearer ${res.body.token}` } };
}
const earn = (rig: Rig, h: Record<string, string>, score = 1000) =>
  qr(rig, { score }).then((token) => request(app).post("/wallet/claims").set(h).send({ qr: token }));
const creds = { email: "Ana@Correo.com ", password: "clave-segura-1" };

describe("Cuenta del cliente (correo y contraseña)", () => {
  it("registrar convierte al invitado y conserva sus puntos", async () => {
    const rig = await setup();
    const g = await guest();
    const claim = await earn(rig, g.h);
    const res = await request(app).post("/wallet/register").set(g.h).send({ ...creds, displayName: "Ana" });
    expect(res.status).toBe(200);
    expect(res.body.me).toMatchObject({ id: g.id, isGuest: false, email: "ana@correo.com", displayName: "Ana" });
    expect(res.body).not.toHaveProperty("me.passwordHash");
    const bal = await request(app).get("/wallet/balances").set({ Authorization: `Bearer ${res.body.token}` });
    expect(bal.body.data[0].balance).toBe(claim.body.balance);
  });

  it("correo repetido: 409 email_taken; ya registrado: 409 already_registered", async () => {
    const a = await guest();
    await request(app).post("/wallet/register").set(a.h).send(creds).expect(200);
    const b = await guest();
    const dup = await request(app).post("/wallet/register").set(b.h).send(creds);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("email_taken");
    const again = await request(app).post("/wallet/register").set(a.h).send({ email: "otro@correo.com", password: "clave-segura-1" });
    expect(again.body.error.code).toBe("already_registered");
  });

  it("valida correo y contraseña corta", async () => {
    const g = await guest();
    await request(app).post("/wallet/register").set(g.h).send({ email: "x", password: "clave-segura-1" }).expect(400);
    await request(app).post("/wallet/register").set(g.h).send({ email: "a@b.com", password: "corta" }).expect(400);
  });

  it("login: credenciales malas dan 401 igual con correo existente o no", async () => {
    const g = await guest();
    await request(app).post("/wallet/register").set(g.h).send(creds);
    const bad = await request(app).post("/wallet/login").send({ email: "ana@correo.com", password: "incorrecta-1" });
    const none = await request(app).post("/wallet/login").send({ email: "nadie@correo.com", password: "incorrecta-1" });
    expect(bad.status).toBe(401);
    expect(none.status).toBe(401);
    expect(none.body.error).toEqual(bad.body.error);
  });

  it("login sin invitado recupera la cuenta en otro dispositivo", async () => {
    const rig = await setup();
    const g = await guest();
    const claim = await earn(rig, g.h);
    await request(app).post("/wallet/register").set(g.h).send(creds);
    const res = await request(app).post("/wallet/login").send(creds);
    expect(res.status).toBe(200);
    const bal = await request(app).get("/wallet/balances").set({ Authorization: `Bearer ${res.body.token}` });
    expect(bal.body.data[0].balance).toBe(claim.body.balance);
  });

  it("login con invitado que tiene puntos en el mismo negocio: suma saldos y cupones", async () => {
    const rig = await setup();
    const acc = await guest();
    const first = await earn(rig, acc.h);
    await request(app).post("/wallet/register").set(acc.h).send(creds);
    const g = await guest();
    const second = await earn(rig, g.h);
    const res = await request(app).post("/wallet/login").set(g.h).send(creds);
    expect(res.status).toBe(200);
    const bal = await request(app).get("/wallet/balances").set({ Authorization: `Bearer ${res.body.token}` });
    expect(bal.body.data).toHaveLength(1);
    expect(bal.body.data[0].balance).toBe(first.body.balance + second.body.pointsAwarded);
    expect((await prisma.consumer.findUniqueOrThrow({ where: { id: g.id } })).deletedAt).not.toBeNull();
    expect((await request(app).get("/wallet/me").set(g.h)).status).toBe(401);
    expect(await prisma.qrClaim.count({ where: { consumerId: acc.id } })).toBe(2);
  });

  it("login con invitado en un negocio distinto: la billetera pasa a la cuenta", async () => {
    const a = await setup({ slug: "uno" });
    const b = await setup({ slug: "dos" });
    const acc = await guest();
    await earn(a, acc.h);
    await request(app).post("/wallet/register").set(acc.h).send(creds);
    const g = await guest();
    await earn(b, g.h);
    const res = await request(app).post("/wallet/login").set(g.h).send(creds);
    const bal = await request(app).get("/wallet/balances").set({ Authorization: `Bearer ${res.body.token}` });
    expect(bal.body.data).toHaveLength(2);
  });
});
