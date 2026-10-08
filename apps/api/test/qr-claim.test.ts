import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { signConsumerToken } from "../src/lib/consumer-tokens.js";
import { app, keyPair, loginTenant, prisma, resetDb } from "./helpers.js";
import { qr, setup } from "./qr-helpers.js";

let consumerId: string;
let auth: { Authorization: string };

const claim = (token: string, headers = auth) => request(app).post("/wallet/claims").set(headers).send({ qr: token });
const walletOf = (tenantId: string) => prisma.wallet.findUnique({ where: { tenantId_consumerId: { tenantId, consumerId } } });

beforeEach(async () => {
  await resetDb();
  const consumer = await prisma.consumer.create({ data: { email: "cliente@example.com" } });
  consumerId = consumer.id;
  auth = { Authorization: `Bearer ${await signConsumerToken(consumerId)}` };
});

describe("acreditar un QR válido", () => {
  it("suma puntos con score_per_point, crea billetera, reclamo y movimiento del libro", async () => {
    const rig = await setup();
    const res = await claim(await qr(rig, { score: 235 })); // 235 / 10 = 23
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ pointsAwarded: 23, score: 235, balance: 23, lifetimeEarned: 23 });
    expect(res.body.tenant.id).toBe(rig.tenant.id);

    expect((await walletOf(rig.tenant.id))?.balance).toBe(23);
    const tx = await prisma.pointTransaction.findMany();
    expect(tx).toHaveLength(1);
    expect(tx[0]).toMatchObject({ type: "EARN", points: 23, balanceAfter: 23, tenantId: rig.tenant.id });
    const claimRow = await prisma.qrClaim.findFirstOrThrow();
    expect(claimRow).toMatchObject({ consumerId, machineId: rig.machine.id, score: 235, pointsAwarded: 23 });
    expect(tx[0]?.qrClaimId).toBe(claimRow.id);
  });

  it("acumula en la misma billetera y aplica el tope por partida", async () => {
    const rig = await setup();
    await claim(await qr(rig, { score: 300 }));
    const big = await claim(await qr(rig, { score: 999_999 })); // tope 50
    expect(big.body.pointsAwarded).toBe(50);
    expect(big.body.balance).toBe(80);
    expect(await prisma.wallet.count()).toBe(1);
  });

  it("funciona con llaves EdDSA", async () => {
    const rig = await setup({ kind: "ed25519" });
    expect((await claim(await qr(rig))).status).toBe(201);
  });

  it("cada negocio tiene su propia billetera", async () => {
    const a = await setup({ slug: "aurora" });
    const b = await setup({ slug: "pixel" });
    await claim(await qr(a, { score: 200 }));
    await claim(await qr(b, { score: 500 }));
    expect((await walletOf(a.tenant.id))?.balance).toBe(20);
    expect((await walletOf(b.tenant.id))?.balance).toBe(50);
  });
});

