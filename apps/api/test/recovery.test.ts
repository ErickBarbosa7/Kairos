import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { outbox } from "../src/lib/mailer.js";
import { hashPassword } from "../src/lib/password.js";
import { app, loginTenant, makeTenant, PASSWORD, prisma, resetDb } from "./helpers.js";

const NEW = "una-clave-nueva-123";
const tokenFrom = (re: RegExp) => outbox.at(-1)!.text.match(re)![1]!;

beforeEach(async () => {
  await resetDb();
  outbox.length = 0;
});

describe("recuperar contraseña del panel", () => {
  it("manda un enlace, cambia la clave, cierra sesiones y el enlace sirve una sola vez", async () => {
    await makeTenant("aurora");
    const before = await loginTenant("aurora");
    const ask = await request(app).post("/auth/forgot-password").send({ tenantSlug: "aurora", email: "owner@aurora.test" });
    expect(ask.status).toBe(204);
    expect(outbox).toHaveLength(1);
    const token = tokenFrom(/restablecer\?token=(\S+)/);

    expect((await request(app).post("/auth/reset-password").send({ token, password: NEW })).status).toBe(204);
    expect((await request(app).post("/auth/reset-password").send({ token, password: NEW })).status).toBe(400);

    const login = (password: string) => request(app).post("/auth/tenant/login").send({ tenantSlug: "aurora", email: "owner@aurora.test", password });
    expect((await login(PASSWORD)).status).toBe(401);
    expect((await login(NEW)).status).toBe(200);
    expect(before.token).toBeTruthy();
    expect(await prisma.refreshToken.count({ where: { revokedAt: null, subjectType: "TENANT_USER" } })).toBe(1); // solo la sesión nueva
  });

  it("responde igual y no envía nada si la cuenta no existe", async () => {
    await makeTenant("aurora");
    const res = await request(app).post("/auth/forgot-password").send({ tenantSlug: "aurora", email: "nadie@x.test" });
    expect(res.status).toBe(204);
    expect(outbox).toHaveLength(0);
  });

  it("un token vencido o inventado no sirve y la clave nueva exige 10 caracteres", async () => {
    await makeTenant("aurora");
    await request(app).post("/auth/forgot-password").send({ tenantSlug: "aurora", email: "owner@aurora.test" });
    const token = tokenFrom(/restablecer\?token=(\S+)/);
    await prisma.emailToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).post("/auth/reset-password").send({ token, password: NEW })).status).toBe(400);
    expect((await request(app).post("/auth/reset-password").send({ token: "x".repeat(43), password: NEW })).status).toBe(400);
    expect((await request(app).post("/auth/reset-password").send({ token, password: "corta" })).status).toBe(400);
  });

  it("pedir otro enlace anula el anterior", async () => {
    await makeTenant("aurora");
    const ask = () => request(app).post("/auth/forgot-password").send({ tenantSlug: "aurora", email: "owner@aurora.test" });
    await ask();
    const first = tokenFrom(/restablecer\?token=(\S+)/);
    await ask();
    expect((await request(app).post("/auth/reset-password").send({ token: first, password: NEW })).status).toBe(400);
  });
});

describe("verificación de correo", () => {
  it("el registro manda el enlace y verificarlo marca la cuenta", async () => {
    const reg = await request(app).post("/auth/register").send({ businessName: "Café Aurora", adminName: "Ana Pérez", email: "ana@aurora.test", password: "una-clave-larga-123", acceptTerms: true });
    expect(reg.status).toBe(201);
    const auth = { Authorization: `Bearer ${reg.body.accessToken}` };
    expect((await request(app).get("/auth/me").set(auth)).body.emailVerified).toBe(false);

    const token = tokenFrom(/verificar\?token=(\S+)/);
    expect((await request(app).post("/auth/verify-email").send({ token })).status).toBe(204);
    expect((await request(app).get("/auth/me").set(auth)).body.emailVerified).toBe(true);
    expect((await request(app).post("/auth/verify-email").send({ token })).status).toBe(400);
  });

  it("reenviar manda un enlace nuevo, y no manda nada si ya está verificado", async () => {
    const { user } = await makeTenant("aurora");
    const { h } = await loginTenant("aurora");
    await request(app).post("/auth/resend-verification").set(h);
    expect(outbox).toHaveLength(1);
    await prisma.tenantUser.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    await request(app).post("/auth/resend-verification").set(h);
    expect(outbox).toHaveLength(1);
  });
});

describe("recuperar cuenta de la Wallet", () => {
  const makeConsumer = () =>
    prisma.consumer.create({ data: { email: "cliente@x.test", passwordHash: "x", isGuest: false, displayName: "Cli" } });

  it("manda un código, cambia la clave y el código sirve una vez", async () => {
    await makeConsumer();
    await request(app).post("/wallet/forgot-password").send({ email: "cliente@x.test" }).expect(204);
    const code = tokenFrom(/código es: (\S+)/);
    expect(code).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);

    await request(app).post("/wallet/reset-password").send({ email: "cliente@x.test", code: code.toLowerCase(), password: NEW }).expect(204);
    await request(app).post("/wallet/reset-password").send({ email: "cliente@x.test", code, password: NEW }).expect(400);
    await request(app).post("/wallet/login").send({ email: "cliente@x.test", password: NEW }).expect(200);
  });

  it("un código no sirve para otra cuenta", async () => {
    await makeConsumer();
    await prisma.consumer.create({ data: { email: "otro@x.test", passwordHash: await hashPassword("la-clave-otro-1"), isGuest: false } });
    await request(app).post("/wallet/forgot-password").send({ email: "cliente@x.test" });
    const code = tokenFrom(/código es: (\S+)/);
    await request(app).post("/wallet/reset-password").send({ email: "otro@x.test", code, password: NEW }).expect(400);
    await request(app).post("/wallet/login").send({ email: "otro@x.test", password: "la-clave-otro-1" }).expect(200);
  });

  it("no revela si el correo existe", async () => {
    await request(app).post("/wallet/forgot-password").send({ email: "nadie@x.test" }).expect(204);
    expect(outbox).toHaveLength(0);
  });
});