describe("un QR no se puede repetir", () => {
  it("el segundo intento responde 409 y no suma", async () => {
    const rig = await setup();
    const token = await qr(rig);
    expect((await claim(token)).status).toBe(201);
    const again = await claim(token);
    expect(again.status).toBe(409);
    // score 1000 / 10 = 100, pero el tope por partida (50) manda; el repetido no suma otra vez.
    expect((await walletOf(rig.tenant.id))?.balance).toBe(50);
    expect(await prisma.pointTransaction.count()).toBe(1);
  });

  it("con peticiones simultáneas solo una acredita", async () => {
    const rig = await setup();
    const token = await qr(rig);
    const results = await Promise.all([claim(token), claim(token), claim(token)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect((await walletOf(rig.tenant.id))?.balance).toBe(50);
    expect(await prisma.qrClaim.count()).toBe(1);
    expect(await prisma.pointTransaction.count()).toBe(1);
  });

  it("otro cliente tampoco puede usar un QR ya acreditado", async () => {
    const rig = await setup();
    const token = await qr(rig);
    await claim(token);
    const other = await prisma.consumer.create({ data: { email: "otro@example.com" } });
    const res = await claim(token, { Authorization: `Bearer ${await signConsumerToken(other.id)}` });
    expect(res.status).toBe(409);
  });
});

describe("rechaza QR que no son de confianza", () => {
  it("puntaje alterado sin volver a firmar", async () => {
    const rig = await setup();
    const [h, p, s] = (await qr(rig, { score: 100 })).split(".");
    const forged = JSON.parse(Buffer.from(p!, "base64url").toString());
    forged.score = 900_000;
    const token = `${h}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${s}`;
    const res = await claim(token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("qr_invalid");
    expect(await prisma.qrClaim.count()).toBe(0);
  });

  it("firmado con otra llave", async () => {
    const rig = await setup();
    const res = await claim(await qr(rig, {}, { priv: keyPair("ec").priv }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("qr_invalid");
  });

  it("firmado con otro algoritmo que el de la máquina", async () => {
    const rig = await setup({ kind: "ec" });
    expect((await claim(await qr(rig, {}, { priv: keyPair("ed25519").priv, alg: "EdDSA" }))).status).toBe(400);
  });

  it("machine_id de una máquina que no existe, o texto que no es un JWT", async () => {
    const rig = await setup();
    expect((await claim(await qr(rig, { machine_id: randomUUID() }))).status).toBe(400);
    expect((await claim("esto-no-es-un-jwt-pero-es-largo-123456")).status).toBe(400);
  });

  it("store_id distinto al de la máquina", async () => {
    const rig = await setup();
    expect((await claim(await qr(rig, { store_id: randomUUID() }))).status).toBe(400);
  });

  it("vencido", async () => {
    const rig = await setup();
    const now = Math.floor(Date.now() / 1000);
    const res = await claim(await qr(rig, { iat: now - 200, exp: now - 140 }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("qr_expired");
  });

  it("con vigencia mayor a 60 s o emitido en el futuro", async () => {
    const rig = await setup();
    const now = Math.floor(Date.now() / 1000);
    expect((await claim(await qr(rig, { iat: now, exp: now + 3600 }))).status).toBe(400);
    expect((await claim(await qr(rig, { iat: now + 600, exp: now + 650 }))).status).toBe(400);
  });

  it("puntaje negativo, decimal o jti inválido", async () => {
    const rig = await setup();
    expect((await claim(await qr(rig, { score: -5 }))).status).toBe(400);
    expect((await claim(await qr(rig, { score: 10.5 }))).status).toBe(400);
    expect((await claim(await qr(rig, { jti: "x" }))).status).toBe(400);
  });
});

describe("estado de la máquina y del negocio", () => {
  it("máquina revocada", async () => {
    const rig = await setup();
    await prisma.machine.update({ where: { id: rig.machine.id }, data: { status: "REVOKED", revokedAt: new Date() } });
    const res = await claim(await qr(rig));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("machine_inactive");
  });

  it("negocio suspendido o sucursal inactiva", async () => {
    const rig = await setup();
    await prisma.tenant.update({ where: { id: rig.tenant.id }, data: { status: "SUSPENDED" } });
    expect((await claim(await qr(rig))).status).toBe(403);
    await prisma.tenant.update({ where: { id: rig.tenant.id }, data: { status: "ACTIVE" } });
    await prisma.store.update({ where: { id: rig.store.id }, data: { isActive: false } });
    expect((await claim(await qr(rig))).status).toBe(403);
  });
});

describe("topes", () => {
  it("un puntaje menor a score_per_point no da puntos ni consume el QR", async () => {
    const rig = await setup();
    const token = await qr(rig, { score: 9 });
    const res = await claim(token);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("score_too_low");
    expect(await prisma.qrClaim.count()).toBe(0);
  });

  it("max_games_per_day limita por cliente y por negocio", async () => {
    const rig = await setup();
    await prisma.tenant.update({ where: { id: rig.tenant.id }, data: { maxGamesPerDay: 2 } });
    expect((await claim(await qr(rig))).status).toBe(201);
    expect((await claim(await qr(rig))).status).toBe(201);
    const third = await claim(await qr(rig));
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe("daily_limit");
    expect(await prisma.qrClaim.count()).toBe(2);

    const other = await prisma.consumer.create({ data: { email: "otro@example.com" } });
    const res = await claim(await qr(rig), { Authorization: `Bearer ${await signConsumerToken(other.id)}` });
    expect(res.status).toBe(201);
  });

  it("el tope diario se respeta aun con peticiones simultáneas", async () => {
    const rig = await setup();
    await prisma.tenant.update({ where: { id: rig.tenant.id }, data: { maxGamesPerDay: 2 } });
    const tokens = await Promise.all([qr(rig), qr(rig), qr(rig), qr(rig)]);
    const results = await Promise.all(tokens.map((t) => claim(t)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(await prisma.qrClaim.count()).toBe(2);
  });
});

describe("autenticación del cliente", () => {
  it("sin token, con token inválido o con token de panel", async () => {
    const rig = await setup();
    const token = await qr(rig);
    expect((await request(app).post("/wallet/claims").send({ qr: token })).status).toBe(401);
    expect((await claim(token, { Authorization: "Bearer basura" })).status).toBe(401);
    const panel = await loginTenant("aurora");
    expect((await claim(token, panel.h)).status).toBe(401);
  });

  it("un cliente borrado ya no puede acreditar", async () => {
    const rig = await setup();
    await prisma.consumer.update({ where: { id: consumerId }, data: { deletedAt: new Date() } });
    expect((await claim(await qr(rig))).status).toBe(401);
  });

  it("el token de cliente no sirve en el panel", async () => {
    await setup();
    expect((await request(app).get("/tenant/stores").set(auth)).status).toBe(401);
  });

  it("rechaza cuerpos con campos de más", async () => {
    const rig = await setup();
    const res = await request(app).post("/wallet/claims").set(auth).send({ qr: await qr(rig), tenantId: randomUUID() });
    expect(res.status).toBe(400);
  });
});

describe("saldos", () => {
  it("lista el saldo por negocio activo", async () => {
    const a = await setup({ slug: "aurora" });
    const b = await setup({ slug: "pixel" });
    await claim(await qr(a, { score: 300 }));
    await claim(await qr(b, { score: 200 }));
    await prisma.tenant.update({ where: { id: b.tenant.id }, data: { status: "SUSPENDED" } });
    const res = await request(app).get("/wallet/balances").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ balance: 30, lifetimeEarned: 30, tenant: { id: a.tenant.id } });
  });
});
